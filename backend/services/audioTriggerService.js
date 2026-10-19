/**
 * Queue PLAY_AUDIO on ESP32 after /predict using configurable scenario tracks.
 *
 * Track numbers map to DFPlayer /MP3/000N.mp3 and are configured in
 * Speaker Check → Audio track assignment (audio_settings.json).
 *
 * When `resolvedOverride` is provided (e.g. Gemini / both-mode winner),
 * YOLO scenario resolution is skipped for the voice queue.
 *
 * Motion-session voice policy (per motion_session_id):
 *  1) First analyzed photo → play immediately
 *  2) If motion continues, allow one more play after 30s (suitable track)
 *  3) After 60s from first play → treat further shots as spam (no play)
 * Scenario changes before the spam window still get a suitable voice.
 */

const { AUTO_AUDIO_ON_PREDICT } = require("../config/env");
const deviceCommandService = require("./deviceCommandService");
const audioSettingsService = require("./audioSettingsService");
const audioPriorityService = require("./audioPriorityService");

/** First replay of same/suitable voice while motion continues. */
const SESSION_REPLAY_AFTER_MS = 30_000;
/** After this from first play, further session shots are spam. */
const SESSION_SPAM_AFTER_MS = 60_000;
/** Max auto plays for one motion session (first + one reminder). */
const SESSION_MAX_PLAYS = 2;

/** @type {Map<string, { firstPlayAt: number, playCount: number, scenario: string, track: number }>} */
const sessionAnnounce = new Map();
const SESSION_ANNOUNCE_MAX = 40;

function rememberSessionAnnounce(sessionId, resolved, at = Date.now()) {
  if (!sessionId || !resolved) return;
  const key = String(sessionId);
  const prev = sessionAnnounce.get(key);
  const now = Number(at) || Date.now();
  if (!prev) {
    sessionAnnounce.set(key, {
      firstPlayAt: now,
      playCount: 1,
      scenario: resolved.scenario_key,
      track: resolved.track,
    });
  } else {
    sessionAnnounce.set(key, {
      firstPlayAt: prev.firstPlayAt,
      playCount: (prev.playCount || 1) + 1,
      scenario: resolved.scenario_key,
      track: resolved.track,
    });
  }
  if (sessionAnnounce.size > SESSION_ANNOUNCE_MAX) {
    const oldest = sessionAnnounce.keys().next().value;
    sessionAnnounce.delete(oldest);
  }
}

/**
 * @returns {false | { reason: string }} — false = allow play
 */
function sessionVoiceDecision(sessionId, resolved, now = Date.now()) {
  if (!sessionId || !resolved) return false;
  const prev = sessionAnnounce.get(String(sessionId));
  if (!prev) return false; // first photo of session

  const age = now - prev.firstPlayAt;
  if (age >= SESSION_SPAM_AFTER_MS) {
    return { reason: "session_spam_after_60s" };
  }
  if ((prev.playCount || 0) >= SESSION_MAX_PLAYS) {
    return { reason: "session_max_plays" };
  }

  const same =
    prev.scenario === resolved.scenario_key && prev.track === resolved.track;
  if (!same) {
    // New situation before spam window — allow suitable voice.
    return false;
  }
  if (age < SESSION_REPLAY_AFTER_MS) {
    return { reason: "same_scenario_wait_30s" };
  }
  // Same or updated suitable track after 30s, still under 60s / max plays.
  return false;
}

function suppressSameSessionAnnounce(sessionId, resolved, now = Date.now()) {
  return Boolean(sessionVoiceDecision(sessionId, resolved, now));
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

  const decision = sessionVoiceDecision(sessionId, resolved);
  if (decision) {
    console.log(
      `[audioTrigger] suppress ${decision.reason} session=${sessionId} event=${eventId} scenario=${resolved.scenario_key} track=${resolved.track}`
    );
    return { command: null, resolved };
  }

  const skip = await deviceCommandService.shouldSkipAutoPlay(
    esp32Id,
    resolved.track
  );
  if (skip) {
    console.log(
      `[audioTrigger] skip track=${resolved.track} for ${esp32Id} (max plays in cooldown window)`
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
  sessionVoiceDecision,
  SESSION_REPLAY_AFTER_MS,
  SESSION_SPAM_AFTER_MS,
  SESSION_MAX_PLAYS,
};
