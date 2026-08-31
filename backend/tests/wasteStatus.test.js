/**
 * wasteStatus.test.js — Unit tests for waste forecast status classification.
 *
 * Run: node backend/tests/wasteStatus.test.js
 */

const path = require("path");
// Adjust require path since we're running from project root
const { calculateWasteStatus, getBaseline, getAllBaselines } = require(path.join(__dirname, "..", "utils", "wasteStatus"));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log("  ✅ " + message);
  } else {
    failed++;
    console.error("  ❌ FAIL: " + message);
  }
}

function describe(name, fn) {
  console.log("\n" + name);
  fn();
}

// Sample baseline for testing
const sampleBaseline = {
  q1Kg: 83.0,
  medianKg: 98.0,
  q3Kg: 116.0,
  p90Kg: 135.0,
  sampleSize: 730,
  periodStart: "2023-01-01",
  periodEnd: "2025-12-31",
  method: "location_specific_daily_weight_percentiles",
};

// ── Test 1: Status classification ────────────────────────────────────
describe("Status classification logic", () => {
  // LOW: below Q1
  const low = calculateWasteStatus(70.0, sampleBaseline);
  assert(low.status === "LOW", "Value 70 < Q1(83) → LOW");
  assert(low.statusColor === "#3b82f6", "LOW status color is blue");
  assert(low.comparison.band === "BELOW_Q1", "LOW band is BELOW_Q1");

  // NORMAL: Q1 ≤ value < Q3
  const normalLow = calculateWasteStatus(83.0, sampleBaseline);
  assert(normalLow.status === "NORMAL", "Value 83 = Q1 → NORMAL");

  const normalMid = calculateWasteStatus(98.0, sampleBaseline);
  assert(normalMid.status === "NORMAL", "Value 98 = median → NORMAL");

  const normalHigh = calculateWasteStatus(115.9, sampleBaseline);
  assert(normalHigh.status === "NORMAL", "Value 115.9 < Q3(116) → NORMAL");
  assert(normalHigh.statusColor === "#22c55e", "NORMAL status color is green");

  // HIGH: Q3 ≤ value < P90
  const high = calculateWasteStatus(116.0, sampleBaseline);
  assert(high.status === "HIGH", "Value 116 = Q3 → HIGH");
  assert(high.statusColor === "#f97316", "HIGH status color is orange");
  assert(high.comparison.band === "Q3_TO_P90", "HIGH band is Q3_TO_P90");

  const highUpper = calculateWasteStatus(134.9, sampleBaseline);
  assert(highUpper.status === "HIGH", "Value 134.9 < P90(135) → HIGH");

  // VERY_HIGH: value ≥ P90
  const veryHigh = calculateWasteStatus(135.0, sampleBaseline);
  assert(veryHigh.status === "VERY_HIGH", "Value 135 = P90 → VERY_HIGH");
  assert(veryHigh.statusColor === "#ef4444", "VERY_HIGH status color is red");
  assert(veryHigh.comparison.band === "ABOVE_P90", "VERY_HIGH band is ABOVE_P90");
  assert(veryHigh.comparison.kgAboveP90 === 0, "kgAboveP90 is 0 at boundary");

  const veryHighAbove = calculateWasteStatus(150.0, sampleBaseline);
  assert(veryHighAbove.status === "VERY_HIGH", "Value 150 > P90(135) → VERY_HIGH");
  assert(veryHighAbove.comparison.kgAboveP90 === 15.0, "kgAboveP90 is 15.0");
});

// ── Test 2: UNAVAILABLE for invalid predictions ─────────────────────
describe("UNAVAILABLE for invalid predictions", () => {
  const nullPred = calculateWasteStatus(null, sampleBaseline);
  assert(nullPred.status === "UNAVAILABLE", "null prediction → UNAVAILABLE");
  assert(nullPred.predictedWasteKg === null, "null prediction value preserved");

  const undefinedPred = calculateWasteStatus(undefined, sampleBaseline);
  assert(undefinedPred.status === "UNAVAILABLE", "undefined prediction → UNAVAILABLE");

  const nanPred = calculateWasteStatus(NaN, sampleBaseline);
  assert(nanPred.status === "UNAVAILABLE", "NaN prediction → UNAVAILABLE");

  const infPred = calculateWasteStatus(Infinity, sampleBaseline);
  assert(infPred.status === "UNAVAILABLE", "Infinity prediction → UNAVAILABLE");

  const negInfPred = calculateWasteStatus(-Infinity, sampleBaseline);
  assert(negInfPred.status === "UNAVAILABLE", "-Infinity prediction → UNAVAILABLE");

  const negPred = calculateWasteStatus(-5.0, sampleBaseline);
  assert(negPred.status === "UNAVAILABLE", "Negative prediction → UNAVAILABLE");

  assert(nullPred.statusColor === "#eab308", "UNAVAILABLE status color is light yellow");
});

// ── Test 3: UNAVAILABLE when no baseline ─────────────────────────────
describe("UNAVAILABLE when baseline is missing/invalid", () => {
  const noBl = calculateWasteStatus(100.0, null);
  assert(noBl.status === "UNAVAILABLE", "null baseline → UNAVAILABLE");

  const emptyBl = calculateWasteStatus(100.0, {});
  assert(emptyBl.status === "UNAVAILABLE", "empty baseline → UNAVAILABLE");

  const partialBl = calculateWasteStatus(100.0, { q1Kg: 80 });
  assert(partialBl.status === "UNAVAILABLE", "partial baseline (no q3, p90) → UNAVAILABLE");
});

// ── Test 4: Prediction cannot become a percentage or 100% ───────────
describe("Prediction cannot become a percentage", () => {
  const result = calculateWasteStatus(119.1, sampleBaseline);
  assert(result.predictedWasteKg === 119.1, "Predicted value stays as KG (119.1)");
  assert(typeof result.predictedWasteKg === "number", "predictedWasteKg is a number");
  // Ensure no fillLevel or percentage fields
  assert(result.fillLevel === undefined, "No fillLevel field exists");
  assert(result.utilizationPercent === undefined, "No utilizationPercent field exists");
});

// ── Test 5: Comparison fields ────────────────────────────────────────
describe("Comparison fields are correct", () => {
  const result = calculateWasteStatus(119.1, sampleBaseline);
  assert(result.comparison.kgAboveMedian === 21.1, "kgAboveMedian = 119.1 - 98.0 = 21.1");
  assert(result.comparison.percentAboveMedian === 21.5, "percentAboveMedian ≈ 21.5%");
  assert(result.comparison.kgAboveP90 === null, "kgAboveP90 is null when below P90");
});

// ── Test 6: Per-location baselines ──────────────────────────────────
describe("Per-location baselines from historical_baselines.json", () => {
  const baselines = getAllBaselines();
  const locationIds = [
    "moratuwa-mc", "boralesgamuwa-uc", "kesbewa-uc",
    "dehiwala-mtlavinia", "kotte-mc", "maharagama-uc",
    "homagama-ps", "kdu-campus",
  ];

  assert(Object.keys(baselines).length >= 8, "At least 8 locations have baselines");

  for (const id of locationIds) {
    const bl = getBaseline(id);
    assert(bl !== null, `Baseline exists for ${id}`);
    if (bl) {
      assert(bl.q1Kg > 0, `${id}: Q1 > 0 (${bl.q1Kg})`);
      assert(bl.medianKg >= bl.q1Kg, `${id}: median ≥ Q1`);
      assert(bl.q3Kg >= bl.medianKg, `${id}: Q3 ≥ median`);
      assert(bl.p90Kg >= bl.q3Kg, `${id}: P90 ≥ Q3`);
      assert(bl.sampleSize > 0, `${id}: sampleSize > 0 (${bl.sampleSize})`);
    }
  }

  // Verify different locations have different baselines
  const moratuwa = getBaseline("moratuwa-mc");
  const homagama = getBaseline("homagama-ps");
  if (moratuwa && homagama) {
    assert(
      moratuwa.q1Kg !== homagama.q1Kg || moratuwa.q3Kg !== homagama.q3Kg,
      "Different locations have different baseline values"
    );
  }
});

// ── Test 7: Status labels and colors exact ──────────────────────────
describe("Exact status labels and colors", () => {
  const low = calculateWasteStatus(50, sampleBaseline);
  assert(low.statusLabel === "Low", "LOW → label 'Low'");
  assert(low.statusColor === "#3b82f6", "LOW → blue #3b82f6");

  const normal = calculateWasteStatus(100, sampleBaseline);
  assert(normal.statusLabel === "Normal", "NORMAL → label 'Normal'");
  assert(normal.statusColor === "#22c55e", "NORMAL → green #22c55e");

  const high = calculateWasteStatus(120, sampleBaseline);
  assert(high.statusLabel === "High", "HIGH → label 'High'");
  assert(high.statusColor === "#f97316", "HIGH → orange #f97316");

  const veryHigh = calculateWasteStatus(140, sampleBaseline);
  assert(veryHigh.statusLabel === "Very High", "VERY_HIGH → label 'Very High'");
  assert(veryHigh.statusColor === "#ef4444", "VERY_HIGH → red #ef4444");

  const unavailable = calculateWasteStatus(null, sampleBaseline);
  assert(unavailable.statusLabel === "Unavailable", "UNAVAILABLE → label 'Unavailable'");
  assert(unavailable.statusColor === "#eab308", "UNAVAILABLE → light yellow #eab308");
});

// ── Test 8: Normal weekday can be NORMAL/green ──────────────────────
describe("Normal weekday prediction in normal range → NORMAL/green", () => {
  // A weekday prediction of 100 KG for a location with Q1=83, Q3=116
  const result = calculateWasteStatus(100, sampleBaseline);
  assert(result.status === "NORMAL", "100 KG in [Q1=83, Q3=116) → NORMAL");
  assert(result.statusColor === "#22c55e", "NORMAL is green, not automatically red");
});

// ── Summary ─────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
