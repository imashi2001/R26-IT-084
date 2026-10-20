/**
 * Per-bin outline used by the litter severity model to ignore rubbish that is
 * inside the bin. Points are fractions of the image ([[x, y], ...], 0–1).
 */

const db = require("../config/db");
const modelsRegistry = require("../models");

const MAX_POINTS = 40;
const CACHE_TTL_MS = 60_000;

/** @type {Map<number, { at: number, polygon: number[][] | null }>} */
const cache = new Map();

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Validate + round an outline. Throws 400 errors with a readable message. */
function normalizePolygon(points) {
  if (!Array.isArray(points) || points.length < 3) {
    throw badRequest("Outline needs at least 3 points.");
  }
  if (points.length > MAX_POINTS) {
    throw badRequest(`Outline can have at most ${MAX_POINTS} points.`);
  }
  return points.map((p, i) => {
    const x = Number(Array.isArray(p) ? p[0] : p?.x);
    const y = Number(Array.isArray(p) ? p[1] : p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      throw badRequest(`Point ${i + 1} must have x and y between 0 and 1.`);
    }
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
  });
}

function toDeviceId(raw) {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getOutline(deviceId) {
  const models = ensureModels();
  const id = toDeviceId(deviceId);
  if (!models || !id) return null;
  const row = await models.LitterBinConfig.findOne({ where: { device_id: id } });
  return row ? row.toJSON() : null;
}

async function listOutlines() {
  const models = ensureModels();
  if (!models) return [];
  const rows = await models.LitterBinConfig.findAll();
  return rows.map((r) => r.toJSON());
}

async function saveOutline(deviceId, points, userId = null) {
  const models = ensureModels();
  const id = toDeviceId(deviceId);
  if (!models) {
    const err = new Error("Database is not enabled.");
    err.status = 503;
    throw err;
  }
  if (!id) throw badRequest("Invalid bin id.");
  const polygon = normalizePolygon(points);

  const device = await models.Device.findByPk(id, { attributes: ["id"] });
  if (!device) {
    const err = new Error("Bin not found.");
    err.status = 404;
    throw err;
  }

  const { LitterBinConfig } = models;
  const existing = await LitterBinConfig.findOne({ where: { device_id: id } });
  const row = existing
    ? await existing.update({ bin_polygon: polygon, updated_by_user_id: userId })
    : await LitterBinConfig.create({
        device_id: id,
        bin_polygon: polygon,
        updated_by_user_id: userId,
      });
  cache.delete(id);
  return row.toJSON();
}

async function deleteOutline(deviceId) {
  const models = ensureModels();
  const id = toDeviceId(deviceId);
  if (!models || !id) return false;
  const n = await models.LitterBinConfig.destroy({ where: { device_id: id } });
  cache.delete(id);
  return n > 0;
}

/**
 * Outline for /predict. Never throws: a missing table or DB error just means
 * "no outline", so model inference is never blocked by this feature.
 */
async function polygonForDevice(deviceId) {
  const id = toDeviceId(deviceId);
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.polygon;
  try {
    const row = await getOutline(id);
    const polygon =
      Array.isArray(row?.bin_polygon) && row.bin_polygon.length >= 3
        ? row.bin_polygon
        : null;
    cache.set(id, { at: Date.now(), polygon });
    return polygon;
  } catch (err) {
    console.warn("[litterOutline] lookup skipped:", err.message);
    cache.set(id, { at: Date.now(), polygon: null });
    return null;
  }
}

module.exports = {
  MAX_POINTS,
  normalizePolygon,
  getOutline,
  listOutlines,
  saveOutline,
  deleteOutline,
  polygonForDevice,
};
