/**
 * wasteStatus.js — Location-specific waste forecast status classification.
 *
 * Uses historical 2023–2025 daily waste-weight percentiles (Q1, Median, Q3, P90)
 * computed per location from the trained XGBoost model.
 *
 * Statuses:
 *   LOW          — predicted < Q1
 *   NORMAL       — Q1 ≤ predicted < Q3
 *   HIGH         — Q3 ≤ predicted < P90
 *   VERY_HIGH    — predicted ≥ P90
 *   UNAVAILABLE  — null / NaN / Infinity / negative prediction
 */

const fs = require("fs");
const path = require("path");

// ── Load baselines ──────────────────────────────────────────────────────
let _baselines = null;

function loadBaselines() {
  if (_baselines) return _baselines;
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, "..", "historical_baselines.json"),
      "utf8"
    );
    _baselines = JSON.parse(raw);
  } catch (err) {
    console.error("[wasteStatus] Failed to load historical_baselines.json:", err.message);
    _baselines = {};
  }
  return _baselines;
}

// ── Status colours ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  VERY_HIGH: "#ef4444",
  HIGH: "#f97316",
  NORMAL: "#22c55e",
  LOW: "#3b82f6",
  UNAVAILABLE: "#eab308",
};

const STATUS_LABELS = {
  VERY_HIGH: "Very High",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
  UNAVAILABLE: "Unavailable",
};

// ── Core classification ─────────────────────────────────────────────────
/**
 * @param {number|null|undefined} predictedWasteKg
 * @param {{q1Kg:number, medianKg:number, q3Kg:number, p90Kg:number, sampleSize:number}} baseline
 * @returns {{ predictedWasteKg:number|null, status:string, statusLabel:string, statusColor:string, baseline:object, comparison:object }}
 */
function calculateWasteStatus(predictedWasteKg, baseline) {
  // Guard: invalid prediction
  if (
    predictedWasteKg === null ||
    predictedWasteKg === undefined ||
    !Number.isFinite(predictedWasteKg) ||
    predictedWasteKg < 0
  ) {
    return {
      predictedWasteKg: null,
      status: "UNAVAILABLE",
      statusLabel: STATUS_LABELS.UNAVAILABLE,
      statusColor: STATUS_COLORS.UNAVAILABLE,
      baseline: baseline || null,
      comparison: null,
    };
  }

  // Guard: no baseline available
  if (
    !baseline ||
    !Number.isFinite(baseline.q1Kg) ||
    !Number.isFinite(baseline.q3Kg) ||
    !Number.isFinite(baseline.p90Kg)
  ) {
    return {
      predictedWasteKg,
      status: "UNAVAILABLE",
      statusLabel: STATUS_LABELS.UNAVAILABLE,
      statusColor: STATUS_COLORS.UNAVAILABLE,
      baseline: null,
      comparison: null,
      reason: "Insufficient historical data for this location",
    };
  }

  let status;
  let band;

  if (predictedWasteKg < baseline.q1Kg) {
    status = "LOW";
    band = "BELOW_Q1";
  } else if (predictedWasteKg < baseline.q3Kg) {
    status = "NORMAL";
    band = "Q1_TO_Q3";
  } else if (predictedWasteKg < baseline.p90Kg) {
    status = "HIGH";
    band = "Q3_TO_P90";
  } else {
    status = "VERY_HIGH";
    band = "ABOVE_P90";
  }

  const kgAboveMedian = Number((predictedWasteKg - baseline.medianKg).toFixed(1));
  const percentAboveMedian =
    baseline.medianKg > 0
      ? Number(((kgAboveMedian / baseline.medianKg) * 100).toFixed(1))
      : null;
  const kgAboveP90 =
    predictedWasteKg >= baseline.p90Kg
      ? Number((predictedWasteKg - baseline.p90Kg).toFixed(1))
      : null;

  return {
    predictedWasteKg: Number(predictedWasteKg.toFixed(1)),
    status,
    statusLabel: STATUS_LABELS[status],
    statusColor: STATUS_COLORS[status],
    baseline: {
      method: baseline.method || "location_specific_daily_weight_percentiles",
      periodStart: baseline.periodStart || "2023-01-01",
      periodEnd: baseline.periodEnd || "2025-12-31",
      sampleSize: baseline.sampleSize || 0,
      q1Kg: baseline.q1Kg,
      medianKg: baseline.medianKg,
      q3Kg: baseline.q3Kg,
      p90Kg: baseline.p90Kg,
    },
    comparison: {
      kgAboveMedian,
      percentAboveMedian,
      band,
      kgAboveP90,
    },
  };
}

/**
 * Get baseline for a specific location ID.
 * @param {string} locationId
 * @returns {object|null}
 */
function getBaseline(locationId) {
  const baselines = loadBaselines();
  return baselines[locationId] || null;
}

/**
 * Get all baselines.
 * @returns {object}
 */
function getAllBaselines() {
  return loadBaselines();
}

module.exports = {
  calculateWasteStatus,
  getBaseline,
  getAllBaselines,
  STATUS_COLORS,
  STATUS_LABELS,
  loadBaselines,
};
