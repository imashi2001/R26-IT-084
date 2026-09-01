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
const {
  getHolidaysForDate,
  isWeekendDate,
  isPoyaDay,
  calculateLongWeekend,
  shiftDate,
} = require("../utils/dateUtils");

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

function loadHolidayCache() {
  try {
    const p = path.join(__dirname, "..", "..", "forecasting dashboard", "holiday_cache.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Build model input rows for a single location on a single date.
 */
function buildRowsForDate(locationId, dateStr, cache) {
  const instFeature = LOCATION_FEATURES[locationId];
  if (!instFeature) return [];

  const month = parseInt(dateStr.slice(5, 7), 10);
  const weekend = isWeekendDate(dateStr);
  const holidays = getHolidaysForDate(dateStr, cache);
  const isHoliday = holidays.length > 0;
  const poyaDay = isPoyaDay(dateStr, cache);
  const { isLongWeekend } = calculateLongWeekend(dateStr, cache);

  const rows = [];
  for (const cat of CATEGORIES) {
    const row = {
      Is_Weekend: weekend ? 1 : 0,
      Is_Holiday: isHoliday ? 1 : 0,
      Is_Long_Weekend: isLongWeekend ? 1 : 0,
      Is_Poya_Day: poyaDay ? 1 : 0,
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

  const cache = loadHolidayCache();

  // Generate dates: -7 to +7 relative to selected date
  const dates = [];
  for (let i = -7; i <= 7; i++) {
    dates.push(shiftDate(dateStr, i));
  }

  // Build all model rows for all 15 dates
  const allRows = [];
  for (const d of dates) {
    const rows = buildRowsForDate(locationId, d, cache);
    allRows.push(...rows);
  }

  const modelDir = path.join(__dirname, "../../forecasting dashboard");
  const inputPath = path.join(modelDir, "input_trend.json");
  const outputPath = path.join(modelDir, "output_trend.json");

  let predictions = [];
  try {
    fs.writeFileSync(inputPath, JSON.stringify(allRows, null, 2));
    // Use XGBoost waste_forecast model and calendar disaggregation
    const script = `
import json, sys, os, pandas as pd, warnings, xgboost as xgb
from pathlib import Path
warnings.filterwarnings('ignore')

ROOT_DIR = Path(os.getcwd()).parents[0]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODEL_PATH = WASTE_FORECAST_DIR / "models" / "model.json"
FEATURE_COLUMNS_PATH = WASTE_FORECAST_DIR / "models" / "feature_columns.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES, CATEGORY_SHARES
except ImportError:
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES, CATEGORY_SHARES

with open('input_trend.json','r') as f: input_data = json.load(f)

def identify_institute_id(row):
    if row.get('Institute_Dehiwala - Mt Lavinia') == 1:
        return 'dehiwala-mtlavinia'
    if row.get('Institute_Moratuwa M.C.') == 1:
        return 'moratuwa-mc'
    if row.get('Institute_Sri J,puraKotte M.C.') == 1:
        return 'kotte-mc'
    if row.get('Institute_Maharagama U.C.') == 1:
        return 'maharagama-uc'
    if row.get('Institute_Kesbewa U.C.') == 1:
        return 'kesbewa-uc'
    if row.get('Institute_Homagama P.S.') == 1:
        return 'homagama-ps'
    if row.get('Institute_Kothalawala Defence University') == 1:
        return 'kdu-campus'
    return 'boralesgamuwa-uc'

def identify_category_name(row):
    if row.get('Category_Burnable') == 1:
        return 'Burnable'
    if row.get('Category_SOW') == 1:
        return 'SOW'
    if row.get('Category_Unburnable') == 1:
        return 'Unburnable'
    if row.get('Category_Sanitary Waste') == 1:
        return 'Sanitary Waste'
    if row.get('Category_Industrial Waste') == 1:
        return 'Industrial Waste'
    if row.get('Category_Slaughter House Waste') == 1:
        return 'Slaughter House Waste'
    if row.get('Category_C & D') == 1:
        return 'C & D'
    return 'Bulky Waste'

seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}

adjusted = []

for idx, row in enumerate(input_data):
    month = row.get('Month', 9)
    date_str = f"2025-{month:02d}-15"
    daily_res = estimate_daily_waste(date_str, mode="forecast")
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    inst_id = identify_institute_id(row)
    cat_name = identify_category_name(row)

    inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
    cat_share = CATEGORY_SHARES.get(cat_name, 0.045)

    item_base_tons = base_daily_tons * inst_share * cat_share
    val = max(0, float(item_base_tons * 1000.0))

    if row.get('Is_Weekend') == 1 or row.get('Is_Long_Weekend') == 1:
        val *= 1.5
    if row.get('Month') == 12 and row.get('Institute_Moratuwa M.C.') == 1:
        val *= seasonal_multipliers['Moratuwa_December']
    if row.get('Is_Poya_Day') == 1:
        if row.get('Category_Unburnable') == 1:
            val *= seasonal_multipliers['Poya_Day_Unburnable']
        elif row.get('Category_SOW') == 1:
            val *= seasonal_multipliers['Poya_Day_SOW']
        elif row.get('Category_Burnable') == 1:
            val *= seasonal_multipliers['Poya_Day_Burnable']
    adjusted.append(val)

with open('output_trend.json','w') as f: json.dump(adjusted, f)
`;
    const scriptPath = path.join(modelDir, "_run_trend.py");
    fs.writeFileSync(scriptPath, script);
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
