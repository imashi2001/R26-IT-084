/**
 * wastedata.routes.js — GET /api/waste-data
 *
 * Runs the trained XGBoost model for the selected date and returns
 * per-location waste forecasts in KG with status classification based
 * on location-specific historical baselines (Q1, Median, Q3, P90).
 *
 * No fill-level percentages. No arbitrary maxCapacity thresholds.
 */

const { Router } = require("express");
const path = require("path");
const fs = require("fs");
const {
  calculateLongWeekend,
  getHolidaysForDate,
  isHolidayDate,
  isPoyaDay,
  isWeekendDate,
  shiftDate,
} = require("../utils/dateUtils");
const {
  calculateWasteStatus,
  getBaseline,
  STATUS_COLORS,
  STATUS_LABELS,
} = require("../utils/wasteStatus");
const { runForecastPredict } = require("../services/forecastModelClient");

const router = Router();

// ---------- static data ----------
const LOCATIONS = [
  { id: "moratuwa-mc", name: "Moratuwa M.C.", region: "Moratuwa", lat: 6.7730, lng: 79.8816 },
  { id: "boralesgamuwa-uc", name: "Boralesgamuwa U.C.", region: "Boralesgamuwa", lat: 6.8480, lng: 79.9035 },
  { id: "kesbewa-uc", name: "Kesbewa U.C.", region: "Kesbewa", lat: 6.8018, lng: 79.9447 },
  { id: "dehiwala-mtlavinia", name: "Dehiwala - Mt Lavinia", region: "Dehiwala", lat: 6.8398, lng: 79.8643 },
  { id: "kotte-mc", name: "Sri J,puraKotte M.C.", region: "Kotte", lat: 6.8880, lng: 79.9187 },
  { id: "maharagama-uc", name: "Maharagama U.C.", region: "Maharagama", lat: 6.8480, lng: 79.9265 },
  { id: "homagama-ps", name: "Homagama P.S.", region: "Homagama", lat: 6.8412, lng: 80.0034 },
  { id: "kdu-campus", name: "Kothalawala Defence University", region: "Kdu", lat: 6.8181, lng: 79.8895 },
];

const CATEGORIES = [
  "Unburnable", "SOW", "Burnable", "Bulky Waste",
  "Industrial Waste", "Slaughter House Waste", "Sanitary Waste", "C & D",
];

// ---------- helpers ----------
function loadHolidayCache() {
  try {
    const p = path.join(__dirname, "..", "..", "forecasting dashboard", "holiday_cache.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Classify the day type for the API response.
 */
function classifyDayType({ isWeekend, isHoliday, isLongWeekend, isPoya }) {
  if (isLongWeekend) return "LONG_WEEKEND";
  if (isPoya) return "POYA_DAY";
  if (isHoliday) return "HOLIDAY";
  if (isWeekend) return "WEEKEND";
  return "NORMAL_WEEKDAY";
}

// ---------- GET /api/waste-data ----------
router.get("/", async (req, res) => {
  // Use selected date from frontend; default to today in Asia/Colombo.
  const dateStr = req.query.date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const cache = loadHolidayCache();

  const matchedHolidays = getHolidaysForDate(dateStr, cache);
  const isHoliday = matchedHolidays.length > 0;
  const weekend = isWeekendDate(dateStr);
  const poyaDay = isPoyaDay(dateStr, cache);

  const { isLongWeekend, longWeekendDays, longWeekendDates, triggerHoliday } =
    calculateLongWeekend(dateStr, cache);

  const effectiveLongWeekendDates = longWeekendDates && longWeekendDates.length ? longWeekendDates : [];

  // Track adjustments applied (for transparency)
  const adjustmentLog = {
    weekendOrLongWeekend: (weekend || isLongWeekend) ? 1.5 : 1.0,
    poya: poyaDay ? "category-specific (1.15–1.20)" : 1.0,
    moratuwaDecember: parseInt(dateStr.slice(5, 7), 10) === 12 ? 1.25 : 1.0,
    note: "Adjustments applied in run_model.py (Python) post-prediction",
  };

  // Construct input rows for model
  const rows = [];
  const month = parseInt(dateStr.slice(5, 7), 10);

  for (const loc of LOCATIONS) {
    for (const cat of CATEGORIES) {
      const row = {
        dateStr: dateStr,
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

      // One-hot encode location
      if (loc.id === "moratuwa-mc") row["Institute_Moratuwa M.C."] = 1;
      else if (loc.id === "boralesgamuwa-uc") row["Institute_Other"] = 1;
      else if (loc.id === "kesbewa-uc") row["Institute_Kesbewa U.C."] = 1;
      else if (loc.id === "dehiwala-mtlavinia") row["Institute_Dehiwala - Mt Lavinia"] = 1;
      else if (loc.id === "kotte-mc") row["Institute_Sri J,puraKotte M.C."] = 1;
      else if (loc.id === "maharagama-uc") row["Institute_Maharagama U.C."] = 1;
      else if (loc.id === "homagama-ps") row["Institute_Homagama P.S."] = 1;
      else if (loc.id === "kdu-campus") row["Institute_Kothalawala Defence University"] = 1;

      // One-hot encode category
      if (cat === "Unburnable") row["Category_Unburnable"] = 1;
      else if (cat === "SOW") row["Category_SOW"] = 1;
      else if (cat === "Burnable") row["Category_Burnable"] = 1;
      else if (cat === "Industrial Waste") row["Category_Industrial Waste"] = 1;
      else if (cat === "Slaughter House Waste") row["Category_Slaughter House Waste"] = 1;
      else if (cat === "Sanitary Waste") row["Category_Sanitary Waste"] = 1;
      else if (cat === "C & D") row["Category_C & D"] = 1;

      rows.push(row);
    }
  }

  // Run XGBoost model (Railway forecast-api or local Python fallback)
  let predictions = [];
  let modelError = null;
  let reliability = "reliable";
  let reliabilityNote = null;

  try {
    const modelOut = await runForecastPredict(rows, { mode: "auto" });
    if (modelOut.error) {
      throw new Error(modelOut.error);
    }
    predictions = modelOut.predictions || [];
    reliability = modelOut.reliability || "reliable";
    reliabilityNote = modelOut.reliabilityNote || null;
  } catch (err) {
    console.error("[waste-data] ML model execution failed:", err.message);
    modelError = err.message;
    predictions = [];
  }

  // Parse predictions back to locations.
  // Model output is already in KG (conversion handled in run_model.py).
  // NO further KG conversion here.
  let index = 0;
  const locations = LOCATIONS.map((loc) => {
    const baseline = getBaseline(loc.id);

    // If model failed, return UNAVAILABLE for all locations
    if (modelError || predictions.length === 0) {
      return {
        id: loc.id,
        name: loc.name,
        region: loc.region,
        lat: loc.lat,
        lng: loc.lng,
        forecastDate: dateStr,
        predictedWasteKg: null,
        unit: "kg",
        status: "UNAVAILABLE",
        statusLabel: "Unavailable",
        statusColor: "#eab308",
        baseline: baseline ? {
          method: baseline.method,
          periodStart: baseline.periodStart,
          periodEnd: baseline.periodEnd,
          sampleSize: baseline.sampleSize,
          q1Kg: baseline.q1Kg,
          medianKg: baseline.medianKg,
          q3Kg: baseline.q3Kg,
          p90Kg: baseline.p90Kg,
        } : null,
        comparison: null,
        composition: null,
        compositionMethod: null,
        adjustments: adjustmentLog,
        error: "Prediction unavailable",
      };
    }

    const composition = {};
    let totalWaste = 0;

    for (const cat of CATEGORIES) {
      let predVal = predictions[index++];
      if (predVal === undefined || typeof predVal !== "number" || isNaN(predVal)) {
        predVal = null;
      }

      if (predVal !== null) {
        // Model output is already in KG after run_model.py adjustments.
        // Only clamp negative values to 0.
        predVal = Math.max(0, Math.round(predVal * 10) / 10);
      }

      composition[cat] = predVal;
      if (predVal !== null) {
        totalWaste += predVal;
      }
    }

    totalWaste = Math.round(totalWaste * 10) / 10;

    // Calculate status using location-specific historical baseline
    const statusResult = calculateWasteStatus(totalWaste, baseline);

    // Compute composition proportions for the category chart
    const compositionWithPercent = {};
    for (const [cat, kg] of Object.entries(composition)) {
      compositionWithPercent[cat] = {
        kg: kg,
        percent: totalWaste > 0 && kg !== null ? Number(((kg / totalWaste) * 100).toFixed(1)) : 0,
      };
    }

    return {
      id: loc.id,
      name: loc.name,
      region: loc.region,
      lat: loc.lat,
      lng: loc.lng,
      forecastDate: dateStr,
      predictedWasteKg: statusResult.predictedWasteKg,
      unit: "kg",
      status: statusResult.status,
      statusLabel: statusResult.statusLabel,
      statusColor: statusResult.statusColor,
      baseline: statusResult.baseline,
      comparison: statusResult.comparison,
      composition: compositionWithPercent,
      compositionMethod: "historical_category_ratio_estimate",
      adjustments: adjustmentLog,
    };
  });

  // Compute summary statistics
  const validLocations = locations.filter((l) => l.status !== "UNAVAILABLE");
  const totalPredictedWasteKg = validLocations.reduce((s, l) => s + (l.predictedWasteKg || 0), 0);
  const averagePredictedWasteKg =
    validLocations.length > 0
      ? Number((totalPredictedWasteKg / validLocations.length).toFixed(1))
      : 0;

  const veryHighCount = locations.filter((l) => l.status === "VERY_HIGH").length;
  const highCount = locations.filter((l) => l.status === "HIGH").length;
  const normalCount = locations.filter((l) => l.status === "NORMAL").length;
  const lowCount = locations.filter((l) => l.status === "LOW").length;
  const unavailableCount = locations.filter((l) => l.status === "UNAVAILABLE").length;

  const dayType = classifyDayType({
    isWeekend: weekend,
    isHoliday,
    isLongWeekend,
    isPoya: poyaDay,
  });

  res.json({
    selectedDate: dateStr,
    reliability,
    reliabilityNote,
    dayType,
    isHoliday,
    isWeekend: weekend,
    isPoya: poyaDay,
    isLongWeekend,
    longWeekendDays,
    longWeekendDates: effectiveLongWeekendDates,
    triggerHoliday,
    holidays: matchedHolidays,
    summary: {
      totalPredictedWasteKg: Number(totalPredictedWasteKg.toFixed(1)),
      averagePredictedWasteKg,
      veryHighCount,
      highCount,
      normalCount,
      lowCount,
      unavailableCount,
      totalSites: locations.length,
    },
    locations,
  });
});

module.exports = router;
