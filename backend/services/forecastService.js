/**
 * Hygienic-risk forecaster (Node port of backend/forecast.py).
 *
 * Forecasting in this project is NOT a separate ML model. We replay the
 * existing rule-based `computeRisk` engine for each future weather slot
 * returned by OpenWeather (or its stub) and emit a small timeline the
 * dashboard can render.
 *
 * Assumptions documented for the thesis:
 *   - The waste label observed at the most recent /predict stays the same
 *     in the forecast window. Garbage doesn't typically change category
 *     until it is cleaned.
 *   - Animal pressure is treated as the *current* number of detections.
 *     The forecaster cannot predict new animal arrivals; it is honest
 *     about that and exposes the assumption in `assumptions`.
 *   - Time-since-clean grows linearly into the future (no model of
 *     cleaning crews).
 */

const { computeRisk } = require("./riskEngine");

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function _slotWithRisk(
  slot,
  { waste, animals, binDoc, baseHoursSinceClean, deltaHours }
) {
  const projectedBin = binDoc ? { ...binDoc } : {};
  projectedBin.hours_since_clean =
    Math.round((baseHoursSinceClean + Math.max(0, deltaHours)) * 100) / 100;

  const risk = computeRisk({
    waste,
    animals,
    weather: slot,
    binDoc: projectedBin,
  });

  return {
    ts: slot.ts,
    ts_unix: slot.ts_unix,
    temp_c: slot.temp_c,
    humidity_pct: slot.humidity_pct,
    condition: slot.condition,
    level: risk.level,
    case: risk.case,
    rotting_hours: risk.rotting_hours,
    message: risk.message,
    source: slot.source,
  };
}

function _summary(slots) {
  if (!slots.length) {
    return {
      max_level: null,
      first_high_at: null,
      first_medium_at: null,
      recommendation: "Not enough forecast data.",
    };
  }

  const maxSlot = slots.reduce((acc, s) =>
    (RANK[s.level] || 0) > (RANK[acc.level] || 0) ? s : acc
  );
  const firstHigh =
    slots.find((s) => s.level === "HIGH" || s.level === "CRITICAL") || null;
  const firstMedium = slots.find((s) => s.level === "MEDIUM") || null;

  let recommendation;
  if (firstHigh) {
    recommendation = `Schedule cleaning before ${firstHigh.ts} — risk is forecast to reach ${firstHigh.level}.`;
  } else if (firstMedium) {
    recommendation = `Risk likely to reach MEDIUM by ${firstMedium.ts}. Inspect within the next shift.`;
  } else {
    recommendation =
      "Risk stays LOW for the forecast window. No action required.";
  }

  return {
    max_level: maxSlot.level,
    max_level_at: maxSlot.ts,
    first_high_at: firstHigh ? firstHigh.ts : null,
    first_medium_at: firstMedium ? firstMedium.ts : null,
    recommendation,
  };
}

/**
 * @param {object} params
 * @param {Array<object>} params.forecastSlots - from weatherService.getForecast
 * @param {object|null} params.waste
 * @param {Array<object>} params.animals
 * @param {object|null} params.binDoc
 */
function forecastRisk({ forecastSlots, waste, animals, binDoc }) {
  const _animals = animals || [];
  const baseHours = Number(binDoc?.hours_since_clean) || 0;
  const firstTs = forecastSlots[0]?.ts_unix || 0;

  const slots = forecastSlots.map((slot) => {
    const delta = ((slot.ts_unix || 0) - firstTs) / 3600;
    return _slotWithRisk(slot, {
      waste,
      animals: _animals,
      binDoc,
      baseHoursSinceClean: baseHours,
      deltaHours: delta + 3.0,
    });
  });

  return {
    slots,
    summary: _summary(slots),
    assumptions: [
      "Waste type stays the same until the bin is cleaned.",
      "Animal pressure is held at the latest /predict observation.",
      "Time since last clean grows linearly into the future.",
    ],
  };
}

module.exports = { forecastRisk };
