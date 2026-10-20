/**
 * /litter-insights — analytics, evidence, feedback and bin outlines for the
 * litter severity + littering action models.
 */

const litterInsightsService = require("../services/litterInsightsService");
const litterBinOutlineService = require("../services/litterBinOutlineService");
const litterAlertSettingsService = require("../services/litterAlertSettingsService");

function sendError(res, err, next) {
  if (err && Number(err.status) >= 400 && Number(err.status) < 600) {
    return res.status(err.status).json({ error: err.message });
  }
  return next(err);
}

async function summary(req, res, next) {
  try {
    const data = await litterInsightsService.getSummary({
      days: req.query.days,
      deviceId: req.query.device_id,
      tzOffsetMin: req.query.tz_offset,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function evidence(req, res, next) {
  try {
    const data = await litterInsightsService.listEvidence({
      type: req.query.type,
      days: req.query.days,
      deviceId: req.query.device_id,
      limit: req.query.limit,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function feedback(req, res, next) {
  try {
    const body = req.body || {};
    const row = await litterInsightsService.saveFeedback({
      captureId: body.capture_id,
      model: body.model,
      verdict: body.verdict,
      correctedLabel: body.corrected_label,
      note: body.note,
      userId: req.user?.id,
    });
    return res.json({ feedback: row });
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function feedbackExport(req, res, next) {
  try {
    const rows = await litterInsightsService.exportFeedback({ days: req.query.days });
    return res.json({ feedback: rows });
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function listOutlines(_req, res, next) {
  try {
    const rows = await litterBinOutlineService.listOutlines();
    return res.json({
      outlines: rows.map((r) => ({
        device_id: r.device_id,
        bin_polygon: r.bin_polygon,
        updated_at: r.updatedAt || r.updated_at,
      })),
    });
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function getOutline(req, res, next) {
  try {
    const row = await litterBinOutlineService.getOutline(req.params.deviceId);
    return res.json({
      device_id: Number(req.params.deviceId),
      bin_polygon: row?.bin_polygon || null,
      updated_at: row ? row.updatedAt || row.updated_at : null,
    });
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function saveOutline(req, res, next) {
  try {
    const row = await litterBinOutlineService.saveOutline(
      req.params.deviceId,
      req.body?.points,
      req.user?.id
    );
    return res.json({
      device_id: row.device_id,
      bin_polygon: row.bin_polygon,
      updated_at: row.updatedAt || row.updated_at,
    });
  } catch (err) {
    return sendError(res, err, next);
  }
}

async function deleteOutline(req, res, next) {
  try {
    const removed = await litterBinOutlineService.deleteOutline(req.params.deviceId);
    return res.json({ removed });
  } catch (err) {
    return sendError(res, err, next);
  }
}

function getAlertSettings(_req, res) {
  return res.json(litterAlertSettingsService.getPublicSettings());
}

function saveAlertSettings(req, res, next) {
  try {
    return res.json(litterAlertSettingsService.saveSettings(req.body));
  } catch (err) {
    return sendError(res, err, next);
  }
}

module.exports = {
  getAlertSettings,
  saveAlertSettings,
  summary,
  evidence,
  feedback,
  feedbackExport,
  listOutlines,
  getOutline,
  saveOutline,
  deleteOutline,
};
