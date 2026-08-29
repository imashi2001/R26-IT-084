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

async function findDeviceIdForPredict(
  esp32Id,
  incomingBridgeRaw,
  { bypassBridgeCheck = false } = {}
) {
  const models = ensureModels();
  if (!models || !esp32Id) return null;

  const { Device } = models;
  const row = await Device.findOne({
    where: { esp32_id: esp32Id },
  });
  if (!row) return null;

  const incoming = incomingBridgeRaw
    ? String(incomingBridgeRaw).trim()
    : "";
  const bound = row.bridge_instance_id
    ? String(row.bridge_instance_id).trim()
    : "";

  // Bin locked to a laptop: incoming bridge must match (unless direct ESP32/mobile/admin).
  if (bound && bound !== incoming && !bypassBridgeCheck) {
    return null;
  }

  return row.id;
}

async function findDeviceByEsp32Id(esp32Id) {
  const models = ensureModels();
  if (!models || !esp32Id) return null;
  const { Device } = models;
  const row = await Device.findOne({
    where: { esp32_id: String(esp32Id).trim() },
  });
  return row ? row.toJSON() : null;
}

/**
 * Find a device with a pending speaker action for this laptop + optional esp32_id.
 */
async function findPendingSpeakerCommand({ bridgeInstanceId, esp32Id }) {
  const models = ensureModels();
  if (!models) return null;
  const { Device } = models;

  const where = {
    pending_speaker_action: { [Op.in]: ["test", "alarm"] },
  };
  if (esp32Id) {
    where.esp32_id = String(esp32Id).trim();
  }
  if (bridgeInstanceId) {
    const bridge = String(bridgeInstanceId).trim();
    where[Op.or] = [
      { bridge_instance_id: null },
      { bridge_instance_id: "" },
      { bridge_instance_id: bridge },
    ];
  }

  const row = await Device.findOne({
    where,
    order: [["pending_speaker_at", "ASC"]],
  });
  return row ? row.toJSON() : null;
}

async function clearPendingSpeakerAction(deviceId) {
  return updateDevice(deviceId, {
    pending_speaker_action: null,
    pending_speaker_at: null,
  });
}

async function enqueueSpeakerAction(deviceId, action) {
  const a = String(action || "").trim().toLowerCase();
  if (a !== "test" && a !== "alarm") return null;
  return updateDevice(deviceId, {
    pending_speaker_action: a,
    pending_speaker_at: new Date(),
  });
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
  findDeviceIdForPredict,
  findDeviceByEsp32Id,
  findPendingSpeakerCommand,
  clearPendingSpeakerAction,
  enqueueSpeakerAction,
  getLatestCaptureForDevice,
  listDevicesWithCoordinates,
};
