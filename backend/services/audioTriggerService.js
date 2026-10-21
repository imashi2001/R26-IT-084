/**
 * Queue PLAY_AUDIO on ESP32 after /predict using configurable scenario tracks.
 *
 * Track numbers map to DFPlayer /MP3/000N.mp3 and are configured in
 * Speaker Check → Audio track assignment (audio_settings.json).
 *
 * When `resolvedOverride` is provided (e.g. Gemini / both-mode winner),
 * YOLO scenario resolution is skipped for the voice queue.
 *
 * Voice policies (Settings → Voice command method):
 *  - classic (default, viva-safe): first play, same scenario again after 30s,
 *    mute all after 60s, max 2 plays; scenario change allowed before mute.
 *  - quality: play on first confident result and whenever the scenario
 *    meaningfully changes (correct dump / illegal / full / animal). Same
 *    scenario is spam. After 60s still only play if the image result differs.
 *    Thank-you (correct_dumping) plays once per situation, not every photo.
 */

const { AUTO_AUDIO_ON_PREDICT } = require("../config/env");
const deviceCommandService = require("./deviceCommandService");
const audioSettingsService = require("./audioSettingsService");
const audioPriorityService = require("./audioPriorityService");

/** classic: first replay of same/suitable voice while motion continues. */
const SESSION_REPLAY_AFTER_MS = 30_000;
/** After this from first play: classic mutes all; quality only allows change. */
const SESSION_SPAM_AFTER_MS = 60_000;
/** classic max auto plays for one motion session. */
const SESSION_MAX_PLAYS = 2;
/** quality: cap scenario-change announces so flapping models cannot loop forever. */
const QUALITY_MAX_PLAYS = 6;
/** Optional confidence floor for quality first/change announces. */
const QUALITY_MIN_CONFIDENCE = 0.35;

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
 * Classic (old) timed policy.
 * @returns {false | { reason: string }}
 */
function sessionVoiceDecisionClassic(sessionId, resolved, now = Date.now()) {
  if (!sessionId || !resolved) return false;
  const prev = sessionAnnounce.get(String(sessionId));
  if (!prev) return false;

  const age = now - prev.firstPlayAt;
  if (age >= SESSION_SPAM_AFTER_MS) {
    return { reason: "classic_spam_after_60s" };
  }
  if ((prev.playCount || 0) >= SESSION_MAX_PLAYS) {
    return { reason: "classic_max_plays" };
  }

  const same =
    prev.scenario === resolved.scenario_key && prev.track === resolved.track;
  if (!same) return false;
  if (age < SESSION_REPLAY_AFTER_MS) {
    return { reason: "classic_same_wait_30s" };
  }
  return false;
}

/**
 * Quality (new) change-based policy.
 * - First photo → play suitable (incl. thank-you / correct_dumping)
 * - Same scenario → spam (no thank-you every 10s)
 * - Different scenario → play suitable (correct vs illegal, etc.)
 * - After 60s: same → spam; different → still play
 * @returns {false | { reason: string }}
 */
function sessionVoiceDecisionQuality(sessionId, resolved, now = Date.now()) {
  if (!sessionId || !resolved) return false;

  const conf = Number(resolved.confidence);
  if (Number.isFinite(conf) && conf < QUALITY_MIN_CONFIDENCE) {
    return { reason: "quality_low_confidence" };
  }

  const prev = sessionAnnounce.get(String(sessionId));
  if (!prev) return false; // first confident announce

  const same =
    prev.scenario === resolved.scenario_key && prev.track === resolved.track;

  if (same) {
    // Includes repeated thank-you / correct_dumping while motion continues.
    return { reason: "quality_same_scenario_spam" };
  }

  if ((prev.playCount || 0) >= QUALITY_MAX_PLAYS) {
    return { reason: "quality_max_plays" };
  }

  // Different result (before or after 60s) → play suitable command.
  return false;
}

/**
 * @param {string} sessionId
 * @param {object} resolved
 * @param {number} [now]
 * @param {"classic"|"quality"} [policy]
 * @returns {false | { reason: string }}
 */
function sessionVoiceDecision(
  sessionId,
  resolved,
  now = Date.now(),
  policy = "classic"
) {
  const mode = audioSettingsService.normalizeVoicePolicy(policy);
  if (mode === "quality") {
    return sessionVoiceDecisionQuality(sessionId, resolved, now);
  }
  return sessionVoiceDecisionClassic(sessionId, resolved, now);
}

function suppressSameSessionAnnounce(
  sessionId,
  resolved,
  now = Date.now(),
  policy = "classic"
) {
  return Boolean(sessionVoiceDecision(sessionId, resolved, now, policy));
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

  const settings = audioSettingsService.getSettings();
  const voicePolicy = settings.voice_policy || "classic";

  let resolved = input?.resolvedOverride || null;
  if (!resolved?.track || !resolved?.scenario_key) {
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

  const decision = sessionVoiceDecision(sessionId, resolved, Date.now(), voicePolicy);
  if (decision) {
    console.log(
      `[audioTrigger] policy=${voicePolicy} suppress ${decision.reason} session=${sessionId} event=${eventId} scenario=${resolved.scenario_key} track=${resolved.track}`
    );
    return { command: null, resolved };
  }

  const skip = await deviceCommandService.shouldSkipAutoPlay(
    esp32Id,
    resolved.track
  );
  if (skip) {
    console.log(
      `[audioTrigger] policy=${voicePolicy} skip track=${resolved.track} for ${esp32Id} (max plays in cooldown window)`
    );
    return { command: null, resolved };
  }

  try {
    const cmd = await deviceCommandService.createPlayAudioCommand(device, {
      track: resolved.track,
    });
    rememberSessionAnnounce(sessionId, resolved);
    console.log(
      `[audioTrigger] policy=${voicePolicy} scenario=${resolved.scenario_key} track=${resolved.track} conf=${(Number(resolved.confidence) * 100 || 0).toFixed(0)}% source=${resolved.source || "models"} session=${sessionId} event=${eventId} command_id=${cmd?.command_id}`
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
  sessionVoiceDecisionClassic,
  sessionVoiceDecisionQuality,
  SESSION_REPLAY_AFTER_MS,
  SESSION_SPAM_AFTER_MS,
  SESSION_MAX_PLAYS,
  QUALITY_MAX_PLAYS,
  QUALITY_MIN_CONFIDENCE,
};
