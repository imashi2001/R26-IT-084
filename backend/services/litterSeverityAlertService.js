/**
 * Litter severity alerts: HIGH LSI and continuous add-bin recommendation.
 *
 * Runs after every analysed photo (called from predict.controller.js) and
 * creates at most ONE alert per photo, checked in this order:
 *
 *   1. "Add a new bin at this location" — last 3 captures HIGH litter (or 3
 *      littering events in a row). Max once per bin per LITTER_ADD_BIN_COOLDOWN.
 *   2. If this photo is NOT HIGH: "Litter building up" — it is MEDIUM and LSI
 *      jumped by LITTER_RISE_DELTA within LITTER_RISE_WINDOW (early warning).
 *   3. If this photo IS HIGH: "High litter severity". Max once per bin per cooldown.
 *
 * Cooldowns stop the same bin from flooding the Alerts page.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");
const {
  LITTERING_ALERT_COOLDOWN_MS,
  LITTER_ADD_BIN_COOLDOWN_MS,
  LITTER_RISE_DELTA,
  LITTER_RISE_WINDOW_MS,
  LITTER_RISE_COOLDOWN_MS,
} = require("../config/env");
const {
  isHighSeverity,
  qualifiesForAddBinAlert,
  trailingHighLitterStreak,
  trailingLitteringEventStreak,
  detectLitterRise,
  formatBinCode,
  ADD_BIN_STREAK,
} = require("./litterSeverityUtils");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

/** The bin's newest captures (only the litter columns), newest first — used for streak checks. */
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

/** Alert text, e.g. "BIN-03 · Market Rd · HIGH litter around the bin on 3 captures in a row. …" */
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
 * Early warning: compare this MEDIUM reading with the lowest LSI from the same
 * bin in the last few hours. A big jump means litter is piling up fast, so
 * staff can clean before it becomes HIGH.
 */
async function maybeCreateRisingAlert({
  models,
  captureId,
  deviceId,
  device,
  litterPayload,
}) {
  const { Alert, Capture } = models;
  const now = Date.now();
  // Earlier LSI readings from this bin inside the window (this photo excluded).
  const earlier = await Capture.findAll({
    where: {
      device_id: deviceId,
      captured_at: { [Op.gte]: new Date(now - LITTER_RISE_WINDOW_MS) },
      litter_lsi: { [Op.ne]: null },
      ...(captureId ? { id: { [Op.ne]: captureId } } : {}),
    },
    order: [["captured_at", "ASC"]],
    limit: 200,
    attributes: ["id", "captured_at", "litter_lsi"],
  });
  const rise = detectLitterRise(
    earlier.map((r) => r.toJSON()),
    litterPayload,
    { delta: LITTER_RISE_DELTA }
  );
  if (!rise) return null;

  // Cooldown: one "building up" alert per bin per LITTER_RISE_COOLDOWN.
  const recent = await Alert.findOne({
    where: {
      device_id: deviceId,
      alert_type: "litter_rising",
      created_at: { [Op.gte]: new Date(now - LITTER_RISE_COOLDOWN_MS) },
    },
  });
  if (recent) return null;

  const hours = Math.max(
    0.1,
    (now - new Date(rise.from_at).getTime()) / 3600000
  );
  const location =
    (device?.location || device?.address || device?.name || "").toString().trim();
  const row = await Alert.create({
    capture_id: captureId,
    device_id: deviceId,
    alert_type: "litter_rising",
    severity: "info",
    title: "Litter building up",
    summary: `${formatBinCode(deviceId)}${location ? ` · ${location}` : ""} · LSI rose from ${rise.from_lsi.toFixed(1)} to ${rise.to_lsi.toFixed(1)} in ${hours.toFixed(1)}h. Clean before it reaches HIGH.`,
    status: "open",
  });
  return row.toJSON();
}

/**
 * Entry point, called once per analysed photo.
 * @param {{ captureId: number|null, deviceId: number|null, device: object|null, litterPayload: object|null, litteringAction: object|null }} input
 *   litterPayload = reply from litter-severity-api for this photo
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

  // A photo can own only one alert (alerts.capture_id is unique), e.g. the
  // littering alert may already have used it.
  if (captureId) {
    const existingForCapture = await Alert.findOne({
      where: { capture_id: captureId },
    });
    if (existingForCapture) return existingForCapture.toJSON();
  }

  // Manual uploads with no bin cannot have streaks or cooldowns.
  if (!deviceId) return null;

  // --- 1. Add a new bin (strongest signal, checked first) ---------------------
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

  // --- 2. Not HIGH → maybe an early "building up" warning ---------------------
  if (!hasHigh) {
    return maybeCreateRisingAlert({
      models,
      captureId,
      deviceId,
      device,
      litterPayload,
    });
  }

  // --- 3. HIGH litter on this photo (respecting the per-bin cooldown) --------
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
