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
 *   model                  (string, optional)       "waste" | "animal" — when set,
 *                                                   call only that one service
 *                                                   (back-compat with single-model clients)
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
 *     model: "waste+animal"
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
const weatherService = require("../services/weatherService");
const { computeRisk } = require("../services/riskEngine");
const {
  inferSourceType,
  deriveFillPercentage,
  derivePredictionClass,
} = require("../utils/predictCaptureMeta");

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
    return deviceService.findDeviceIdForPredict(rawEsp, bridgeRaw || null);
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
      sourceType === "mobile" || sourceType === "admin";

    const bridgeInstanceId =
      trimBridgeInstanceId(body) !== ""
        ? trimBridgeInstanceId(body)
        : null;

    const reportLat = Number(body.lat);
    const reportLon = Number(body.lon);
    const captureLat = Number.isFinite(reportLat) ? reportLat : null;
    const captureLon = Number.isFinite(reportLon) ? reportLon : null;

    // Allow back-compat: model=waste|animal calls just one service.
    const requestedModel = (body.model || "").toString().trim().toLowerCase();
    const callBoth = !requestedModel || requestedModel === "all";

    let waste = null;
    let animal = null;

    if (callBoth) {
      const both = await modelClient.inferAll({
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      });
      waste = both.waste;
      animal = both.animal;
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
    } else {
      return res.status(400).json({
        error: `Unknown model '${requestedModel}'. Use 'waste', 'animal', or omit to call both.`,
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
      fill_percentage: deriveFillPercentage(risk),
      prediction_class: derivePredictionClass(
        waste,
        animalsForEngine.length,
        risk
      ),
    };

    const predictionsToStore = predictionsToPersist(animal);

    try {
      latestState.setLatest({
        deviceId,
        imageBuffer: req.file.buffer,
        mimetype: req.file.mimetype,
        filename: req.file.originalname,
        modelName: callBoth ? "waste+animal" : requestedModel,
        predictions: predictionsToStore,
        extras,
      });
    } catch (e) {
      console.error("[predict] failed to set latest state:", e.message);
    }

    try {
      const capture = await captureService.saveCaptureWithPredictions({
        modelName: callBoth ? "waste+animal" : requestedModel,
        imageUrl: null,
        imageBuffer: req.file.buffer,
        imageMimetype: req.file.mimetype,
        fillLevel: null, // YOLO bin-fill labels not produced by these two services
        userId: null,
        deviceId,
        bridgeInstanceId,
        predictions: predictionsToStore,
        extras,
      });
      if (capture) res.set("X-Capture-Id", String(capture.id));
    } catch (saveErr) {
      console.error("[predict] failed to persist capture:", saveErr.message);
    }

    return res.json({
      timestamp,
      model: callBoth ? "waste+animal" : requestedModel,
      waste,
      animal,
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
