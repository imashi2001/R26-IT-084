const axios = require("axios");
const FormData = require("form-data");

const { MODEL_REGISTRY, INFER_TIMEOUT_MS } = require("../config/env");

/**
 * Two model microservices, each deployed separately on Railway:
 *
 *   waste  -> services/waste-api  (FastAPI / MobileNetV2)
 *             POST /predict (multipart "file") -> {
 *               model: "waste_classification",
 *               label: "organic" | "non_organic",
 *               predicted_index: 0|1,
 *               organic_probability: number,
 *               non_organic_probability: number,
 *               confidence: number
 *             }
 *
 *   animal -> services/animal-api (FastAPI / YOLOv8n)
 *             POST /predict (multipart "file") -> {
 *               model: "animal_detection",
 *               detections: [{ label, confidence, box: [x1,y1,x2,y2] }],
 *               (service may send box_xyxy/class_name; gateway normalizes)
 *               detection_count: number,
 *               annotated_image_base64: string,
 *               ...
 *             }
 *
 * The shapes are intentionally different because the use cases differ:
 *   - waste is a 2-class CLASSIFIER (one label per image)
 *   - animal is a DETECTOR (zero, one, or many boxes per image)
 *
 *   yolo   -> model-yolo/ (Flask / Ultralytics)
 *             POST /infer (multipart "image") -> {
 *               model, predictions: [{ label, confidence, box }],
 *               detections (alias), annotated_image_base64 (JPEG plot), ...
 *             }
 *
 *   litter -> services/litter-severity-api (FastAPI / YOLO + LSI)
 *             POST /predict (multipart "file") -> {
 *               model: "litter_severity", lsi, severity, metrics, detections,
 *               annotated_image_base64, ...
 *             }
 *
 * Callers usually want waste + animal + optional bin-fill YOLO; see `inferAll()`.
 */

function getModelUrl(modelName) {
  return MODEL_REGISTRY[modelName] || null;
}

function listModels() {
  return Object.keys(MODEL_REGISTRY);
}

async function pingAllModels() {
  const result = {};

  await Promise.all(
    Object.entries(MODEL_REGISTRY).map(async ([name, url]) => {
      try {
        const r = await axios.get(`${url}/health`, { timeout: 3000 });
        result[name] = { url, ok: true, status: r.status };
      } catch (err) {
        result[name] = { url, ok: false, error: err.message };
      }
    })
  );

  return result;
}

function buildForm(fileBuffer, filename, mimetype) {
  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: filename || "upload.jpg",
    contentType: mimetype || "image/jpeg",
  });
  return form;
}

/**
 * Animal microservice returns `box_xyxy` + `class_name`; gateway normalizes to `box` + `label`
 * for persistence, risk engine, and frontend overlays.
 */
function normalizeAnimalPayload(raw) {
  if (!raw || typeof raw !== "object" || raw.error) return raw;
  const detections = Array.isArray(raw.detections)
    ? raw.detections.map((d) => {
        const boxFrom =
          Array.isArray(d.box) && d.box.length >= 4
            ? d.box
            : Array.isArray(d.box_xyxy) && d.box_xyxy.length >= 4
              ? d.box_xyxy
              : null;
        const box = boxFrom
          ? boxFrom.slice(0, 4).map((x) => Number(x))
          : [0, 0, 0, 0];
        const label =
          (d.label != null && String(d.label).trim()) ||
          (d.class_name != null && String(d.class_name).trim()) ||
          "animal";
        return {
          ...d,
          label,
          confidence: Number(d.confidence) || 0,
          box,
        };
      })
    : [];
  return { ...raw, detections };
}

/** Bin-fill model-yolo: unify `predictions` / `detections` lists for dashboards + DB. */
function normalizeBinFillPayload(raw) {
  if (!raw || typeof raw !== "object" || raw.error) return raw;
  const preds = Array.isArray(raw.predictions)
    ? raw.predictions
    : Array.isArray(raw.detections)
      ? raw.detections
      : [];
  const normalized = preds.map((p) => ({
    label: p.label != null ? String(p.label) : "?",
    confidence: Number(p.confidence) || 0,
    box: Array.isArray(p.box) ? p.box.map(Number) : [0, 0, 0, 0],
  }));
  return {
    ...raw,
    predictions: normalized,
    detections: normalized,
  };
}

async function postToService(modelName, fileBuffer, filename, mimetype) {
  const base = getModelUrl(modelName);
  if (!base) {
    const err = new Error(
      `Unknown model '${modelName}'. Available: ${listModels().join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  const form = buildForm(fileBuffer, filename, mimetype);
  const targetUrl = `${base}/predict`;

  try {
    const r = await axios.post(targetUrl, form, {
      headers: form.getHeaders(),
      timeout: INFER_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return r.data || {};
  } catch (err) {
    if (err.response) {
      const e = new Error(
        `Model service '${modelName}' returned ${err.response.status}.`
      );
      e.status = err.response.status;
      e.detail = err.response.data;
      throw e;
    }
    const e = new Error(
      `Could not reach model service '${modelName}' at ${targetUrl}.`
    );
    e.status = 502;
    e.detail = err.message;
    throw e;
  }
}

async function inferBinFillYolo({ fileBuffer, filename, mimetype }) {
  const base = getModelUrl("yolo");
  if (!base) {
    return { error: "MODEL_YOLO_URL is not set on the backend." };
  }

  const form = new FormData();
  form.append("image", fileBuffer, {
    filename: filename || "upload.jpg",
    contentType: mimetype || "image/jpeg",
  });

  const baseTrim = base.replace(/\/+$/, "");
  const targetUrl = `${baseTrim}/infer`;

  try {
    const r = await axios.post(targetUrl, form, {
      headers: form.getHeaders(),
      timeout: INFER_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return normalizeBinFillPayload(r.data || {});
  } catch (err) {
    if (err.response) {
      const detail = err.response.data;
      const msg =
        (detail && (detail.error || detail.message)) ||
        `Bin-fill YOLO returned HTTP ${err.response.status}.`;
      return { error: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
    return {
      error:
        err.message ||
        `Could not reach bin-fill YOLO at ${targetUrl}. Check MODEL_YOLO_URL.`,
    };
  }
}

async function inferWaste({ fileBuffer, filename, mimetype }) {
  return postToService("waste", fileBuffer, filename, mimetype);
}

async function inferAnimal({ fileBuffer, filename, mimetype }) {
  const data = await postToService("animal", fileBuffer, filename, mimetype);
  return normalizeAnimalPayload(data);
}

/** Litter severity microservice (YOLO + LSI). */
async function inferLitter({ fileBuffer, filename, mimetype }) {
  const base = getModelUrl("litter");
  if (!base) {
    const err = new Error("MODEL_LITTER_URL is not set on the backend.");
    err.status = 503;
    throw err;
  }
  return postToService("litter", fileBuffer, filename, mimetype);
}

/**
 * Run BOTH models on the same image in parallel and return raw payloads.
 * If one service is down, the other still produces its result; the failing
 * one comes back with `{ error: "..." }` so the caller can degrade gracefully.
 */
async function inferAll({ fileBuffer, filename, mimetype }) {
  const hasYolo = Boolean(getModelUrl("yolo"));
  const settled = await Promise.allSettled([
    inferWaste({ fileBuffer, filename, mimetype }),
    inferAnimal({ fileBuffer, filename, mimetype }),
    hasYolo
      ? inferBinFillYolo({ fileBuffer, filename, mimetype })
      : Promise.resolve(null),
  ]);

  const waste =
    settled[0].status === "fulfilled"
      ? settled[0].value
      : { error: settled[0].reason?.message || "waste service failed" };
  const animal =
    settled[1].status === "fulfilled"
      ? settled[1].value
      : { error: settled[1].reason?.message || "animal service failed" };

  let bin_fill = null;
  if (hasYolo) {
    bin_fill =
      settled[2].status === "fulfilled"
        ? settled[2].value
        : { error: settled[2].reason?.message || "bin-fill YOLO failed" };
  }

  return { waste, animal, bin_fill };
}

/**
 * Generic single-model call (kept for parity with test-branch contract).
 * Test branch's modelClient returned `{ predictions: [...] }`; here we
 * return the raw service payload because the two services don't share a shape.
 */
async function infer({ modelName, fileBuffer, filename, mimetype }) {
  const key = (modelName || "").toString().trim().toLowerCase();
  if (key === "yolo" || key === "fill" || key === "bin_fill") {
    return inferBinFillYolo({ fileBuffer, filename, mimetype });
  }
  if (key === "litter") {
    return inferLitter({ fileBuffer, filename, mimetype });
  }
  const data = await postToService(modelName, fileBuffer, filename, mimetype);
  if (modelName === "animal") return normalizeAnimalPayload(data);
  return data;
}

module.exports = {
  getModelUrl,
  listModels,
  pingAllModels,
  inferWaste,
  inferAnimal,
  inferLitter,
  inferBinFillYolo,
  inferAll,
  infer,
  normalizeAnimalPayload,
  normalizeBinFillPayload,
};
