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

function isHolidayDate(dateStr, cache = loadHolidayCache()) {
  const holidays = getHolidaysForDate(dateStr, cache);
  return holidays.some((holiday) => !/observance/i.test(holiday.primary_type || ""));
}

function isPoyaDay(dateStr, cache = loadHolidayCache()) {
  const holidays = getHolidaysForDate(dateStr, cache);
  return holidays.some((holiday) => /poya|full moon/i.test(holiday.name || ""));
}

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

function calculateLongWeekend(dateStr, cache = loadHolidayCache()) {
  const normalizedDate = String(dateStr).slice(0, 10);
  const current = new Date(`${normalizedDate}T12:00:00`);
  const dayOfWeek = current.getDay();

  const isPublicHoliday = (candidate) => isHolidayDate(candidate, cache);
  const isNonWorkingDay = (candidate) => isWeekendDate(candidate) || isPublicHoliday(candidate);

  const dayAfter = (offset) => shiftDate(normalizedDate, offset);

  // Rule 1: 3-day long weekend.
  if (dayOfWeek === 5 && isWeekendDate(dayAfter(1)) && isWeekendDate(dayAfter(2))) {
    return {
      isLongWeekend: true,
      longWeekendDays: 3,
      longWeekendDates: [normalizedDate, dayAfter(1), dayAfter(2)],
      triggerHoliday: getHolidaysForDate(normalizedDate, cache)[0] || null,
    };
  }

  if (dayOfWeek === 1 && isWeekendDate(dayAfter(-1)) && isWeekendDate(dayAfter(-2))) {
    return {
      isLongWeekend: true,
      longWeekendDays: 3,
      longWeekendDates: [dayAfter(-2), dayAfter(-1), normalizedDate],
      triggerHoliday: getHolidaysForDate(normalizedDate, cache)[0] || null,
    };
  }

  // Rule 2: 4-day long weekend.
  if (dayOfWeek === 4 && (isWeekendDate(dayAfter(1)) || isPublicHoliday(dayAfter(1)))) {
    return {
      isLongWeekend: true,
      longWeekendDays: 4,
      longWeekendDates: [normalizedDate, dayAfter(1), dayAfter(2), dayAfter(3)],
      triggerHoliday: getHolidaysForDate(dayAfter(1), cache)[0] || null,
    };
  }

  if (dayOfWeek === 1 && (isWeekendDate(dayAfter(-1)) || isPublicHoliday(dayAfter(-1)))) {
    return {
      isLongWeekend: true,
      longWeekendDays: 4,
      longWeekendDates: [dayAfter(-3), dayAfter(-2), dayAfter(-1), normalizedDate],
      triggerHoliday: getHolidaysForDate(dayAfter(-1), cache)[0] || null,
    };
  }

  // Rule 3: 5-day long weekend when a holiday stays inside a continuous non-working cluster.
  for (let startOffset = -2; startOffset <= 2; startOffset += 1) {
    const window = Array.from({ length: 5 }, (_, index) => shiftDate(normalizedDate, startOffset + index));
    const hasHoliday = window.some((value) => isPublicHoliday(value));
    const allNonWorking = window.every((value) => isNonWorkingDay(value));
    if (hasHoliday && allNonWorking) {
      return {
        isLongWeekend: true,
        longWeekendDays: 5,
        longWeekendDates: window,
        triggerHoliday: window.map((value) => getHolidaysForDate(value, cache)[0]).find(Boolean) || null,
      };
    }
  }

  return { isLongWeekend: false, longWeekendDays: 0, longWeekendDates: [], triggerHoliday: null };
}

module.exports = {
  loadHolidayCache,
  getHolidaysForDate,
  isWeekendDate,
  isHolidayDate,
  isPoyaDay,
  getKgThresholds,
  getForecastStatus,
  calculateLongWeekend,
  shiftDate,
};
