/**
 * Rule-based hygiene risk engine (Node port of backend/risk/engine.py).
 *
 * Risk is decided by EXPLICIT cases the user can read off the dashboard,
 * not a hidden weighted score. Each call returns the level, a human-readable
 * message, the list of rules that fired, the rotting estimate, and a
 * preset alert string for the UI.
 *
 * Cases (matches the project spec):
 *   CASE 3 (HIGH)   : organic waste + at least one animal detection
 *   CASE 2 (MEDIUM) : organic waste + high temperature AND high humidity, no animals
 *   CASE 1 (LOW)    : organic waste, no animals, normal weather
 *   Extra (HIGH)    : non-organic + animals (animals are still a hygiene hazard)
 *   Extra (LOW)     : non-organic, no animals (no urgent rotting concern)
 *
 * CASE 4 (CRITICAL / mixed waste + animals) is intentionally not implemented:
 * the current waste classifier is binary (organic vs non-organic), so we
 * cannot honestly detect "mixed" waste from one image.
 */

const { HIGH_TEMP_C, HIGH_HUMIDITY_PCT } = require("../config/env");

const ALERT_TEXT = {
  LOW: "Organic waste detected. No immediate hygienic danger.",
  MEDIUM: "Organic waste may rot soon due to environmental conditions.",
  HIGH: "Animal activity detected near garbage bin.",
  CRITICAL: "Immediate cleaning required. High hygienic risk detected.",
};

const BASELINE_HOURS = 36.0;

/**
 * Estimate organic-waste rotting headroom in hours.
 * @param {string|null} wasteLabel
 * @param {number|null} tempC
 * @param {number|null} humidityPct
 * @param {number} hoursSinceClean
 * @returns {number|null}  null when waste is non-organic.
 */
function estimateRottingHours(
  wasteLabel,
  tempC,
  humidityPct,
  hoursSinceClean = 0
) {
  if (!wasteLabel || String(wasteLabel).toLowerCase() !== "organic") {
    return null;
  }

  const t = Number.isFinite(Number(tempC)) ? Number(tempC) : 25.0;
  const h = Number.isFinite(Number(humidityPct)) ? Number(humidityPct) : 50.0;

  const heatFactor = Math.max(1.0, 1.0 + 0.07 * (t - 25.0));
  const humFactor = Math.max(1.0, 1.0 + 0.015 * (h - 50.0));

  const totalWindow = BASELINE_HOURS / (heatFactor * humFactor);
  const remaining =
    totalWindow - Math.max(0, Number(hoursSinceClean) || 0);
  return Math.max(0.0, Math.round(remaining * 10) / 10);
}

function _formatRottingSummary(hours, wasteLabel) {
  if (hours === null || hours === undefined) {
    return "Estimated rotting time: N/A (non-organic waste)";
  }
  if (hours <= 0) {
    return "Estimated rotting time: organic waste likely already rotting";
  }
  if (hours < 1) {
    return "Estimated rotting time: less than 1 hour";
  }
  if (hours <= 48) {
    return `Estimated rotting time: ~${Math.round(hours)} hours`;
  }
  const days = hours / 24.0;
  return `Estimated rotting time: ~${days.toFixed(1)} days`;
}

function _animalSummary(animals) {
  if (!Array.isArray(animals) || animals.length === 0) return "";
  const set = new Set();
  for (const a of animals) {
    const name = (a?.class_name || a?.label || "?").toString().toLowerCase();
    set.add(name);
  }
  return Array.from(set).sort().join(", ");
}

function _capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Decide a risk level for one observation.
 *
 * @param {object} input
 * @param {object|null} input.waste     - { label, confidence, ... }
 * @param {Array<object>} input.animals - [{ class_name|label, confidence, box }, ...]
 * @param {object|null} input.weather   - { temp_c, humidity_pct, condition, ... }
 * @param {object|null} input.binDoc    - { name, hours_since_clean, ... }
 */
function computeRisk({
  waste = null,
  animals = null,
  weather = null,
  binDoc = null,
} = {}) {
  const _animals = animals || [];
  const wasteLabelRaw = (waste?.label || "").toString().toLowerCase();
  const wasteLabel = wasteLabelRaw || null;
  const isOrganic = wasteLabel === "organic";
  const hasAnimal = _animals.length > 0;
  const noAnimalAttacks = !hasAnimal;

  const tempC = Number.isFinite(Number(weather?.temp_c))
    ? Number(weather.temp_c)
    : 25.0;
  const humPct = Number.isFinite(Number(weather?.humidity_pct))
    ? Number(weather.humidity_pct)
    : 50.0;

  const highTemp = tempC >= HIGH_TEMP_C;
  const highHum = humPct >= HIGH_HUMIDITY_PCT;

  const binName = binDoc?.name || "the bin";

  let case_;
  let level;
  let message;
  const rulesFired = [];

  if (isOrganic && hasAnimal) {
    case_ = "CASE_3";
    level = "HIGH";
    rulesFired.push("organic_waste_with_animal_activity");
    const kinds = _animalSummary(_animals) || "animal";
    message = `High hygienic risk detected. ${_capitalize(
      kinds
    )} interacting with garbage near ${binName}. Immediate cleaning required.`;
  } else if (!isOrganic && hasAnimal) {
    case_ = "EXTRA_NONORGANIC_WITH_ANIMAL";
    level = "HIGH";
    rulesFired.push("non_organic_with_animal_activity");
    const kinds = _animalSummary(_animals) || "animal";
    message = `High hygienic risk: ${kinds} interacting with non-organic garbage near ${binName}. Clean and remove waste promptly.`;
  } else if (isOrganic && highTemp && highHum) {
    case_ = "CASE_2";
    level = "MEDIUM";
    rulesFired.push("organic_high_temp_and_humidity");
    rulesFired.push(`temp_${tempC.toFixed(1)}C_ge_${HIGH_TEMP_C.toFixed(0)}C`);
    rulesFired.push(
      `humidity_${humPct.toFixed(0)}pct_ge_${HIGH_HUMIDITY_PCT.toFixed(0)}pct`
    );
    message =
      "Organic waste may rot quickly due to high temperature and humidity. Schedule cleaning soon.";
  } else if (isOrganic) {
    case_ = "CASE_1";
    level = "LOW";
    rulesFired.push("organic_waste_only");
    if (noAnimalAttacks) rulesFired.push("no_animal_attacks");
    message =
      "Organic waste detected. No animal attacks identified. Current hygienic risk level is LOW.";
  } else {
    case_ = "EXTRA_NONORGANIC_CLEAR";
    level = "LOW";
    rulesFired.push("non_organic_no_animals");
    if (noAnimalAttacks) rulesFired.push("no_animal_attacks");
    message =
      "Non-organic waste detected. No animal attacks identified. No immediate hygienic danger.";
  }

  const rottingHours = estimateRottingHours(
    wasteLabel,
    tempC,
    humPct,
    Number(binDoc?.hours_since_clean) || 0
  );
  const rottingSummary = _formatRottingSummary(rottingHours, wasteLabel);

  const animalClasses = Array.from(
    new Set(
      _animals.map((a) =>
        (a?.class_name || a?.label || "?").toString().toLowerCase()
      )
    )
  ).sort();

  return {
    case: case_,
    level,
    message,
    rules_fired: rulesFired,
    alert: ALERT_TEXT[level] || "",
    no_animal_attacks: noAnimalAttacks,
    rotting_hours: rottingHours,
    rotting_summary: rottingSummary,
    thresholds: {
      HIGH_TEMP_C,
      HIGH_HUMIDITY_PCT,
    },
    inputs: {
      waste_label: wasteLabel,
      animal_count: _animals.length,
      animal_classes: animalClasses,
      temp_c: tempC,
      humidity_pct: humPct,
      high_temp: highTemp,
      high_humidity: highHum,
    },
    case4_note:
      "CRITICAL (mixed organic + non-organic + animals) is documented as future work. The current waste model is binary, so 'mixed' waste cannot be inferred from a single image.",
  };
}

module.exports = {
  computeRisk,
  estimateRottingHours,
  ALERT_TEXT,
};
