const { DEFAULT_MODEL } = require("../config/env");
const modelClient = require("../services/modelClient");
const captureService = require("../services/captureService");
const latestState = require("../services/latestState");

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

    // Always update in-memory "latest" snapshot for the frontend.
    // This enables showing the most recent ESP32 capture on HTTPS deployed UI.
    try {
      latestState.setLatest({
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
        userId: null,
        deviceId: null,
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
