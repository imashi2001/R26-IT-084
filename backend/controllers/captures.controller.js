const captureService = require("../services/captureService");
const db = require("../config/db");

function clamp(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

async function listCaptures(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({
        error:
          "History is unavailable: backend was started without a database (DATABASE_URL not set).",
      });
    }

    const limit = clamp(req.query.limit ?? 20, 1, 100);
    const offset = clamp(req.query.offset ?? 0, 0, 1_000_000);
    const deviceIdRaw = req.query.device_id;
    const deviceId =
      deviceIdRaw !== undefined && deviceIdRaw !== "" && deviceIdRaw !== null
        ? parseInt(deviceIdRaw, 10)
        : null;
    if (
      deviceIdRaw !== undefined &&
      deviceIdRaw !== "" &&
      !Number.isFinite(deviceId)
    ) {
      return res.status(400).json({ error: "device_id must be a number" });
    }

    const captures = await captureService.listCaptures({
      limit,
      offset,
      deviceId: Number.isFinite(deviceId) ? deviceId : null,
    });
    const sanitized = captures.map((c) => {
      const buf = c.image_buffer;
      const has_image = Boolean(
        buf &&
          (Buffer.isBuffer(buf)
            ? buf.length > 0
            : typeof buf === "string"
              ? buf.length > 0
              : ArrayBuffer.isView(buf) && buf.byteLength > 0)
      );
      const { image_buffer: _ib, ...rest } = c;
      return { ...rest, has_image };
    });
    res.json({
      count: sanitized.length,
      limit,
      offset,
      captures: sanitized,
    });
  } catch (err) {
    next(err);
  }
}

async function getCapture(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({ error: "History is unavailable." });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid capture id." });
    }

    const capture = await captureService.getCapture(id);
    if (!capture) return res.status(404).json({ error: "Capture not found." });

    const buf = capture.image_buffer;
    const has_image = Boolean(
      buf &&
        (Buffer.isBuffer(buf)
          ? buf.length > 0
          : typeof buf === "string"
            ? buf.length > 0
            : ArrayBuffer.isView(buf) && buf.byteLength > 0)
    );
    const { image_buffer: _ib, ...rest } = capture;
    res.json({ ...rest, has_image });
  } catch (err) {
    next(err);
  }
}

async function getCaptureImage(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({ error: "History is unavailable." });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid capture id." });
    }

    const capture = await captureService.getCapture(id);
    if (!capture) return res.status(404).json({ error: "Capture not found." });

    let buf = capture.image_buffer;
    if (!buf) {
      return res.status(404).json({ error: "No image stored for this capture." });
    }
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    if (!buf.length) {
      return res.status(404).json({ error: "No image stored for this capture." });
    }

    res.set("Content-Type", capture.image_mimetype || "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    return res.send(buf);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCaptures, getCapture, getCaptureImage };
