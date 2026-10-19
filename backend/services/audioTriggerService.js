/**
 * Queue PLAY_AUDIO on ESP32 after /predict using configurable scenario tracks.
 *
 * Track numbers map to DFPlayer /MP3/000N.mp3 and are configured in
 * Speaker Check → Audio track assignment (audio_settings.json).
 *
 * When `resolvedOverride` is provided (e.g. Gemini / both-mode winner),
 * YOLO scenario resolution is skipped for the voice queue.
 */

const { AUTO_AUDIO_ON_PREDICT } = require("../config/env");
const deviceCommandService = require("./deviceCommandService");
const audioSettingsService = require("./audioSettingsService");
const audioPriorityService = require("./audioPriorityService");

/** Same scenario+track in one motion session is announced once. */
const sessionAnnounce = new Map();
const SESSION_ANNOUNCE_MAX = 40;

function rememberSessionAnnounce(sessionId, resolved) {
  if (!sessionId || !resolved) return;
  sessionAnnounce.set(String(sessionId), {
    scenario: resolved.scenario_key,
    track: resolved.track,
    at: Date.now(),
  });
  if (sessionAnnounce.size > SESSION_ANNOUNCE_MAX) {
    const oldest = sessionAnnounce.keys().next().value;
    sessionAnnounce.delete(oldest);
  }
}

function suppressSameSessionAnnounce(sessionId, resolved) {
  if (!sessionId || !resolved) return false;
  const prev = sessionAnnounce.get(String(sessionId));
  if (!prev) return false;
  return prev.scenario === resolved.scenario_key && prev.track === resolved.track;
}

function resetSessionAnnounce() {
  sessionAnnounce.clear();
}

/** @deprecated Use audioPriorityService.resolveAudioScenario */
function trackForRisk(risk) {
  const resolved = audioPriorityService.resolveAudioScenario({ risk });
  return resolved?.track ?? null;
}

/**
 * @param {{
 *   device: object|null,
 *   risk: object,
 *   sourceType: string,
 *   bin_fill_level?: string|null,
 *   fill_percentage?: number|null,
 *   animal?: object|null,
 *   littering_action?: object|null,
 *   litter_severity?: object|null,
 *   bin_fill?: object|null,
 *   waste?: object|null,
 *   motionSessionId?: string|null,
 *   eventId?: string|null,
 *   resolvedOverride?: object|null,
 * }} input
 * @returns {Promise<{ command: object|null, resolved: object|null }>}
 */
async function maybeQueueFromPredict(input) {
  if (!AUTO_AUDIO_ON_PREDICT) {
    return { command: null, resolved: null };
  }
  const device = input?.device;
  if (!device?.id || !deviceCommandService.audioTargetId(device)) {
    return { command: null, resolved: null };
  }

  const src = String(input?.sourceType || "").trim().toLowerCase();
  if (src !== "esp32") {
    return { command: null, resolved: null };
  }

  let resolved = input?.resolvedOverride || null;
  if (!resolved?.track || !resolved?.scenario_key) {
    const settings = audioSettingsService.getSettings();
    resolved = audioPriorityService.resolveAudioScenario({
      risk: input.risk,
      bin_fill_level: input.bin_fill_level,
      fill_percentage: input.fill_percentage,
      animal: input.animal,
      littering_action: input.littering_action,
      litter_severity: input.litter_severity,
      bin_fill: input.bin_fill,
      waste: input.waste,
      settings,
    });
  }

  if (!resolved?.track) {
    return { command: null, resolved: null };
  }

  const esp32Id = deviceCommandService.audioTargetId(device);
  const sessionId = input.motionSessionId
    ? String(input.motionSessionId).trim()
    : "";
  const eventId = input.eventId ? String(input.eventId).trim() : "";

  if (suppressSameSessionAnnounce(sessionId, resolved)) {
    console.log(
      `[audioTrigger] suppress same announcement session=${sessionId} event=${eventId} scenario=${resolved.scenario_key} track=${resolved.track}`
    );
    return { command: null, resolved };
  }

  const skip = await deviceCommandService.shouldSkipAutoPlay(
    esp32Id,
    resolved.track
  );
  if (skip) {
    console.log(
      `[audioTrigger] skip track=${resolved.track} for ${esp32Id} (in-flight or recent play)`
    );
    return { command: null, resolved };
  }

  try {
    const cmd = await deviceCommandService.createPlayAudioCommand(device, {
      track: resolved.track,
    });
    rememberSessionAnnounce(sessionId, resolved);
    console.log(
      `[audioTrigger] scenario=${resolved.scenario_key} track=${resolved.track} conf=${(resolved.confidence * 100).toFixed(0)}% source=${resolved.source || "models"} session=${sessionId} event=${eventId} command_id=${cmd?.command_id}`
    );
    return { command: cmd, resolved };
  } catch (e) {
    console.error("[audioTrigger] failed to queue PLAY_AUDIO:", e.message);
    return { command: null, resolved };
  }
}

module.exports = {
  trackForRisk,
  maybeQueueFromPredict,
  suppressSameSessionAnnounce,
  rememberSessionAnnounce,
  resetSessionAnnounce,
};
