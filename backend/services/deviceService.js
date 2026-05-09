/**
 * Device CRUD and map-oriented queries (requires Sequelize models).
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

async function listDevices() {
  const models = ensureModels();
  if (!models) return [];
  const { Device } = models;
  const rows = await Device.findAll({ order: [["id", "ASC"]] });
  return rows.map((r) => r.toJSON());
}

async function getDeviceById(id) {
  const models = ensureModels();
  if (!models) return null;
  const { Device } = models;
  const row = await Device.findByPk(id);
  return row ? row.toJSON() : null;
}

async function createDevice(payload) {
  const models = ensureModels();
  if (!models) return null;
  const { Device } = models;
  const row = await Device.create(payload);
  return row.toJSON();
}

async function updateDevice(id, patch) {
  const models = ensureModels();
  if (!models) return null;
  const { Device } = models;
  const row = await Device.findByPk(id);
  if (!row) return null;
  await row.update(patch);
  return row.toJSON();
}

async function findDeviceIdByEsp32Id(esp32Id) {
  const models = ensureModels();
  if (!models || !esp32Id) return null;
  const { Device } = models;
  const row = await Device.findOne({
    where: { esp32_id: esp32Id },
  });
  return row ? row.id : null;
}

async function getLatestCaptureForDevice(deviceId) {
  const models = ensureModels();
  if (!models) return null;
  const { Capture, Prediction } = models;
  const row = await Capture.findOne({
    where: { device_id: deviceId },
    order: [["captured_at", "DESC"]],
    include: [{ model: Prediction, as: "predictions" }],
  });
  return row ? row.toJSON() : null;
}

async function listDevicesWithCoordinates() {
  const models = ensureModels();
  if (!models) return [];
  const { Device } = models;
  const rows = await Device.findAll({
    where: {
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null },
    },
    order: [["id", "ASC"]],
  });

  return rows
    .map((r) => r.toJSON())
    .filter(
      (d) =>
        Number.isFinite(Number(d.latitude)) &&
        Number.isFinite(Number(d.longitude))
    );
}

module.exports = {
  ensureModels,
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  findDeviceIdByEsp32Id,
  getLatestCaptureForDevice,
  listDevicesWithCoordinates,
};
