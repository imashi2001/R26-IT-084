/**
 * Queue PLAY_AUDIO on ESP32 after /predict when risk warrants it.
 *
 * Track mapping (DFPlayer /MP3/000N.mp3):
 *   HIGH     → track 2
 *   CRITICAL → track 3
 *   LOW/MEDIUM → no auto-play
 *
 * Manual admin Test Audio still uses track 1 via POST /devices/:id/audio-test.
 */

const {
  AUTO_AUDIO_ON_PREDICT,
  AUDIO_TRIGGER_COOLDOWN_MS,
} = require("../config/env");
const deviceCommandService = require("./deviceCommandService");

function trackForRisk(risk) {
  const level = String(risk?.level || "").trim().toUpperCase();
  if (level === "CRITICAL") return 3;
  if (level === "HIGH") return 2;
  return null;
}

/**
 * @param {{ device: object|null, risk: object, sourceType: string }} input
 * @returns {Promise<object|null>} created command API shape, or null if skipped
 */
async function maybeQueueFromPredict({ device, risk, sourceType }) {
  if (!AUTO_AUDIO_ON_PREDICT) return null;
  if (!device?.id || !device?.esp32_id) return null;

  const src = String(sourceType || "").trim().toLowerCase();
  if (src !== "esp32") return null;

  const track = trackForRisk(risk);
  if (!track) return null;

  const esp32Id = String(device.esp32_id).trim();
  const skip = await deviceCommandService.shouldSkipAutoPlay(esp32Id);
  if (skip) return null;

  try {
    const cmd = await deviceCommandService.createPlayAudioCommand(device, {
      track,
    });
    console.log(
      `[audioTrigger] queued PLAY_AUDIO track ${track} for ${esp32Id} (risk ${risk?.level}) command_id=${cmd?.command_id}`
    );
    return cmd;
  } catch (e) {
    console.error("[audioTrigger] failed to queue PLAY_AUDIO:", e.message);
    return null;
  }
}

module.exports = {
  trackForRisk,
  maybeQueueFromPredict,
};
