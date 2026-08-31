/**
 * Queue PLAY_AUDIO on ESP32 after /predict using configurable scenario tracks.
 *
 * Track numbers map to DFPlayer /MP3/000N.mp3 and are configured in
 * Speaker Check → Audio track assignment (audio_settings.json).
 */

const {
  AUTO_AUDIO_ON_PREDICT,
  AUDIO_TRIGGER_COOLDOWN_MS,
} = require("../config/env");
const deviceCommandService = require("./deviceCommandService");
const audioSettingsService = require("./audioSettingsService");
const audioPriorityService = require("./audioPriorityService");

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
 *   litter?: object|null,
 *   bin_fill?: object|null,
 *   waste?: object|null,
 * }} input
 * @returns {Promise<{ command: object|null, resolved: object|null }>}
 */
async function maybeQueueFromPredict(input) {
  if (!AUTO_AUDIO_ON_PREDICT) {
    return { command: null, resolved: null };
  }
  const device = input?.device;
  if (!device?.id || !device?.esp32_id) {
    return { command: null, resolved: null };
  }

  const src = String(input?.sourceType || "").trim().toLowerCase();
  if (src !== "esp32") {
    return { command: null, resolved: null };
  }

  const settings = audioSettingsService.getSettings();
  const resolved = audioPriorityService.resolveAudioScenario({
    risk: input.risk,
    bin_fill_level: input.bin_fill_level,
    fill_percentage: input.fill_percentage,
    animal: input.animal,
    littering_action: input.littering_action,
    litter: input.litter,
    bin_fill: input.bin_fill,
    waste: input.waste,
    settings,
  });

  if (!resolved?.track) {
    return { command: null, resolved: null };
  }

  const esp32Id = String(device.esp32_id).trim();
  const skip = await deviceCommandService.shouldSkipAutoPlay(esp32Id);
  if (skip) {
    return { command: null, resolved };
  }

  try {
    const cmd = await deviceCommandService.createPlayAudioCommand(device, {
      track: resolved.track,
    });
    console.log(
      `[audioTrigger] scenario=${resolved.scenario_key} track=${resolved.track} conf=${(resolved.confidence * 100).toFixed(0)}% for ${esp32Id} command_id=${cmd?.command_id}`
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
};
