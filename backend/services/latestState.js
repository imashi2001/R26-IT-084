/**
 * latestState - in-memory latest capture per device (+ global mirror).
 *
 * Global snapshot keeps legacy GET /latest working for single-bin demos.
 * Per-device entries power GET /devices/:id/image/latest when DB is empty or cold.
 */

/** @type {Map<number, object>} */
const byDeviceId = new Map();

/** @type {object|null} */
let globalLatest = null;

function buildSnapshot({
  deviceId,
  imageBuffer,
  mimetype,
  filename,
  modelName,
  predictions,
  extras,
}) {
  return {
    timestamp: new Date().toISOString(),
    deviceId: deviceId != null ? Number(deviceId) : null,
    image: {
      buffer: imageBuffer,
      mimetype: mimetype || "image/jpeg",
      filename: filename || "latest.jpg",
      bytes: imageBuffer ? imageBuffer.length : 0,
    },
    model: modelName,
    predictions: Array.isArray(predictions) ? predictions : [],
    extras: extras || null,
  };
}

function setLatest({
  deviceId = null,
  imageBuffer,
  mimetype,
  filename,
  modelName,
  predictions,
  extras = null,
}) {
  const snapshot = buildSnapshot({
    deviceId,
    imageBuffer,
    mimetype,
    filename,
    modelName,
    predictions,
    extras,
  });

  globalLatest = snapshot;

  if (deviceId != null && deviceId !== "") {
    const id =
      typeof deviceId === "number" ? deviceId : parseInt(deviceId, 10);
    if (Number.isFinite(id)) {
      byDeviceId.set(id, snapshot);
    }
  }
}

function getLatest() {
  return globalLatest;
}

function getLatestForDevice(deviceId) {
  const id =
    typeof deviceId === "number" ? deviceId : parseInt(deviceId, 10);
  if (!Number.isFinite(id)) return null;
  return byDeviceId.get(id) || null;
}

function clearLatest() {
  globalLatest = null;
  byDeviceId.clear();
}

module.exports = { setLatest, getLatest, getLatestForDevice, clearLatest };
