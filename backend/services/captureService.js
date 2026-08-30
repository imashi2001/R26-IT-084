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

  return sequelize.transaction(async (t) => {
    const capture = await Capture.create(
      {
        user_id: userId,
        device_id: deviceId,
        bridge_instance_id: bridgeInstanceId,
        image_url: imageUrl,
        image_buffer: imageBuffer,
        image_mimetype: imageMimetype,
        fill_level: fillLevel,
        model_name: modelName,
        captured_at: new Date(),
        ...(extras || {}),
      },
      { transaction: t }
    );

    if (predictions.length > 0) {
      const rows = predictions.map((p) => ({
        capture_id: capture.id,
        label: p.label,
        confidence: p.confidence,
        box_x1: Array.isArray(p.box) ? p.box[0] : 0,
        box_y1: Array.isArray(p.box) ? p.box[1] : 0,
        box_x2: Array.isArray(p.box) ? p.box[2] : 0,
        box_y2: Array.isArray(p.box) ? p.box[3] : 0,
        model_type: p.model_type || null,
      }));
      await Prediction.bulkCreate(rows, { transaction: t });
    }

    return capture;
  });
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

module.exports = {
  saveCaptureWithPredictions,
  listCaptures,
  getCapture,
};
