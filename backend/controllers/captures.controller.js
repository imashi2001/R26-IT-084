const captureService = require("../services/captureService");
const db = require("../config/db");
const { toNodeBuffer } = require("../utils/imageBuffer");

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

    const limit = clamp(req.query.limit ?? 20, 1, 500);
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

    function parseDate(raw) {
      if (raw == null || raw === "") return null;
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return undefined;
      return d;
    }
    const since = parseDate(req.query.since);
    const until = parseDate(req.query.until);
    if (since === undefined) {
      return res.status(400).json({ error: "since must be an ISO date string" });
    }
    if (until === undefined) {
      return res.status(400).json({ error: "until must be an ISO date string" });
    }

    const captures = await captureService.listCaptures({
      limit,
      offset,
      deviceId: Number.isFinite(deviceId) ? deviceId : null,
      since,
      until,
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

    const buf = toNodeBuffer(capture.image_buffer);
    if (!buf) {
      return res.status(404).json({ error: "No image stored for this capture." });
    }

    res.set("Content-Type", capture.image_mimetype || "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    return res.send(buf);
  } catch (err) {
    next(err);
  }
}

async function getCaptureStats(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({
        error: "Captures unavailable: DATABASE_URL not set.",
      });
    }
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
    const total = await captureService.countCaptures({
      deviceId: Number.isFinite(deviceId) ? deviceId : null,
    });
    res.json({ total });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /captures
 * Admin-only bulk delete of bin photos (capture rows + related predictions/alerts).
 *
 * Query/body:
 *   older_than_days — delete captures older than N days (omit + all=1 → delete all)
 *   keep_latest     — keep the N newest captures
 *   device_id       — limit to one device
 *   all=1           — required when deleting everything (safety)
 */
async function deleteCaptures(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({
        error: "Captures unavailable: DATABASE_URL not set.",
      });
    }

    const q = { ...req.query, ...(req.body || {}) };
    const olderRaw = q.older_than_days;
    const keepRaw = q.keep_latest;
    const deviceIdRaw = q.device_id;
    const deleteAll =
      q.all === true ||
      q.all === "1" ||
      String(q.all || "").toLowerCase() === "true";

    const olderThanDays =
      olderRaw !== undefined && olderRaw !== null && olderRaw !== ""
        ? Number(olderRaw)
        : null;
    const keepLatest =
      keepRaw !== undefined && keepRaw !== null && keepRaw !== ""
        ? Number(keepRaw)
        : null;
    const deviceId =
      deviceIdRaw !== undefined && deviceIdRaw !== null && deviceIdRaw !== ""
        ? parseInt(deviceIdRaw, 10)
        : null;

    if (olderThanDays != null && !Number.isFinite(olderThanDays)) {
      return res.status(400).json({ error: "older_than_days must be a number" });
    }
    if (keepLatest != null && !Number.isFinite(keepLatest)) {
      return res.status(400).json({ error: "keep_latest must be a number" });
    }
    if (
      deviceIdRaw !== undefined &&
      deviceIdRaw !== "" &&
      !Number.isFinite(deviceId)
    ) {
      return res.status(400).json({ error: "device_id must be a number" });
    }

    const hasFilter =
      olderThanDays != null || keepLatest != null || Number.isFinite(deviceId);
    if (!deleteAll && !hasFilter) {
      return res.status(400).json({
        error:
          "Specify older_than_days, keep_latest, and/or all=1 to delete captures.",
      });
    }
    if (deleteAll && olderThanDays == null && keepLatest == null) {
      // full wipe — ok
    }

    const result = await captureService.deleteCaptures({
      olderThanDays: olderThanDays != null ? olderThanDays : null,
      deviceId: Number.isFinite(deviceId) ? deviceId : null,
      keepLatest: keepLatest != null ? keepLatest : null,
      // When all=1 with no olderThan/keepLatest, where is empty → delete all matching device filter
    });

    // If caller asked all=1 but also older_than, deleteCaptures already applied older filter.
    // If neither older nor keep and not all — already rejected above.
    // Edge: all=1 with keep_latest uses keep path; all=1 alone deletes everything.

    console.log(
      `[captures] deleted=${result.deleted} remaining=${result.remaining} by user=${req.user?.id || "?"}`
    );

    res.json({
      message:
        result.deleted === 0
          ? "No captures matched the filter."
          : `Deleted ${result.deleted} capture(s).`,
      deleted: result.deleted,
      remaining: result.remaining,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCaptures,
  getCapture,
  getCaptureImage,
  getCaptureStats,
  deleteCaptures,
};
