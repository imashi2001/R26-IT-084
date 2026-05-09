/**
 * captureService - persistence helper for image captures and their predictions.
 *
 * All functions are no-ops if the DB is not enabled, so callers can stay
 * unconditional and the predict flow keeps working without Postgres.
 */

const db = require("../config/db");
const modelsRegistry = require("../models");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

/**
 * Save one capture (image + metadata) plus its predictions in a transaction.
 *
 * @param {object} payload
 * @param {string} payload.modelName
 * @param {string|null} payload.imageUrl  (external URL or null)
 * @param {Buffer|null} payload.imageBuffer  (persisted when DB enabled)
 * @param {string|null} payload.imageMimetype
 * @param {string|null} payload.fillLevel  (Empty | Half | Overflow)
 * @param {number|null} payload.userId
 * @param {number|null} payload.deviceId
 * @param {Array<{label:string, confidence:number, box:number[]}>} payload.predictions
 *
 * @returns {Promise<object|null>} the created Capture (with predictions) or null
 */
async function saveCaptureWithPredictions({
  modelName,
  imageUrl = null,
  imageBuffer = null,
  imageMimetype = null,
  fillLevel = null,
  userId = null,
  deviceId = null,
  predictions = [],
}) {
  const models = ensureModels();
  if (!models) return null;

  const { sequelize, Capture, Prediction } = models;

  return sequelize.transaction(async (t) => {
    const capture = await Capture.create(
      {
        user_id: userId,
        device_id: deviceId,
        image_url: imageUrl,
        image_buffer: imageBuffer,
        image_mimetype: imageMimetype,
        fill_level: fillLevel,
        model_name: modelName,
        captured_at: new Date(),
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
      }));
      await Prediction.bulkCreate(rows, { transaction: t });
    }

    return capture;
  });
}

async function listCaptures({ limit = 20, offset = 0, userId = null } = {}) {
  const models = ensureModels();
  if (!models) return [];

  const { Capture, Prediction } = models;

  const where = {};
  if (userId !== null) where.user_id = userId;

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
