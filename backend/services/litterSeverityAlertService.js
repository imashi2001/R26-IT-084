/**
 * Litter severity alerts: HIGH LSI and continuous add-bin recommendation.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");
const {
  LITTERING_ALERT_COOLDOWN_MS,
  LITTER_ADD_BIN_COOLDOWN_MS,
} = require("../config/env");
const {
  isHighSeverity,
  qualifiesForAddBinAlert,
  trailingHighLitterStreak,
  trailingLitteringEventStreak,
  formatBinCode,
  ADD_BIN_STREAK,
} = require("./litterSeverityUtils");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

async function recentCapturesForDevice(deviceId, limit = ADD_BIN_STREAK) {
  const models = ensureModels();
  if (!models || !deviceId) return [];

  const { Capture } = models;
  const rows = await Capture.findAll({
    where: { device_id: deviceId },
    order: [["captured_at", "DESC"]],
    limit,
    attributes: [
      "id",
      "device_id",
      "captured_at",
      "litter_severity",
      "litter_lsi",
      "litter_detection_count",
      "littering_event_detected",
      "littering_event_count",
      "littering_max_confidence",
    ],
  });
  return rows.map((r) => r.toJSON());
}

function buildAddBinSummary(device, captures) {
  const binCode = formatBinCode(device?.id);
  const location =
    (device?.location || device?.address || device?.name || "this location")
      .toString()
      .trim() || "this location";
  const highStreak = trailingHighLitterStreak(captures);
  const eventStreak = trailingLitteringEventStreak(captures);
  const parts = [];
  if (highStreak >= ADD_BIN_STREAK) {
    parts.push(
      `HIGH litter around the bin on ${highStreak} captures in a row`
    );
  }
  if (eventStreak >= ADD_BIN_STREAK) {
    parts.push(`littering events on ${eventStreak} consecutive captures`);
  }
  const detail = parts.length ? parts.join(" · ") : "Repeated litter pressure";
  return `${binCode} · ${location} · ${detail}. Capacity here is not enough — register another bin.`;
}

/**
 * @param {{ captureId: number|null, deviceId: number|null, device: object|null, litterPayload: object|null, litteringAction: object|null }} input
 */
async function maybeCreateLitterSeverityAlerts({
  captureId,
  deviceId,
  device,
  litterPayload,
  litteringAction,
}) {
  const models = ensureModels();
  if (!models) return null;

  const { Alert } = models;
  const severity = (litterPayload?.severity || "").toString().trim().toUpperCase();
  const hasHigh = isHighSeverity(severity);

  if (captureId) {
    const existingForCapture = await Alert.findOne({
      where: { capture_id: captureId },
    });
    if (existingForCapture) return existingForCapture.toJSON();
  }

  if (!deviceId) return null;

  const recent = await recentCapturesForDevice(deviceId, ADD_BIN_STREAK);
  const addBinQualifies = qualifiesForAddBinAlert(recent);

  if (addBinQualifies) {
    const since = new Date(Date.now() - LITTER_ADD_BIN_COOLDOWN_MS);
    const recentAddBin = await Alert.findOne({
      where: {
        device_id: deviceId,
        alert_type: "litter_add_bin",
        created_at: { [Op.gte]: since },
      },
      order: [["created_at", "DESC"]],
    });
    if (!recentAddBin) {
      const row = await Alert.create({
        capture_id: captureId,
        device_id: deviceId,
        alert_type: "litter_add_bin",
        severity: "warning",
        title: "Add a new bin at this location",
        summary: buildAddBinSummary(device, recent),
        status: "open",
      });
      return row.toJSON();
    }
  }

  if (!hasHigh) return null;

  const sinceHigh = new Date(Date.now() - LITTERING_ALERT_COOLDOWN_MS);
  const recentHigh = await Alert.findOne({
    where: {
      device_id: deviceId,
      alert_type: "litter_severity_high",
      created_at: { [Op.gte]: sinceHigh },
    },
    order: [["created_at", "DESC"]],
  });
  if (recentHigh) return null;

  const lsi = Number(litterPayload?.lsi);
  const count =
    Number(litterPayload?.detection_count) ||
    Number(litterPayload?.metrics?.count) ||
    0;
  const row = await Alert.create({
    capture_id: captureId,
    device_id: deviceId,
    alert_type: "litter_severity_high",
    severity: "warning",
    title: "High litter severity",
    summary: `LSI ${Number.isFinite(lsi) ? lsi.toFixed(1) : "—"} · ${count} litter object(s) around the bin${
      litteringAction?.event_detected ? " · littering events detected" : ""
    }.`,
    status: "open",
  });
  return row.toJSON();
}

module.exports = {
  maybeCreateLitterSeverityAlerts,
  recentCapturesForDevice,
  qualifiesForAddBinAlert,
  trailingHighLitterStreak,
};
