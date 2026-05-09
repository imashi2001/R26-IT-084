const { DEFAULT_MODEL } = require("../config/env");
const modelClient = require("../services/modelClient");
const captureService = require("../services/captureService");
const latestState = require("../services/latestState");
const deviceService = require("../services/deviceService");
const { deriveFillLevel } = require("../utils/fillLevel");

async function resolveDeviceId(body) {
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
    return Number.isFinite(id) ? id : null;
  }

  if (rawEsp) {
    const id = await deviceService.findDeviceIdByEsp32Id(rawEsp);
    return id;
  }

  return null;
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

    const modelName = (req.body.model || DEFAULT_MODEL).toString();
    const conf = req.body.conf || "0.25";

    const predictions = await modelClient.infer({
      modelName,
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      conf,
    });

    const fillLevel = deriveFillLevel(predictions);

    const deviceId = await resolveDeviceId(req.body || {});

    try {
      latestState.setLatest({
        deviceId,
        imageBuffer: req.file.buffer,
        mimetype: req.file.mimetype,
        filename: req.file.originalname,
        modelName,
        predictions,
      });
    } catch (e) {
      console.error("[predict] failed to set latest state:", e.message);
    }

    try {
      const capture = await captureService.saveCaptureWithPredictions({
        modelName,
        imageUrl: null,
        imageBuffer: req.file.buffer,
        imageMimetype: req.file.mimetype,
        fillLevel,
        userId: null,
        deviceId,
        predictions,
      });
      if (capture) res.set("X-Capture-Id", String(capture.id));
    } catch (saveErr) {
      console.error("[predict] failed to persist capture:", saveErr.message);
    }

    res.json(predictions);
  } catch (err) {
    next(err);
  }
}

module.exports = { predict };
