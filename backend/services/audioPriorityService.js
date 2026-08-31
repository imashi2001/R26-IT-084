const { LITTERING_ALERT_CONFIDENCE } = require("../config/env");
const audioSettingsService = require("./audioSettingsService");

const { BUILTIN_LABELS } = audioSettingsService;

/** Tie-break when two scenarios share the same confidence (lower = wins). */
const SCENARIO_RANK = {
  illegal_dumping: 1,
  waste_full: 2,
  animal_detected: 3,
  correct_dumping: 5,
};

function animalCount(animal) {
  if (!animal || animal.error) return 0;
  if (Number.isFinite(Number(animal.detection_count))) {
    return Math.max(0, Math.trunc(Number(animal.detection_count)));
  }
  if (Array.isArray(animal.detections)) return animal.detections.length;
  return 0;
}

function maxAnimalConfidence(animal) {
  if (!animal || animal.error) return 0;
  if (Array.isArray(animal.detections) && animal.detections.length) {
    return animal.detections.reduce(
      (m, d) => Math.max(m, Number(d.confidence) || 0),
      0
    );
  }
  return animalCount(animal) > 0 ? 0.5 : 0;
}

function litteringConfidence(litteringAction) {
  if (!litteringAction || litteringAction.error) return 0;
  if (litteringAction.max_confidence != null) {
    return Number(litteringAction.max_confidence) || 0;
  }
  if (Array.isArray(litteringAction.detections) && litteringAction.detections.length) {
    return litteringAction.detections.reduce(
      (m, d) => Math.max(m, Number(d.confidence) || 0),
      0
    );
  }
  return 0;
}

function litterPayload(input) {
  return input?.litter_severity || input?.litter || null;
}

function litterSeverityConfidence(litter) {
  if (!litter || litter.error) return 0;
  const lsi = Number(litter.lsi);
  if (!Number.isFinite(lsi)) return 0;
  return Math.min(1, Math.max(0, lsi / 100));
}

function isSignificantLitter(litter) {
  if (!litter || litter.error) return false;
  const severity = String(litter.severity || "").trim().toUpperCase();
  if (severity === "MEDIUM" || severity === "HIGH") return true;
  const lsi = Number(litter.lsi);
  return Number.isFinite(lsi) && lsi > 30;
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
  return litteringConfidence(litteringAction) >= LITTERING_ALERT_CONFIDENCE;
}

function bestFillPrediction(binFill) {
  if (!binFill || binFill.error || !Array.isArray(binFill.predictions)) {
    return null;
  }
  let best = null;
  for (const p of binFill.predictions) {
    const label = String(p.label || p.class_name || "").trim().toLowerCase();
    if (!["empty", "half", "overflow"].includes(label)) continue;
    const conf = Number(p.confidence);
    const c = Number.isFinite(conf) ? conf : 0;
    if (!best || c > best.confidence) {
      best = { label, confidence: c };
    }
  }
  return best;
}

function isOverflow(binFillLevel, fillPercentage, binFill) {
  const fill = String(binFillLevel || "").trim().toLowerCase();
  if (fill === "overflow") return true;
  const pct = Number(fillPercentage);
  if (Number.isFinite(pct) && pct >= 72) return true;
  const best = bestFillPrediction(binFill);
  return best?.label === "overflow";
}

function isHalfFill(binFillLevel, binFill) {
  const fill = String(binFillLevel || "").trim().toLowerCase();
  if (fill === "half") return true;
  const best = bestFillPrediction(binFill);
  return best?.label === "half";
}

function riskLevel(risk) {
  return String(risk?.level || "").trim().toUpperCase();
}

function riskConfidence(level) {
  switch (String(level || "").toUpperCase()) {
    case "CRITICAL":
      return 0.98;
    case "HIGH":
      return 0.85;
    case "MEDIUM":
      return 0.7;
    default:
      return 0;
  }
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

function noIssues(input) {
  if (isLitteringEvent(input.littering_action)) return false;
  if (isSignificantLitter(litterPayload(input))) return false;
  if (isOverflow(input.bin_fill_level, input.fill_percentage, input.bin_fill)) {
    return false;
  }
  if (isHalfFill(input.bin_fill_level, input.bin_fill)) return false;
  if (animalCount(input.animal) > 0) return false;
  const level = riskLevel(input.risk);
  if (level === "HIGH" || level === "CRITICAL") return false;
  return true;
}

function wasteFullConfidence(input) {
  const best = bestFillPrediction(input.bin_fill);
  if (best?.label === "overflow") return best.confidence;
  if (best?.label === "half") return best.confidence;
  if (isOverflow(input.bin_fill_level, input.fill_percentage, input.bin_fill)) {
    return Math.max(best?.confidence ?? 0, 0.72);
  }
  if (isHalfFill(input.bin_fill_level, input.bin_fill)) {
    return Math.max(best?.confidence ?? 0, 0.55);
  }
  return 0;
}

/**
 * Build competing audio scenarios from all model outputs (each with a confidence).
 * @returns {Array<{ scenario_key, label, track, confidence, reason, source }>}
 */
function collectAudioCandidates(input = {}) {
  const settings = input.settings || audioSettingsService.getSettings();
  const candidates = [];

  const litterConf = litteringConfidence(input.littering_action);
  if (isLitteringEvent(input.littering_action)) {
    candidates.push({
      scenario_key: "illegal_dumping",
      label: BUILTIN_LABELS.illegal_dumping,
      track: audioSettingsService.trackForBuiltin("illegal_dumping", settings),
      confidence: litterConf,
      reason: `Littering detected (${Math.round(litterConf * 100)}% confidence).`,
      source: "littering_action",
    });
  }

  const fillConf = wasteFullConfidence(input);
  const litterSev = litterPayload(input);
  const litterSevConf = litterSeverityConfidence(litterSev);
  const hasFillIssue =
    isOverflow(input.bin_fill_level, input.fill_percentage, input.bin_fill) ||
    isHalfFill(input.bin_fill_level, input.bin_fill);
  const hasLitterIssue = isSignificantLitter(litterSev);
  if (hasFillIssue || hasLitterIssue) {
    const conf = Math.max(fillConf, litterSevConf);
    const source = litterSevConf > fillConf ? "litter" : "bin_fill";
    const reason =
      source === "litter"
        ? `Litter severity ${String(litterSev?.severity || "HIGH").toUpperCase()} (LSI ${Math.round(Number(litterSev?.lsi) || litterSevConf * 100)}).`
        : `Bin fill alert (${Math.round(fillConf * 100)}% confidence).`;
    candidates.push({
      scenario_key: "waste_full",
      label: BUILTIN_LABELS.waste_full,
      track: audioSettingsService.trackForBuiltin("waste_full", settings),
      confidence: conf,
      reason,
      source,
    });
  }

  const animals = animalCount(input.animal);
  const animalConf = maxAnimalConfidence(input.animal);
  if (animals > 0 && animalConf > 0) {
    candidates.push({
      scenario_key: "animal_detected",
      label: BUILTIN_LABELS.animal_detected,
      track: audioSettingsService.trackForBuiltin("animal_detected", settings),
      confidence: animalConf,
      reason: `${animals} animal(s) detected (${Math.round(animalConf * 100)}% confidence).`,
      source: "animal",
    });
  }

  for (const custom of settings.custom_scenarios || []) {
    if (custom.auto_condition === "manual_only") continue;
    if (matchesCustomCondition(custom.auto_condition, input.risk)) {
      const conf = riskConfidence(riskLevel(input.risk));
      candidates.push({
        scenario_key: custom.id,
        label: custom.label,
        track: custom.track,
        confidence: conf,
        reason: `Custom rule: ${custom.auto_condition} (${Math.round(conf * 100)}%).`,
        source: "custom",
      });
    }
  }

  if (noIssues(input)) {
    const best = bestFillPrediction(input.bin_fill);
    const emptyConf =
      best?.label === "empty"
        ? best.confidence
        : Math.max(
            0.51,
            1 - Math.max(litterConf, fillConf, litterSevConf, animalConf)
          );
    candidates.push({
      scenario_key: "correct_dumping",
      label: BUILTIN_LABELS.correct_dumping,
      track: audioSettingsService.trackForBuiltin("correct_dumping", settings),
      confidence: emptyConf,
      reason: `Correct disposal (${Math.round(emptyConf * 100)}% confidence).`,
      source: "bin_fill",
    });
  }

  return candidates;
}

function compareCandidates(a, b) {
  const confDiff = (b.confidence || 0) - (a.confidence || 0);
  if (Math.abs(confDiff) > 1e-9) return confDiff;
  const rankA = SCENARIO_RANK[a.scenario_key] ?? 4;
  const rankB = SCENARIO_RANK[b.scenario_key] ?? 4;
  return rankA - rankB;
}

/**
 * Pick the scenario with the highest model confidence across all services.
 * @returns {null | { scenario_key, label, track, confidence, reason, source, candidates }}
 */
function resolveAudioScenario(input = {}) {
  const candidates = collectAudioCandidates(input);
  if (!candidates.length) return null;

  const winner = [...candidates].sort(compareCandidates)[0];
  return {
    scenario_key: winner.scenario_key,
    label: winner.label,
    track: winner.track,
    confidence: winner.confidence,
    reason: winner.reason,
    source: winner.source,
    candidates: candidates.map((c) => ({
      scenario_key: c.scenario_key,
      label: c.label,
      confidence: c.confidence,
      track: c.track,
    })),
  };
}

module.exports = {
  resolveAudioScenario,
  collectAudioCandidates,
  isLitteringEvent,
  isSignificantLitter,
  litterSeverityConfidence,
  isOverflow,
  animalCount,
  noIssues,
  compareCandidates,
};
