/**
 * Littering-event alerts with per-device cooldown (does not affect risk engine).
 *
 * Alerts are raised only for confirmed episodes (see litteringConfirmation.js).
 * The alert is attached to the frame that confirmed the episode so the live
 * path and GET /alerts sync never create two alerts for the same episode.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");
const {
  LITTERING_ALERT_CONFIDENCE,
  LITTERING_ALERT_COOLDOWN_MS,
  LITTERING_CONFIRM_WINDOW_MS,
  LITTERING_STRONG_CONFIDENCE,
} = require("../config/env");
const {
  annotateLitteringEpisodes,
  confirmationOptions,
} = require("./litteringConfirmation");

const EPISODE_LOOKBACK_MS = Math.max(10 * 60 * 1000, LITTERING_CONFIRM_WINDOW_MS * 10);

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

async function recentLitteringFrames(Capture, deviceId) {
  if (!deviceId) return [];
  const rows = await Capture.findAll({
    where: {
      device_id: deviceId,
      littering_event_detected: true,
      captured_at: { [Op.gte]: new Date(Date.now() - EPISODE_LOOKBACK_MS) },
    },
    order: [["captured_at", "DESC"]],
    limit: 60,
    attributes: [
      "id",
      "device_id",
      "captured_at",
      "littering_event_detected",
      "littering_max_confidence",
    ],
  });
  return rows.map((r) => r.toJSON());
}

function confirmationSummary(rec, count, maxConf) {
  const pct = (maxConf * 100).toFixed(0);
  const windowS = Math.round(confirmationOptions().windowMs / 1000);
  const how =
    rec.episode_frames > 1
      ? `confirmed on ${rec.episode_frames} frames within ${windowS}s`
      : `single frame ≥ ${(LITTERING_STRONG_CONFIDENCE * 100).toFixed(0)}% confidence`;
  return `${count} littering event(s) detected (max confidence ${pct}%) · ${how}.`;
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

  const { Alert, Capture } = models;

  const currentFrame = {
    id: captureId ?? "current",
    device_id: deviceId,
    captured_at: new Date().toISOString(),
    littering_event_detected: true,
    littering_max_confidence: maxConf,
  };
  const frames = (await recentLitteringFrames(Capture, deviceId)).filter(
    (f) => f.id !== currentFrame.id
  );
  const stored = captureId ? await Capture.findByPk(captureId, { attributes: ["captured_at"] }) : null;
  if (stored?.captured_at) currentFrame.captured_at = stored.captured_at;
  frames.push(currentFrame);

  const rec = annotateLitteringEpisodes(frames).get(currentFrame.id);
  if (!rec?.episode_confirmed) {
    console.log(
      `[littering] device=${deviceId ?? "-"} capture=${captureId ?? "-"} waiting for confirmation (${rec?.episode_frames ?? 1} frame, ${(maxConf * 100).toFixed(0)}%)`
    );
    return null;
  }

  const alertCaptureId =
    rec.first_confirming_id === "current" ? captureId : rec.first_confirming_id;

  if (alertCaptureId) {
    const existingForCapture = await Alert.findOne({
      where: { capture_id: alertCaptureId },
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
    capture_id: alertCaptureId || null,
    device_id: deviceId,
    alert_type: "littering_detected",
    severity: "warning",
    title: "Littering event detected",
    summary: confirmationSummary(rec, count, rec.episode_max_confidence || maxConf),
    status: "open",
  });

  return row.toJSON();
}

module.exports = {
  maybeCreateLitteringAlert,
};
