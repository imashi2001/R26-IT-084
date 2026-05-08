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

    const captures = await captureService.listCaptures({ limit, offset });
    res.json({ count: captures.length, limit, offset, captures });
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

    res.json(capture);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCaptures, getCapture };
