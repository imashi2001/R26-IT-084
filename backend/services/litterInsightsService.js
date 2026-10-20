/**
 * Litter Insights: analytics, evidence and staff feedback for the litter
 * severity + littering action models. Read-only over captures; writes only to
 * the litter_feedback table.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");
const {
  LITTERING_ALERT_CONFIDENCE,
  LITTERING_CONFIRM_MIN_FRAMES,
  LITTERING_CONFIRM_WINDOW_MS,
  LITTERING_STRONG_CONFIDENCE,
  LITTER_RISE_DELTA,
  LITTER_RISE_WINDOW_MS,
} = require("../config/env");
const { ADD_BIN_STREAK, normalizeSeverity, formatBinCode } = require("./litterSeverityUtils");
const { annotateLitteringEpisodes } = require("./litteringConfirmation");
const { buildLitterSummary } = require("./litterInsightsUtils");
const litterBinOutlineService = require("./litterBinOutlineService");

const MAX_DAYS = 90;
const SUMMARY_ROW_LIMIT = 10_000;
const EVIDENCE_MAX = 60;
const SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

const CAPTURE_ATTRS = [
  "id",
  "device_id",
  "captured_at",
  "litter_severity",
  "litter_lsi",
  "litter_detection_count",
  "littering_event_detected",
  "littering_event_count",
  "littering_max_confidence",
];

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

function dbDisabledError() {
  const err = new Error("Database is not enabled — litter insights need stored captures.");
  err.status = 503;
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function clampDays(raw, fallback = 30) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DAYS, Math.max(1, n));
}

function toDeviceId(raw) {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function configSnapshot() {
  return {
    littering_min_confidence: LITTERING_ALERT_CONFIDENCE,
    confirm_min_frames: LITTERING_CONFIRM_MIN_FRAMES,
    confirm_window_seconds: Math.round(LITTERING_CONFIRM_WINDOW_MS / 1000),
    strong_confidence: LITTERING_STRONG_CONFIDENCE,
    add_bin_streak: ADD_BIN_STREAK,
    rise_delta: LITTER_RISE_DELTA,
    rise_window_hours: Math.round(LITTER_RISE_WINDOW_MS / 3_600_000),
  };
}

/** Optional tables: a missing table must not break the page. */
async function safeRows(fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn("[litterInsights] optional query skipped:", err.message);
    return [];
  }
}

async function getSummary({ days, deviceId, tzOffsetMin } = {}) {
  const models = ensureModels();
  if (!models) throw dbDisabledError();
  const { Capture, Device, LitterFeedback } = models;

  const rangeDays = clampDays(days);
  const now = Date.now();
  const since = new Date(now - rangeDays * 86_400_000);
  const device = toDeviceId(deviceId);

  const where = {
    captured_at: { [Op.gte]: since },
    [Op.or]: [
      { litter_lsi: { [Op.ne]: null } },
      { littering_event_detected: true },
    ],
  };
  if (device) where.device_id = device;

  const [captures, devices, outlines, feedback] = await Promise.all([
    Capture.findAll({
      where,
      order: [["captured_at", "ASC"]],
      limit: SUMMARY_ROW_LIMIT,
      attributes: CAPTURE_ATTRS,
      raw: true,
    }),
    Device.findAll({
      attributes: ["id", "name", "location", "address", "latitude", "longitude"],
      raw: true,
    }),
    safeRows(() => litterBinOutlineService.listOutlines()),
    safeRows(() =>
      LitterFeedback.findAll({
        where: {
          created_at: { [Op.gte]: since },
          ...(device ? { device_id: device } : {}),
        },
        raw: true,
      })
    ),
  ]);

  const tz = Number(tzOffsetMin);
  const summary = buildLitterSummary({
    captures,
    devices,
    outlines,
    feedback,
    days: rangeDays,
    tzOffsetMin: Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0,
    now,
  });
  return {
    ...summary,
    truncated: captures.length >= SUMMARY_ROW_LIMIT,
    config: configSnapshot(),
  };
}

function evidenceWhere(type, since, device) {
  const where = { captured_at: { [Op.gte]: since } };
  if (device) where.device_id = device;
  if (type === "high") {
    where.litter_severity = "HIGH";
  } else if (type === "all") {
    where[Op.or] = [
      { litter_lsi: { [Op.ne]: null } },
      { littering_event_detected: true },
    ];
  } else {
    where.littering_event_detected = true;
    where.littering_max_confidence = { [Op.gte]: LITTERING_ALERT_CONFIDENCE };
  }
  return where;
}

async function listEvidence({ type = "littering", days, deviceId, limit } = {}) {
  const models = ensureModels();
  if (!models) throw dbDisabledError();
  const { Capture, Device, Prediction, LitterFeedback } = models;

  const kind = ["littering", "high", "all"].includes(type) ? type : "littering";
  const rangeDays = clampDays(days, 7);
  const since = new Date(Date.now() - rangeDays * 86_400_000);
  const device = toDeviceId(deviceId);
  const lim = Math.min(EVIDENCE_MAX, Math.max(1, parseInt(limit, 10) || 24));

  const rows = await Capture.findAll({
    where: evidenceWhere(kind, since, device),
    order: [["captured_at", "DESC"]],
    limit: lim,
    attributes: CAPTURE_ATTRS,
    include: [
      {
        model: Prediction,
        as: "predictions",
        required: false,
        where: { model_type: ["littering_action", "litter"] },
        attributes: ["label", "confidence", "box_x1", "box_y1", "box_x2", "box_y2", "model_type"],
      },
      {
        model: Device,
        as: "device",
        required: false,
        attributes: ["id", "name", "location", "address"],
      },
    ],
  });
  const items = rows.map((r) => r.toJSON());

  const deviceIds = [...new Set(items.map((c) => c.device_id).filter((d) => d != null))];
  const litteringFrames = deviceIds.length
    ? await Capture.findAll({
        where: {
          device_id: deviceIds,
          littering_event_detected: true,
          captured_at: { [Op.gte]: since },
        },
        attributes: ["id", "device_id", "captured_at", "littering_event_detected", "littering_max_confidence"],
        order: [["captured_at", "DESC"]],
        limit: 2000,
        raw: true,
      })
    : [];
  const episodes = annotateLitteringEpisodes([
    ...litteringFrames,
    ...items.filter((c) => c.device_id == null),
  ]);

  const captureIds = items.map((c) => c.id);
  const feedbackRows = captureIds.length
    ? await safeRows(() =>
        LitterFeedback.findAll({ where: { capture_id: captureIds }, raw: true })
      )
    : [];
  const feedbackByCapture = new Map();
  for (const f of feedbackRows) {
    if (!feedbackByCapture.has(f.capture_id)) feedbackByCapture.set(f.capture_id, {});
    feedbackByCapture.get(f.capture_id)[f.model] = {
      verdict: f.verdict,
      predicted_label: f.predicted_label,
      corrected_label: f.corrected_label,
      note: f.note,
      updated_at: f.updated_at || f.updatedAt,
    };
  }

  return {
    type: kind,
    days: rangeDays,
    items: items.map((c) => {
      const ep = episodes.get(c.id);
      return {
        capture_id: c.id,
        device_id: c.device_id,
        bin_code: formatBinCode(c.device_id),
        bin_name: c.device?.name || null,
        location: c.device?.location || c.device?.address || null,
        captured_at: c.captured_at,
        image_path: `/captures/${c.id}/image`,
        littering: {
          detected: Boolean(c.littering_event_detected),
          count: Number(c.littering_event_count) || 0,
          max_confidence: Number(c.littering_max_confidence) || 0,
          episode_frames: ep?.episode_frames ?? 0,
          confirmed: Boolean(ep?.episode_confirmed),
        },
        litter: {
          severity: normalizeSeverity(c.litter_severity) || null,
          lsi: c.litter_lsi != null ? Number(c.litter_lsi) : null,
          count: Number(c.litter_detection_count) || 0,
        },
        boxes: (c.predictions || []).map((p) => ({
          label: p.label,
          confidence: Number(p.confidence) || 0,
          box: [p.box_x1, p.box_y1, p.box_x2, p.box_y2].map(Number),
          model_type: p.model_type,
        })),
        feedback: feedbackByCapture.get(c.id) || {},
      };
    }),
  };
}

/**
 * @param {{ captureId, model: "severity"|"action", verdict?, correctedLabel?, note?, userId? }} input
 */
async function saveFeedback({ captureId, model, verdict, correctedLabel, note, userId } = {}) {
  const models = ensureModels();
  if (!models) throw dbDisabledError();
  const { Capture, LitterFeedback } = models;

  const id = parseInt(captureId, 10);
  if (!Number.isFinite(id)) throw badRequest("capture_id is required.");
  if (model !== "severity" && model !== "action") {
    throw badRequest("model must be 'severity' or 'action'.");
  }

  const capture = await Capture.findByPk(id, { attributes: CAPTURE_ATTRS });
  if (!capture) {
    const err = new Error("Capture not found.");
    err.status = 404;
    throw err;
  }

  let predicted;
  let corrected = null;
  let finalVerdict;
  if (model === "severity") {
    predicted = normalizeSeverity(capture.litter_severity) || null;
    if (!predicted) throw badRequest("This capture has no litter severity result.");
    corrected = normalizeSeverity(correctedLabel);
    if (!SEVERITIES.has(corrected)) {
      throw badRequest("corrected_label must be LOW, MEDIUM or HIGH.");
    }
    finalVerdict = corrected === predicted ? "correct" : "incorrect";
  } else {
    predicted = capture.littering_event_detected ? "littering" : "clear";
    if (verdict !== "correct" && verdict !== "incorrect") {
      throw badRequest("verdict must be 'correct' or 'incorrect'.");
    }
    finalVerdict = verdict;
    corrected =
      verdict === "correct" ? predicted : predicted === "littering" ? "clear" : "littering";
  }

  const values = {
    capture_id: id,
    device_id: capture.device_id,
    model,
    verdict: finalVerdict,
    predicted_label: predicted,
    corrected_label: corrected,
    note: note ? String(note).slice(0, 1000) : null,
    user_id: userId || null,
  };
  const existing = await LitterFeedback.findOne({ where: { capture_id: id, model } });
  const row = existing ? await existing.update(values) : await LitterFeedback.create(values);
  return row.toJSON();
}

/** Labelled samples for retraining, newest first. */
async function exportFeedback({ days } = {}) {
  const models = ensureModels();
  if (!models) throw dbDisabledError();
  const since = new Date(Date.now() - clampDays(days, MAX_DAYS) * 86_400_000);
  return models.LitterFeedback.findAll({
    where: { created_at: { [Op.gte]: since } },
    order: [["created_at", "DESC"]],
    limit: 5000,
    raw: true,
  });
}

module.exports = {
  getSummary,
  listEvidence,
  saveFeedback,
  exportFeedback,
  configSnapshot,
};
