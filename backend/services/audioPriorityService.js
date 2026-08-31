const { LITTERING_ALERT_CONFIDENCE } = require("../config/env");
const audioSettingsService = require("./audioSettingsService");

const { BUILTIN_LABELS } = audioSettingsService;

function animalCount(animal) {
  if (!animal || animal.error) return 0;
  if (Number.isFinite(Number(animal.detection_count))) {
    return Math.max(0, Math.trunc(Number(animal.detection_count)));
  }
  if (Array.isArray(animal.detections)) return animal.detections.length;
  return 0;
}

function isLitteringEvent(litteringAction) {
  if (!litteringAction || litteringAction.error) return false;
  const detected = Boolean(
    litteringAction.event_detected != null
      ? litteringAction.event_detected
      : (Number(litteringAction.event_count) || 0) > 0 ||
          (Array.isArray(litteringAction.detections) &&
            litteringAction.detections.length > 0)
  );
  if (!detected) return false;
  const conf =
    litteringAction.max_confidence != null
      ? Number(litteringAction.max_confidence)
      : Array.isArray(litteringAction.detections)
        ? litteringAction.detections.reduce(
            (m, d) => Math.max(m, Number(d.confidence) || 0),
            0
          )
        : 0;
  return conf >= LITTERING_ALERT_CONFIDENCE;
}

function isOverflow(binFillLevel, fillPercentage) {
  const fill = String(binFillLevel || "").trim().toLowerCase();
  if (fill === "overflow") return true;
  const pct = Number(fillPercentage);
  return Number.isFinite(pct) && pct >= 72;
}

function riskLevel(risk) {
  return String(risk?.level || "").trim().toUpperCase();
}

function matchesCustomCondition(condition, risk) {
  const level = riskLevel(risk);
  switch (condition) {
    case "risk_critical":
      return level === "CRITICAL";
    case "risk_high":
      return level === "HIGH";
    case "risk_medium":
      return level === "MEDIUM";
    default:
      return false;
  }
}

function noIssues({ litteringAction, binFillLevel, fillPercentage, animal, risk }) {
  if (isLitteringEvent(litteringAction)) return false;
  if (isOverflow(binFillLevel, fillPercentage)) return false;
  if (animalCount(animal) > 0) return false;
  const level = riskLevel(risk);
  if (level === "HIGH" || level === "CRITICAL") return false;
  return true;
}

/**
 * Resolve a single audio scenario after classification.
 * @returns {null | { scenario_key, label, track, reason }}
 */
function resolveAudioScenario(input = {}) {
  const settings = input.settings || audioSettingsService.getSettings();
  const tracks = settings.tracks || audioSettingsService.DEFAULT_TRACKS;

  const littering = isLitteringEvent(input.littering_action);
  const overflow = isOverflow(input.bin_fill_level, input.fill_percentage);
  const animals = animalCount(input.animal);

  if (littering) {
    return {
      scenario_key: "illegal_dumping",
      label: BUILTIN_LABELS.illegal_dumping,
      track: audioSettingsService.trackForBuiltin("illegal_dumping", settings),
      reason: "Littering event detected above alert confidence.",
    };
  }

  if (overflow) {
    return {
      scenario_key: "waste_full",
      label: BUILTIN_LABELS.waste_full,
      track: audioSettingsService.trackForBuiltin("waste_full", settings),
      reason: "Bin fill at or near overflow.",
    };
  }

  if (animals > 0) {
    return {
      scenario_key: "animal_detected",
      label: BUILTIN_LABELS.animal_detected,
      track: audioSettingsService.trackForBuiltin("animal_detected", settings),
      reason: `${animals} animal detection(s) on capture.`,
    };
  }

  for (const custom of settings.custom_scenarios || []) {
    if (custom.auto_condition === "manual_only") continue;
    if (matchesCustomCondition(custom.auto_condition, input.risk)) {
      return {
        scenario_key: custom.id,
        label: custom.label,
        track: custom.track,
        reason: `Custom rule matched: ${custom.auto_condition}.`,
      };
    }
  }

  if (
    noIssues({
      litteringAction: input.littering_action,
      binFillLevel: input.bin_fill_level,
      fillPercentage: input.fill_percentage,
      animal: input.animal,
      risk: input.risk,
    })
  ) {
    return {
      scenario_key: "correct_dumping",
      label: BUILTIN_LABELS.correct_dumping,
      track: audioSettingsService.trackForBuiltin("correct_dumping", settings),
      reason: "No littering, overflow, or animals — correct disposal.",
    };
  }

  return null;
}

module.exports = {
  resolveAudioScenario,
  isLitteringEvent,
  isOverflow,
  animalCount,
  noIssues,
};
