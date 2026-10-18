/**
 * captureService - persistence helper for image captures and their predictions.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

/**
 * @param {object} payload
 * @param {string|null} payload.bridgeInstanceId laptop bridge UUID (audit + device binding)
 * @param {object|null} payload.extras optional Capture columns (waste/animal/risk/weather)
 */
async function saveCaptureWithPredictions({
  modelName,
  imageUrl = null,
  imageBuffer = null,
  imageMimetype = null,
  fillLevel = null,
  userId = null,
  deviceId = null,
  bridgeInstanceId = null,
  predictions = [],
  extras = null,
}) {
  const models = ensureModels();
  if (!models) return null;

  const { sequelize, Capture, Prediction } = models;

  const safeExtras = sanitizeCaptureExtras(extras);
  const predRows = sanitizePredictionRows(predictions);

  try {
    return await sequelize.transaction(async (t) => {
      const capture = await Capture.create(
        {
          user_id: userId,
          device_id: deviceId,
          bridge_instance_id: bridgeInstanceId,
          image_url: imageUrl,
          image_buffer: imageBuffer,
          image_mimetype: imageMimetype,
          fill_level: fillLevel ? String(fillLevel).slice(0, 40) : null,
          model_name: String(modelName || "waste+animal").slice(0, 60),
          captured_at: new Date(),
          ...safeExtras,
        },
        { transaction: t }
      );

      if (predRows.length > 0) {
        await Prediction.bulkCreate(
          predRows.map((p) => ({ ...p, capture_id: capture.id })),
          { transaction: t }
        );
      }

      return capture;
    });
  } catch (err) {
    console.error(
      "[capture] full persist failed, saving image only:",
      err.message
    );
    return Capture.create({
      user_id: userId,
      device_id: deviceId,
      bridge_instance_id: bridgeInstanceId,
      image_url: imageUrl,
      image_buffer: imageBuffer,
      image_mimetype: imageMimetype,
      fill_level: fillLevel ? String(fillLevel).slice(0, 40) : null,
      model_name: String(modelName || "waste+animal").slice(0, 60),
      captured_at: new Date(),
      source_type: safeExtras?.source_type || null,
    });
  }
}

function clip(value, max) {
  if (value == null || value === "") return null;
  return String(value).slice(0, max);
}

function sanitizeCaptureExtras(extras) {
  if (!extras || typeof extras !== "object") return null;
  return {
    waste_label: clip(extras.waste_label, 40),
    waste_confidence: finiteOrNull(extras.waste_confidence),
    animal_count: intOrNull(extras.animal_count),
    risk_level: clip(extras.risk_level, 20),
    risk_case: clip(extras.risk_case, 60),
    rotting_hours: finiteOrNull(extras.rotting_hours),
    temp_c: finiteOrNull(extras.temp_c),
    humidity_pct: finiteOrNull(extras.humidity_pct),
    weather_condition: clip(extras.weather_condition, 80),
    source_type: clip(extras.source_type, 16),
    latitude: finiteOrNull(extras.latitude),
    longitude: finiteOrNull(extras.longitude),
    fill_percentage: finiteOrNull(extras.fill_percentage),
    prediction_class: clip(extras.prediction_class, 160),
    littering_event_detected:
      extras.littering_event_detected == null
        ? null
        : Boolean(extras.littering_event_detected),
    littering_event_count: intOrNull(extras.littering_event_count),
    littering_max_confidence: finiteOrNull(extras.littering_max_confidence),
    littering_action_summary: extras.littering_action_summary
      ? {
          event_detected: Boolean(extras.littering_action_summary.event_detected),
          event_count: Number(extras.littering_action_summary.event_count) || 0,
          max_confidence:
            Number(extras.littering_action_summary.max_confidence) || 0,
        }
      : null,
    litter_severity: clip(extras.litter_severity, 16),
    litter_lsi: finiteOrNull(extras.litter_lsi),
    litter_detection_count: intOrNull(extras.litter_detection_count),
    litter_severity_summary: extras.litter_severity_summary || null,
  };
}

function sanitizePredictionRows(predictions) {
  if (!Array.isArray(predictions)) return [];
  return predictions
    .map((p) => {
      const box = Array.isArray(p.box) ? p.box.map(Number) : [0, 0, 0, 0];
      const label = clip(p.label || "?", 80);
      if (!label) return null;
      return {
        label,
        confidence: Number.isFinite(Number(p.confidence))
          ? Number(p.confidence)
          : 0,
        box_x1: Number.isFinite(box[0]) ? box[0] : 0,
        box_y1: Number.isFinite(box[1]) ? box[1] : 0,
        box_x2: Number.isFinite(box[2]) ? box[2] : 0,
        box_y2: Number.isFinite(box[3]) ? box[3] : 0,
        model_type: clip(p.model_type, 40),
      };
    })
    .filter(Boolean);
}

function finiteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function listCaptures({
  limit = 20,
  offset = 0,
  userId = null,
  deviceId = null,
  since = null,
  until = null,
} = {}) {
  const models = ensureModels();
  if (!models) return [];

  const { Capture, Prediction } = models;

  const where = {};
  if (userId !== null) where.user_id = userId;
  if (deviceId !== null && Number.isFinite(Number(deviceId))) {
    where.device_id = Number(deviceId);
  }

  const range = {};
  if (since instanceof Date && !Number.isNaN(since.getTime())) {
    range[Op.gte] = since;
  }
  if (until instanceof Date && !Number.isNaN(until.getTime())) {
    range[Op.lte] = until;
  }
  if (Object.getOwnPropertySymbols(range).length > 0) {
    where.captured_at = range;
  }

  const rows = await Capture.findAll({
    where,
    order: [["captured_at", "DESC"]],
    limit,
    offset,
    include: [{ model: Prediction, as: "predictions" }],
  });

  return rows.map((c) => c.toJSON());
}

async function getCapture(id) {
  const models = ensureModels();
  if (!models) return null;

  const { Capture, Prediction } = models;

  const row = await Capture.findByPk(id, {
    include: [{ model: Prediction, as: "predictions" }],
  });
  return row ? row.toJSON() : null;
}

async function updateCaptureAnalysis(
  id,
  { modelName, fillLevel = null, extras = null, predictions = [] } = {}
) {
  const models = ensureModels();
  if (!models || !id) return null;
  const { sequelize, Capture, Prediction } = models;
  const safeExtras = sanitizeCaptureExtras(extras);
  const predRows = sanitizePredictionRows(predictions);

  return sequelize.transaction(async (t) => {
    const row = await Capture.findByPk(id, { transaction: t });
    if (!row) return null;
    await row.update(
      {
        model_name: modelName
          ? String(modelName).slice(0, 60)
          : row.model_name,
        fill_level: fillLevel ? String(fillLevel).slice(0, 40) : row.fill_level,
        ...(safeExtras || {}),
      },
      { transaction: t }
    );
    if (predRows.length > 0) {
      await Prediction.destroy({
        where: { capture_id: id },
        transaction: t,
      });
      await Prediction.bulkCreate(
        predRows.map((p) => ({ ...p, capture_id: id })),
        { transaction: t }
      );
    }
    return row;
  });
}

module.exports = {
  saveCaptureWithPredictions,
  updateCaptureAnalysis,
  listCaptures,
  getCapture,
};
