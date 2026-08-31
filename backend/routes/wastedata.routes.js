const { Router } = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const {
  calculateLongWeekend,
  getForecastStatus,
  getHolidaysForDate,
  getKgThresholds,
  isHolidayDate,
  isPoyaDay,
  isWeekendDate,
} = require("../utils/dateUtils");

const router = Router();

// ---------- static data ----------
const LOCATIONS = [
  { id: "moratuwa-mc", name: "Moratuwa M.C.", maxCapacity: 45, region: "Moratuwa", lat: 6.7730, lng: 79.8816 },
  { id: "boralesgamuwa-uc", name: "Boralesgamuwa U.C.", maxCapacity: 25, region: "Boralesgamuwa", lat: 6.8480, lng: 79.9035 },
  { id: "kesbewa-uc", name: "Kesbewa U.C.", maxCapacity: 50, region: "Kesbewa", lat: 6.8018, lng: 79.9447 },
  { id: "dehiwala-mtlavinia", name: "Dehiwala - Mt Lavinia ", maxCapacity: 80, region: "Dehiwala", lat: 6.8398, lng: 79.8643 },
  { id: "kotte-mc", name: "Sri J,puraKotte M.C.", maxCapacity: 20, region: "Kotte", lat: 6.8880, lng: 79.9187 },
  { id: "maharagama-uc", name: "Maharagama U.C.", maxCapacity: 60, region: "Maharagama", lat: 6.8480, lng: 79.9265 },
  { id: "homagama-ps", name: "Homagama P.S.", maxCapacity: 30, region: "Homagama", lat: 6.8412, lng: 80.0034 },
  { id: "kdu-campus", name: "Kothalawala Defence University ", maxCapacity: 5, region: "Kdu", lat: 6.8181, lng: 79.8895 }
];

const CATEGORIES = [
  "Unburnable", "SOW", "Burnable", "Bulky Waste", "Industrial Waste", "Slaughter House Waste", "Sanitary Waste", "C & D"
];

// ---------- helpers ----------
function loadHolidayCache() {
  try {
    const p = path.join(__dirname, "..", "holiday_cache.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function loadGeocodeCache() {
  try {
    const p = path.join(__dirname, "..", "geocode_cache.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function isWeekend(dateStr) {
  return isWeekendDate(dateStr);
}

// ---------- GET /api/waste-data ----------
router.get("/", (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const cache = loadHolidayCache();

  const matchedHolidays = getHolidaysForDate(dateStr, cache);
  const isHoliday = matchedHolidays.length > 0;
  const weekend = isWeekend(dateStr);
  const poyaDay = isPoyaDay(dateStr, cache);

  const { isLongWeekend, longWeekendDays, longWeekendDates, triggerHoliday } =
    calculateLongWeekend(dateStr, cache);

  // A long weekend can be 3, 4, or 5 days depending on the Sri Lankan holiday pattern.
  const effectiveLongWeekendDates = longWeekendDates && longWeekendDates.length ? longWeekendDates : [];

  // Construct input rows for model
  const rows = [];
  const month = parseInt(dateStr.slice(5, 7), 10);

  for (const loc of LOCATIONS) {
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
        Waste_Lag_1: Math.round(loc.maxCapacity * 0.4),
        Waste_Lag_7: Math.round(loc.maxCapacity * 0.4),
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

  // Write input.json, execute model, read output.json
  const modelDir = path.join(__dirname, "../../forecasting dashboard");
  const inputPath = path.join(modelDir, "input.json");
  const outputPath = path.join(modelDir, "output.json");
  
  let predictions = [];
  try {
    fs.writeFileSync(inputPath, JSON.stringify(rows, null, 2));
    execSync("python run_model.py", { cwd: modelDir });
    const rawOutput = fs.readFileSync(outputPath, "utf8");
    predictions = JSON.parse(rawOutput);
    if (predictions.error) {
      throw new Error(predictions.error);
    }
  } catch (err) {
    console.error("ML model execution failed, falling back to deterministic predictions:", err.message);
    predictions = rows.map((_, idx) => 5 + (idx % 10));
  }

  const kgConversionFactor = 1.0;

  // Parse predictions back to locations.
  // All model output is treated as kg, and status is derived from capacity-based kg thresholds,
  // not from a synthetic/rounded percentage that can falsely clamp to 100%.
  let index = 0;
  const locations = LOCATIONS.map((loc) => {
    const composition = {};
    let totalWaste = 0;

    for (const cat of CATEGORIES) {
      let predVal = predictions[index++];
      if (predVal === undefined || typeof predVal !== "number" || isNaN(predVal)) {
        predVal = 5.0;
      }

      predVal = Number(predVal) * kgConversionFactor;
      predVal = Math.max(0, Math.round(predVal * 10) / 10);
      composition[cat] = predVal;
      totalWaste += predVal;
    }

    totalWaste = Math.round(totalWaste * 10) / 10;
    const capacityKg = Number(loc.maxCapacity) || 0;
    const thresholdsKg = getKgThresholds(capacityKg);
    const utilizationPercent = capacityKg > 0 ? Number(((totalWaste / capacityKg) * 100).toFixed(1)) : 0;
    const status = getForecastStatus(totalWaste, capacityKg);

    return {
      id: loc.id,
      name: loc.name,
      region: loc.region,
      lat: loc.lat,
      lng: loc.lng,
      maxCapacity: loc.maxCapacity,
      capacityKg,
      totalWaste,
      predictedWasteKg: totalWaste,
      composition,
      utilizationPercent,
      fillLevel: utilizationPercent,
      thresholdsKg,
      status,
    };
  });

  const avgWasteKg =
    locations.reduce((s, l) => s + l.totalWaste, 0) / locations.length;
  const avgUtilizationPercent =
    locations.reduce((s, l) => s + (l.utilizationPercent || 0), 0) / locations.length;

  res.json({
    date: dateStr,
    isHoliday,
    isWeekend: weekend,
    isLongWeekend,
    longWeekendDays,
    longWeekendDates: effectiveLongWeekendDates,
    triggerHoliday,
    holidays: matchedHolidays,
    globalAvgFill: avgUtilizationPercent,
    globalAvgUtilizationPercent: avgUtilizationPercent,
    globalAvgWasteKg: Number(avgWasteKg.toFixed(1)),
    locations,
    geocode_cache: loadGeocodeCache(),
  });
});

module.exports = router;
