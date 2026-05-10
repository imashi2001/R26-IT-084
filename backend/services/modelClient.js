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
 *               detection_count: number,
 *               annotated_image_base64: string,
 *               annotated_image_mime: "image/jpeg"
 *             }
 *
 * The shapes are intentionally different because the use cases differ:
 *   - waste is a 2-class CLASSIFIER (one label per image)
 *   - animal is a DETECTOR (zero, one, or many boxes per image)
 *
 * Callers usually want both for one capture; see `inferAll()`.
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

async function inferWaste({ fileBuffer, filename, mimetype }) {
  return postToService("waste", fileBuffer, filename, mimetype);
}

async function inferAnimal({ fileBuffer, filename, mimetype }) {
  return postToService("animal", fileBuffer, filename, mimetype);
}

/**
 * Run BOTH models on the same image in parallel and return raw payloads.
 * If one service is down, the other still produces its result; the failing
 * one comes back with `{ error: "..." }` so the caller can degrade gracefully.
 */
async function inferAll({ fileBuffer, filename, mimetype }) {
  const [wasteRes, animalRes] = await Promise.allSettled([
    inferWaste({ fileBuffer, filename, mimetype }),
    inferAnimal({ fileBuffer, filename, mimetype }),
  ]);

  const waste =
    wasteRes.status === "fulfilled"
      ? wasteRes.value
      : { error: wasteRes.reason?.message || "waste service failed" };
  const animal =
    animalRes.status === "fulfilled"
      ? animalRes.value
      : { error: animalRes.reason?.message || "animal service failed" };

  return { waste, animal };
}

/**
 * Generic single-model call (kept for parity with test-branch contract).
 * Test branch's modelClient returned `{ predictions: [...] }`; here we
 * return the raw service payload because the two services don't share a shape.
 */
async function infer({ modelName, fileBuffer, filename, mimetype }) {
  return postToService(modelName, fileBuffer, filename, mimetype);
}

module.exports = {
  getModelUrl,
  listModels,
  pingAllModels,
  inferWaste,
  inferAnimal,
  inferAll,
  infer,
};
