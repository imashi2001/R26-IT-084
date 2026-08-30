/**
 * /predict controller.
 *
 * One image in -> waste classification + animal detection + weather snapshot
 *              + rule-based risk + rotting estimate + persisted capture.
 *
 * Multipart fields (test-branch contract preserved):
 *   image                  (file, required)         binary
 *   bridge_instance_id     (string, recommended)    laptop bridge UUID
 *   esp32_id               (string, optional)       binds to a Device row
 *   device_id              (number, optional)       direct Device id override
 *   model                  (string, optional)       "waste" | "animal" | "yolo"| "fill"| "bin_fill" —
 *                                                   when set, call only that service; omit / "all" runs waste+animal (+ MODEL_YOLO_URL bin-fill).
 *   lat / lon              (number, optional)       weather + stored on capture
 *   source_type            (string, optional)       esp32 | mobile | admin
 *
 * Response (when both models run):
 *   {
 *     waste:    { label, confidence, ... raw waste-api payload ... },
 *     animal:   { detection_count, detections, annotated_image_base64, ... },
 *     weather:  { temp_c, humidity_pct, condition, source, ... },
 *     risk:     { level, case, message, rules_fired, alert, rotting_hours, ... },
 *     bin:      { id, name, esp32_id, ... }   (null when no DB / no match),
 *     timestamp: ISO,
 *     model: "waste+animal+bin_fill" | ...
 *   }
 *
 * Response sets X-Capture-Id header when the row is saved.
 */

const { DEFAULT_WEATHER_LAT, DEFAULT_WEATHER_LON } =
  require("../config/env");
const modelClient = require("../services/modelClient");
const captureService = require("../services/captureService");
const latestState = require("../services/latestState");
const deviceService = require("../services/deviceService");
const audioTriggerService = require("../services/audioTriggerService");
const litteringAlertService = require("../services/litteringAlertService");
const weatherService = require("../services/weatherService");
const { computeRisk } = require("../services/riskEngine");
const {
  inferSourceType,
  deriveFillPercentage,
  derivePredictionClass,
} = require("../utils/predictCaptureMeta");
const { deriveFillLevel } = require("../utils/fillLevel");

function trimBridgeInstanceId(body) {
  if (
    !body ||
    body.bridge_instance_id === undefined ||
    body.bridge_instance_id === null
  ) {
    return "";
  }
  return String(body.bridge_instance_id).trim();
}

async function resolveDeviceId(body, { bypassBridgeCheck = false } = {}) {
  const bridgeRaw = trimBridgeInstanceId(body);

  const rawEsp =
    body &&
    body.esp32_id !== undefined &&
    body.esp32_id !== null &&
    body.esp32_id !== ""
      ? String(body.esp32_id).trim()
      : "";
  const rawDid = body && body.device_id;

  if (
    rawDid !== undefined &&
    rawDid !== null &&
    String(rawDid).trim() !== ""
  ) {
    const id = parseInt(rawDid, 10);
    if (!Number.isFinite(id)) return null;

    const device = await deviceService.getDeviceById(id);
    if (!device) return null;

    const bound = device.bridge_instance_id
      ? String(device.bridge_instance_id).trim()
      : "";
    if (bound && bound !== bridgeRaw && !bypassBridgeCheck) {
      return null;
    }
    return id;
  }

  if (rawEsp) {
    return deviceService.findDeviceIdForPredict(rawEsp, bridgeRaw || null, {
      bypassBridgeCheck,
    });
  }

  return null;
}

function pickWeatherLocation(body, device) {
  const bodyLat = Number(body?.lat);
  const bodyLon = Number(body?.lon);
  if (Number.isFinite(bodyLat) && Number.isFinite(bodyLon)) {
    return { lat: bodyLat, lon: bodyLon, source: "body" };
  }
  if (
    device &&
    Number.isFinite(Number(device.latitude)) &&
    Number.isFinite(Number(device.longitude))
  ) {
    return {
      lat: Number(device.latitude),
      lon: Number(device.longitude),
      source: "device",
    };
  }
  return {
    lat: DEFAULT_WEATHER_LAT,
    lon: DEFAULT_WEATHER_LON,
    source: "default",
  };
}

function animalsForRiskEngine(animalPayload) {
  if (!animalPayload || animalPayload.error) return [];
  const detections = Array.isArray(animalPayload.detections)
    ? animalPayload.detections
    : [];
  return detections.map((d) => ({
    class_name: d.label || d.class_name || "?",
    label: d.label,
    confidence: Number(d.confidence) || 0,
    box: Array.isArray(d.box) ? d.box.map(Number) : [0, 0, 0, 0],
  }));
}

function predictionsToPersist(animalPayload) {
  if (!animalPayload || animalPayload.error) return [];
  const detections = Array.isArray(animalPayload.detections)
    ? animalPayload.detections
    : [];
  return detections.map((d) => ({
    label: d.label || "?",
    confidence: Number(d.confidence) || 0,
    box: Array.isArray(d.box) ? d.box.map(Number) : [0, 0, 0, 0],
  }));
}

function predictionsFromLitteringAction(litteringPayload) {
  if (!litteringPayload || litteringPayload.error) return [];
  const detections = Array.isArray(litteringPayload.detections)
    ? litteringPayload.detections
    : [];
  return detections.map((d) => ({
    label: d.class_name || d.label || "littering",
    confidence: Number(d.confidence) || 0,
    box: Array.isArray(d.box) ? d.box.map(Number) : [0, 0, 0, 0],
    model_type: "littering_action",
  }));
}

function litteringActionForResponse(litteringPayload) {
  if (!litteringPayload) return null;
  if (litteringPayload.error) return null;
  return {
    event_detected: Boolean(litteringPayload.event_detected),
    event_count: Number(litteringPayload.event_count) || 0,
    max_confidence: Number(litteringPayload.max_confidence) || 0,
    detections: Array.isArray(litteringPayload.detections)
      ? litteringPayload.detections.map((d) => ({
          class_id: d.class_id,
          class_name: d.class_name || d.label,
          confidence: Number(d.confidence) || 0,
          bbox: d.bbox,
          bbox_normalized: d.bbox_normalized,
        }))
      : [],
  };
}

function litteringExtras(litteringPayload) {
  if (!litteringPayload || litteringPayload.error) {
    return {
      littering_event_detected: null,
      littering_event_count: null,
      littering_max_confidence: null,
      littering_action_summary: null,
    };
  }
  return {
    littering_event_detected: Boolean(litteringPayload.event_detected),
    littering_event_count: Number(litteringPayload.event_count) || 0,
    littering_max_confidence: Number(litteringPayload.max_confidence) || 0,
    littering_action_summary: {
      event_detected: Boolean(litteringPayload.event_detected),
      event_count: Number(litteringPayload.event_count) || 0,
      max_confidence: Number(litteringPayload.max_confidence) || 0,
      inference_ms: litteringPayload.inference_ms ?? null,
      model: litteringPayload.model || null,
      detections: litteringPayload.detections || [],
    },
  };
}

function predictionsFromBinFill(binFillPayload) {
  if (!binFillPayload || binFillPayload.error) return [];
  const preds = Array.isArray(binFillPayload.predictions)
    ? binFillPayload.predictions
    : [];
  return preds.map((p) => ({
    label: p.label || "?",
    confidence: Number(p.confidence) || 0,
    box: Array.isArray(p.box) ? p.box.map(Number) : [0, 0, 0, 0],
  }));
}

const YOLO_FILL_TIER_TO_PCT = { Empty: 25, Half: 50, Overflow: 85 };

function persistModelLabel(bodyModel, hasYoloRegistry) {
  const rm = (bodyModel || "").toString().trim().toLowerCase();
  if (rm === "waste") return "waste";
  if (rm === "animal") return "animal";
  if (rm === "yolo" || rm === "fill" || rm === "bin_fill") return "bin_fill_yolo";
  const parts = ["waste", "animal"];
  if (hasYoloRegistry) parts.push("bin_fill");
  return parts.join("+");
}

async function predict(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error:
          "No image file provided. Send as multipart/form-data with key 'image'.",
      });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: "Empty image received." });
    }

    const body = req.body || {};
    const sourceType = inferSourceType(body);
    const bypassBridge =
      sourceType === "mobile" ||
      sourceType === "admin" ||
      sourceType === "esp32";

    const bridgeInstanceId =
      trimBridgeInstanceId(body) !== ""
        ? trimBridgeInstanceId(body)
        : null;

    const reportLat = Number(body.lat);
    const reportLon = Number(body.lon);
    const captureLat = Number.isFinite(reportLat) ? reportLat : null;
    const captureLon = Number.isFinite(reportLon) ? reportLon : null;

    // Allow back-compat: model=waste|animal|yolo calls one service; omit / all => inferAll (waste + animal + optional bin-fill YOLO).
    const requestedModel = (body.model || "").toString().trim().toLowerCase();
    const callBoth = !requestedModel || requestedModel === "all";
    const binFillOnly =
      requestedModel === "yolo" ||
      requestedModel === "fill" ||
      requestedModel === "bin_fill";
    const hasYoloRegistry = Boolean(modelClient.getModelUrl("yolo"));

    let waste = null;
    let animal = null;
    let bin_fill = null;
    let littering_action = null;
    const warnings = [];

    if (callBoth) {
      const triple = await modelClient.inferAll({
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      });
      waste = triple.waste;
      animal = triple.animal;
      bin_fill = triple.bin_fill;
      littering_action = triple.littering_action;
      if (littering_action?.error) {
        warnings.push(`littering_action: ${littering_action.error}`);
        console.warn("[predict] littering_action:", littering_action.error);
        littering_action = null;
      }
    } else if (requestedModel === "waste") {
      try {
        waste = await modelClient.inferWaste({
          fileBuffer: req.file.buffer,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
        });
      } catch (e) {
        waste = { error: e.message };
      }
    } else if (requestedModel === "animal") {
      try {
        animal = await modelClient.inferAnimal({
          fileBuffer: req.file.buffer,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
        });
      } catch (e) {
        animal = { error: e.message };
      }
    } else if (binFillOnly) {
      bin_fill = await modelClient.inferBinFillYolo({
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      });
    } else {
      return res.status(400).json({
        error: `Unknown model '${requestedModel}'. Use 'waste', 'animal', 'yolo', 'fill', 'bin_fill', 'all', or omit.`,
      });
    }

    const deviceId = await resolveDeviceId(body, {
      bypassBridgeCheck: bypassBridge,
    });
    const device = deviceId ? await deviceService.getDeviceById(deviceId) : null;

    const { lat, lon, source: locationSource } = pickWeatherLocation(
      body,
      device
    );
    const weather = await weatherService.getCurrentWeather(lat, lon);

    const animalsForEngine = animalsForRiskEngine(animal);
    const tierPredictions =
      bin_fill && !bin_fill.error && Array.isArray(bin_fill.predictions)
        ? bin_fill.predictions
        : [];
    const bin_fill_level = deriveFillLevel(tierPredictions);

    const binDoc = device
      ? {
          name: device.name,
          hours_since_clean: 0,
        }
      : null;

    const wasteForEngine =
      waste && !waste.error
        ? {
            label: waste.label,
            confidence: waste.confidence,
          }
        : null;

    const risk = computeRisk({
      waste: wasteForEngine,
      animals: animalsForEngine,
      weather,
      binDoc,
    });

    const timestamp = new Date().toISOString();
    const persistLabel = persistModelLabel(body.model, hasYoloRegistry);

    const extras = {
      waste_label: waste?.label || null,
      waste_confidence: Number.isFinite(Number(waste?.confidence))
        ? Number(waste.confidence)
        : null,
      animal_count: animalsForEngine.length,
      risk_level: risk.level,
      risk_case: risk.case,
      rotting_hours: risk.rotting_hours,
      temp_c: weather?.temp_c ?? null,
      humidity_pct: weather?.humidity_pct ?? null,
      weather_condition: weather?.condition ?? null,
      source_type: sourceType,
      latitude: captureLat,
      longitude: captureLon,
      fill_percentage:
        bin_fill_level != null &&
        YOLO_FILL_TIER_TO_PCT[bin_fill_level] != null
          ? YOLO_FILL_TIER_TO_PCT[bin_fill_level]
          : deriveFillPercentage(risk),
      prediction_class: (() => {
        if (waste && !waste.error && waste.label)
          return String(waste.label).slice(0, 160);
        if (bin_fill_level) return String(bin_fill_level).slice(0, 160);
        return derivePredictionClass(
          waste,
          animalsForEngine.length,
          risk
        );
      })(),
      ...litteringExtras(littering_action),
    };

    const predictionsToStore = [
      ...predictionsToPersist(animal),
      ...predictionsFromBinFill(bin_fill),
      ...predictionsFromLitteringAction(littering_action),
    ];

    try {
      latestState.setLatest({
        deviceId,
        imageBuffer: req.file.buffer,
        mimetype: req.file.mimetype,
        filename: req.file.originalname,
        modelName: persistLabel,
        predictions: predictionsToStore,
        extras,
      });
    } catch (e) {
      console.error("[predict] failed to set latest state:", e.message);
    }

    let savedCapture = null;
    try {
      savedCapture = await captureService.saveCaptureWithPredictions({
        modelName: persistLabel,
        imageUrl: null,
        imageBuffer: req.file.buffer,
        imageMimetype: req.file.mimetype,
        fillLevel: bin_fill_level || null,
        userId: null,
        deviceId,
        bridgeInstanceId,
        predictions: predictionsToStore,
        extras,
      });
      if (savedCapture) res.set("X-Capture-Id", String(savedCapture.id));
    } catch (saveErr) {
      console.error("[predict] failed to persist capture:", saveErr.message);
    }

    try {
      await litteringAlertService.maybeCreateLitteringAlert({
        captureId: savedCapture?.id || null,
        deviceId,
        litteringAction: littering_action,
      });
    } catch (alertErr) {
      console.error("[predict] littering alert skipped:", alertErr.message);
    }

    try {
      await audioTriggerService.maybeQueueFromPredict({
        device,
        risk,
        sourceType,
      });
    } catch (audioErr) {
      console.error("[predict] audio trigger skipped:", audioErr.message);
    }

    return res.json({
      timestamp,
      model: persistLabel,
      waste,
      animal,
      bin_fill,
      bin_fill_level,
      littering_action: litteringActionForResponse(littering_action),
      warnings: warnings.length ? warnings : undefined,
      weather: { ...weather, location_source: locationSource, lat, lon },
      risk,
      bin: device
        ? {
            id: device.id,
            name: device.name,
            esp32_id: device.esp32_id,
            latitude: device.latitude,
            longitude: device.longitude,
          }
        : null,
      bridge_instance_id: bridgeInstanceId,
      source_type: sourceType,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { predict };
