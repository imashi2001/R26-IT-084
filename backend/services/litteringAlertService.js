/**
 * Littering-event alerts with per-device cooldown (does not affect risk engine).
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");
const {
  LITTERING_ALERT_CONFIDENCE,
  LITTERING_ALERT_COOLDOWN_MS,
} = require("../config/env");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

/**
 * @param {{ captureId: number|null, deviceId: number|null, litteringAction: object|null }} input
 */
async function maybeCreateLitteringAlert({
  captureId,
  deviceId,
  litteringAction,
}) {
  const models = ensureModels();
  if (!models || !litteringAction || litteringAction.error) return null;

  if (!litteringAction.event_detected) return null;
  const maxConf = Number(litteringAction.max_confidence) || 0;
  if (maxConf < LITTERING_ALERT_CONFIDENCE) return null;

  const { Alert } = models;

  if (captureId) {
    const existingForCapture = await Alert.findOne({
      where: { capture_id: captureId },
    });
    if (existingForCapture) return existingForCapture.toJSON();
  }

  if (deviceId) {
    const since = new Date(Date.now() - LITTERING_ALERT_COOLDOWN_MS);
    const recent = await Alert.findOne({
      where: {
        device_id: deviceId,
        alert_type: "littering_detected",
        created_at: { [Op.gte]: since },
      },
      order: [["created_at", "DESC"]],
    });
    if (recent) return null;
  }

  const count = Number(litteringAction.event_count) || 0;
  const row = await Alert.create({
    capture_id: captureId,
    device_id: deviceId,
    alert_type: "littering_detected",
    severity: "warning",
    title: "Littering event detected",
    summary: `${count} littering event(s) detected (max confidence ${(maxConf * 100).toFixed(0)}%).`,
    status: "open",
  });

  return row.toJSON();
}

module.exports = {
  maybeCreateLitteringAlert,
};
