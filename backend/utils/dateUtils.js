const fs = require("fs");
const path = require("path");

function loadHolidayCache() {
  const cachePath = path.join(__dirname, "..", "..", "forecasting dashboard", "holiday_cache.json");

  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getHolidaysForDate(dateStr, cache = loadHolidayCache()) {
  const year = String(dateStr).slice(0, 4);
  const holidays = cache[year] || [];
  return holidays.filter((holiday) => String(holiday.iso_date || "").slice(0, 10) === dateStr);
}

function isWeekendDate(dateStr) {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

// No holiday / Poya / long-weekend logic here on purpose. The single definition is
// calendar_flags_for_date in waste_forecast/src/calendar_features.py ("National
// holiday" primary_type only); routes read it from the model output. A second JS
// implementation here previously flagged every Friday and Monday as a long weekend.

function getKgThresholds(capacityKg) {
  const capacity = Number(capacityKg);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { watchKg: 0, alertKg: 0 };
  }

  return {
    watchKg: Number((capacity * 0.6).toFixed(1)),
    alertKg: Number((capacity * 0.85).toFixed(1)),
  };
}

function getForecastStatus(predictedWasteKg, capacityKg) {
  const predicted = Number(predictedWasteKg);
  const capacity = Number(capacityKg);

  if (!Number.isFinite(predicted) || predicted <= 0) {
    return "NORMAL";
  }

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return "ALERT";
  }

  const { alertKg, watchKg } = getKgThresholds(capacity);

  if (predicted >= alertKg) return "ALERT";
  if (predicted >= watchKg) return "WATCH";
  return "NORMAL";
}

module.exports = {
  loadHolidayCache,
  getHolidaysForDate,
  isWeekendDate,
  getKgThresholds,
  getForecastStatus,
  shiftDate,
};
