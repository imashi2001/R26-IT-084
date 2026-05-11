const { Router } = require("express");
const path = require("path");
const fs = require("fs");

const router = Router();

// ---------- static data ----------
const LOCATIONS = [
  {
    id: "colombo-fort",
    name: "Fort Railway Station",
    region: "Colombo",
    lat: 6.9337271,
    lng: 79.8500803,
    baseLevel: 62,
    holidayBoost: 22,
    longWeekendBoost: 32,
  },
  {
    id: "galle-face",
    name: "Galle Face Green",
    region: "Colombo",
    lat: 6.9249607,
    lng: 79.8444586,
    baseLevel: 55,
    holidayBoost: 28,
    longWeekendBoost: 38,
  },
  {
    id: "kandy-tooth",
    name: "Temple of the Tooth",
    region: "Kandy",
    lat: 7.2936148,
    lng: 80.6413453,
    baseLevel: 48,
    holidayBoost: 35,
    longWeekendBoost: 45,
  },
  {
    id: "anuradhapura",
    name: "Ruwanwelisaya",
    region: "Anuradhapura",
    lat: 8.3499963,
    lng: 80.39639,
    baseLevel: 41,
    holidayBoost: 30,
    longWeekendBoost: 40,
  },
  {
    id: "kataragama",
    name: "Kataragama Temple",
    region: "Kataragama",
    lat: 6.4135586,
    lng: 81.3324423,
    baseLevel: 38,
    holidayBoost: 40,
    longWeekendBoost: 50,
  },
  {
    id: "sri-pada",
    name: "Nallathanniya (Sri Pada)",
    region: "Sri Pada",
    lat: 6.8242395,
    lng: 80.5199628,
    baseLevel: 33,
    holidayBoost: 25,
    longWeekendBoost: 35,
  },
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

/** Temporary lookup table (edit geocode_cache.json on disk without code changes). */
function loadGeocodeCache() {
  try {
    const p = path.join(__dirname, "..", "geocode_cache.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/** Return all holidays for a given YYYY-MM-DD string. */
function getHolidaysForDate(dateStr, cache) {
  const year = dateStr.slice(0, 4);
  const holidays = cache[year] || [];
  return holidays.filter((h) => h.iso_date.slice(0, 10) === dateStr);
}

/** Shift a date string by N days. */
function shiftDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Long-weekend detection rules:
 *
 *  Holiday on Friday  → Fri + Sat + Sun form a long weekend
 *  Holiday on Monday  → Sat + Sun + Mon form a long weekend
 *
 * So for any given date we check:
 *  - Is *this* date a Friday holiday?  (covers Fri itself)
 *  - Is *this* date a Saturday?  → does Friday before or Monday after have a holiday?
 *  - Is *this* date a Sunday?    → does Friday two days before or Monday after have a holiday?
 *  - Is *this* date a Monday holiday? (covers Mon itself)
 *
 * Returns { isLongWeekend, longWeekendDates, triggerHoliday }
 */
function detectLongWeekend(dateStr, cache) {
  const d = new Date(dateStr);
  const dow = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat

  const check = (ds) => getHolidaysForDate(ds, cache);

  let triggerHoliday = null;
  let longWeekendDates = [];

  if (dow === 5) {
    // Friday — is it a holiday?
    const h = check(dateStr);
    if (h.length > 0) {
      triggerHoliday = h[0];
      longWeekendDates = [dateStr, shiftDate(dateStr, 1), shiftDate(dateStr, 2)];
    }
  } else if (dow === 6) {
    // Saturday — check if Friday before has a holiday
    const fri = shiftDate(dateStr, -1);
    const hFri = check(fri);
    if (hFri.length > 0) {
      triggerHoliday = hFri[0];
      longWeekendDates = [fri, dateStr, shiftDate(dateStr, 1)];
    }
    // OR check if Monday after has a holiday
    if (!triggerHoliday) {
      const mon = shiftDate(dateStr, 2);
      const hMon = check(mon);
      if (hMon.length > 0) {
        triggerHoliday = hMon[0];
        longWeekendDates = [dateStr, shiftDate(dateStr, 1), mon];
      }
    }
  } else if (dow === 0) {
    // Sunday — check if Friday two days ago has a holiday
    const fri = shiftDate(dateStr, -2);
    const hFri = check(fri);
    if (hFri.length > 0) {
      triggerHoliday = hFri[0];
      longWeekendDates = [fri, shiftDate(dateStr, -1), dateStr];
    }
    // OR check if Monday after has a holiday
    if (!triggerHoliday) {
      const mon = shiftDate(dateStr, 1);
      const hMon = check(mon);
      if (hMon.length > 0) {
        triggerHoliday = hMon[0];
        longWeekendDates = [shiftDate(dateStr, -1), dateStr, mon];
      }
    }
  } else if (dow === 1) {
    // Monday — is it a holiday?
    const h = check(dateStr);
    if (h.length > 0) {
      triggerHoliday = h[0];
      longWeekendDates = [shiftDate(dateStr, -2), shiftDate(dateStr, -1), dateStr];
    }
  }

  const isLongWeekend = triggerHoliday !== null;
  return { isLongWeekend, longWeekendDates, triggerHoliday };
}

function isWeekend(dateStr) {
  const dow = new Date(dateStr).getDay();
  return dow === 0 || dow === 6;
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function computeFillLevel(loc, dateStr, isHoliday, isWknd, isLongWeekend) {
  const dateSeed =
    dateStr
      .replace(/-/g, "")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0) +
    loc.id.length * 17;

  const rand = seededRandom(dateSeed);
  const noise = (rand() - 0.5) * 14; // ±7

  let level = loc.baseLevel + noise;

  if (isLongWeekend) {
    // Long weekend: biggest boost (supersedes individual holiday + weekend boosts)
    level += loc.longWeekendBoost;
  } else if (isHoliday || isWknd) {
    // Both normal holidays and regular weekends get the holiday boost
    level += loc.holidayBoost;
  }

  return Math.min(100, Math.max(0, Math.round(level)));
}

// ---------- GET /api/waste-data ----------
router.get("/", (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const cache = loadHolidayCache();

  const matchedHolidays = getHolidaysForDate(dateStr, cache);
  const isHoliday = matchedHolidays.length > 0;
  const weekend   = isWeekend(dateStr);

  // Long weekend detection
  const { isLongWeekend, longWeekendDates, triggerHoliday } =
    detectLongWeekend(dateStr, cache);

  const locations = LOCATIONS.map((loc) => {
    const fillLevel = computeFillLevel(
      loc,
      dateStr,
      isHoliday,
      weekend,
      isLongWeekend
    );
    return {
      id: loc.id,
      name: loc.name,
      region: loc.region,
      lat: loc.lat,
      lng: loc.lng,
      fillLevel,
      status:
        fillLevel >= 80 ? "ALERT" : fillLevel >= 60 ? "WATCH" : "NORMAL",
    };
  });

  const avgFill =
    Math.round(
      (locations.reduce((s, l) => s + l.fillLevel, 0) / locations.length) * 10
    ) / 10;

  res.json({
    date: dateStr,
    isHoliday,
    isWeekend: weekend,
    isLongWeekend,
    longWeekendDates,   // e.g. ["2026-01-16", "2026-01-17", "2026-01-18"]
    triggerHoliday,     // the holiday that caused the long weekend
    holidays: matchedHolidays,
    globalAvgFill: avgFill,
    locations,
    geocode_cache: loadGeocodeCache(),
  });
});

module.exports = router;
