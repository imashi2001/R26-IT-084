/**
 * wastetrend.routes.js — GET /api/waste-trend
 *
 * Returns 7 historical + 7 forecast daily waste values for a specific location.
 * Uses the trained XGBoost model for both historical reconstructions and forecasts.
 * No random/mock data.
 */

const { Router } = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { shiftDate } = require("../utils/dateUtils");

const router = Router();

const LOCATION_FEATURES = {
  "moratuwa-mc": "Institute_Moratuwa M.C.",
  "boralesgamuwa-uc": "Institute_Other",
  "kesbewa-uc": "Institute_Kesbewa U.C.",
  "dehiwala-mtlavinia": "Institute_Dehiwala - Mt Lavinia",
  "kotte-mc": "Institute_Sri J,puraKotte M.C.",
  "maharagama-uc": "Institute_Maharagama U.C.",
  "homagama-ps": "Institute_Homagama P.S.",
  "kdu-campus": "Institute_Kothalawala Defence University",
};

const CATEGORIES = [
  "Unburnable", "SOW", "Burnable", "Bulky Waste",
  "Industrial Waste", "Slaughter House Waste", "Sanitary Waste", "C & D",
];

/**
 * Build model input rows for a single location on a single date.
 * Calendar flags (holiday, Poya, long weekend) are not computed here: _run_trend.py
 * derives them from dateStr via calendar_features.py, the single definition.
 */
function buildRowsForDate(locationId, dateStr) {
  const instFeature = LOCATION_FEATURES[locationId];
  if (!instFeature) return [];

  const month = parseInt(dateStr.slice(5, 7), 10);

  const rows = [];
  for (const cat of CATEGORIES) {
    const row = {
      dateStr: dateStr,
      Month: month,
      Month_December: month === 12 ? 1 : 0,
      Rainfall_mm: 0,
      Max_Temp_C: 30,
      Waste_Lag_1: 15,
      Waste_Lag_7: 15,
    };

    row[instFeature] = 1;

    if (cat === "Unburnable") row["Category_Unburnable"] = 1;
    else if (cat === "SOW") row["Category_SOW"] = 1;
    else if (cat === "Burnable") row["Category_Burnable"] = 1;
    else if (cat === "Industrial Waste") row["Category_Industrial Waste"] = 1;
    else if (cat === "Slaughter House Waste") row["Category_Slaughter House Waste"] = 1;
    else if (cat === "Sanitary Waste") row["Category_Sanitary Waste"] = 1;
    else if (cat === "C & D") row["Category_C & D"] = 1;

    rows.push(row);
  }
  return rows;
}

// ---------- GET /api/waste-trend ----------
router.get("/", (req, res) => {
  const dateStr = req.query.date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const locationId = req.query.location || "moratuwa-mc";

  if (!LOCATION_FEATURES[locationId]) {
    return res.status(400).json({ error: "Unknown location ID: " + locationId });
  }

  // Generate dates: -7 to +7 relative to selected date
  const dates = [];
  for (let i = -7; i <= 7; i++) {
    dates.push(shiftDate(dateStr, i));
  }

  // Build all model rows for all 15 dates
  const allRows = [];
  for (const d of dates) {
    const rows = buildRowsForDate(locationId, d);
    allRows.push(...rows);
  }

  const modelDir = path.join(__dirname, "../../forecasting dashboard");
  const inputPath = path.join(modelDir, "input_trend.json");
  const outputPath = path.join(modelDir, "output_trend.json");

  let predictions = [];
  try {
    fs.writeFileSync(inputPath, JSON.stringify(allRows, null, 2));
    // Runs the checked-in _run_trend.py. This route used to regenerate that file
    // from an embedded copy on every request, silently reverting fixes made to it.
    execSync("python _run_trend.py", { cwd: modelDir, timeout: 30000 });
    const rawOutput = fs.readFileSync(outputPath, "utf8");
    predictions = JSON.parse(rawOutput);
  } catch (err) {
    console.error("[waste-trend] Model execution failed:", err.message);
    return res.json({
      selectedDate: dateStr,
      locationId,
      trend: [],
      error: "Trend prediction unavailable: " + err.message,
    });
  }

  // Parse: 8 categories per date, 15 dates
  const numCategories = CATEGORIES.length;
  const trendPoints = [];
  let idx = 0;

  for (let di = 0; di < dates.length; di++) {
    const d = dates[di];
    let totalKg = 0;
    for (let ci = 0; ci < numCategories; ci++) {
      const val = predictions[idx++];
      if (typeof val === "number" && isFinite(val) && val > 0) {
        totalKg += val;
      }
    }
    totalKg = Math.round(totalKg * 10) / 10;

    const dayOffset = di - 7; // -7 to +7
    trendPoints.push({
      date: d,
      label: new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalWasteKg: totalKg,
      type: dayOffset <= 0 ? "historical" : "forecast",
      isAnchor: dayOffset === 0,
    });
  }

  res.json({
    selectedDate: dateStr,
    locationId,
    trend: trendPoints,
    dataSource: "XGBoost model reconstruction (2023-2025 trained)",
    note: "Daily estimate derived from monthly forecast disaggregated by assumed day-type weights; not a true daily-trained model.",
  });
});

module.exports = router;
