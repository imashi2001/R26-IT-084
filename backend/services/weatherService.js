/**
 * OpenWeather adapter with offline stub fallback.
 *
 * Real mode (when OPENWEATHER_API_KEY is set) hits OpenWeather's free
 * "current weather" + "5-day / 3-hour forecast" endpoints. Otherwise we
 * return a deterministic stub based on lat/lng so the rest of the system
 * can demo end-to-end without a network call.
 *
 * Responses are cached per (lat, lng[, hours]) so we don't hammer the
 * free tier and unit-style tests stay fast.
 */

const axios = require("axios");

const { OPENWEATHER_API_KEY } = require("../config/env");

const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_FORECAST_URL =
  "https://api.openweathermap.org/data/2.5/forecast";

const CACHE_TTL_SEC = 600; // 10 minutes
const FORECAST_CACHE_TTL_SEC = 1800; // 30 minutes
const HTTP_TIMEOUT_MS = 5000;

const _cache = new Map(); // key: "lat,lng" -> { ts, data }
const _forecastCache = new Map(); // key: "lat,lng,hours" -> { ts, data }

function _stubWeather(lat, lng) {
  const baseTemp = 28.0 + ((Math.abs(lat) + Math.abs(lng)) % 5);
  const baseHum = 65.0 + ((Math.abs(lng) * 3) % 20);
  return {
    temp_c: Math.round(baseTemp * 10) / 10,
    humidity_pct: Math.round(baseHum * 10) / 10,
    condition: "Stub",
    description: "stubbed weather (set OPENWEATHER_API_KEY for live data)",
    source: "stub",
    fetched_at: Date.now() / 1000,
  };
}

function _fromOpenweather(payload) {
  const main = payload?.main || {};
  const weatherArr = payload?.weather || [{}];
  return {
    temp_c: Number(main.temp ?? 0),
    humidity_pct: Number(main.humidity ?? 0),
    condition: weatherArr[0]?.main || "Unknown",
    description: weatherArr[0]?.description || "",
    source: "openweather",
    fetched_at: Date.now() / 1000,
  };
}

async function getCurrentWeather(lat, lng) {
  const lat3 = Math.round(lat * 1000) / 1000;
  const lng3 = Math.round(lng * 1000) / 1000;
  const key = `${lat3},${lng3}`;
  const now = Date.now() / 1000;

  const cached = _cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_SEC) return cached.data;

  if (!OPENWEATHER_API_KEY) {
    const data = _stubWeather(lat, lng);
    _cache.set(key, { ts: now, data });
    return data;
  }

  try {
    const r = await axios.get(OPENWEATHER_URL, {
      params: {
        lat,
        lon: lng,
        appid: OPENWEATHER_API_KEY,
        units: "metric",
      },
      timeout: HTTP_TIMEOUT_MS,
    });
    const data = _fromOpenweather(r.data);
    _cache.set(key, { ts: now, data });
    return data;
  } catch (err) {
    const data = _stubWeather(lat, lng);
    data.error = `${err.name || "Error"}: ${err.message}`;
    data.source = "stub-fallback";
    _cache.set(key, { ts: now, data });
    return data;
  }
}

function _stubForecast(lat, lng, hoursAhead) {
  const base = _stubWeather(lat, lng);
  const nowTs = Date.now() / 1000;
  const slots = [];
  const steps = Math.floor(hoursAhead / 3);

  for (let step = 1; step <= steps; step++) {
    const future = nowTs + step * 3 * 3600;
    const utcHour = new Date(future * 1000).getUTCHours();
    const hourOfDay = (utcHour + 5) % 24; // roughly local
    // Day/night swing: warmest ~14:00, coolest ~04:00.
    const diurnal = Math.sin(((hourOfDay - 4) / 24) * 2 * Math.PI);
    const temp = Math.round((base.temp_c + 3.0 * diurnal) * 10) / 10;
    let hum = base.humidity_pct - 8.0 * diurnal;
    hum = Math.max(40, Math.min(95, hum));
    hum = Math.round(hum * 10) / 10;

    slots.push({
      ts: new Date(future * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
      ts_unix: future,
      temp_c: temp,
      humidity_pct: hum,
      condition: "Stub",
      description: "stubbed forecast",
      source: "stub",
    });
  }
  return slots;
}

function _fromOpenweatherForecast(payload, hoursAhead) {
  const items = payload?.list || [];
  const out = [];
  const cutoff = Date.now() / 1000 + hoursAhead * 3600;

  for (const item of items) {
    const tsUnix = Number(item.dt || 0);
    if (tsUnix > cutoff) break;

    const main = item.main || {};
    const weatherArr = item.weather || [{}];
    out.push({
      ts:
        item.dt_txt ||
        new Date(tsUnix * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
      ts_unix: tsUnix,
      temp_c: Number(main.temp ?? 0),
      humidity_pct: Number(main.humidity ?? 0),
      condition: weatherArr[0]?.main || "Unknown",
      description: weatherArr[0]?.description || "",
      source: "openweather",
    });
  }
  return out;
}

async function getForecast(lat, lng, hoursAhead = 24) {
  const hours = Math.max(3, Math.min(120, parseInt(hoursAhead, 10) || 24));
  const lat3 = Math.round(lat * 1000) / 1000;
  const lng3 = Math.round(lng * 1000) / 1000;
  const key = `${lat3},${lng3},${hours}`;
  const now = Date.now() / 1000;

  const cached = _forecastCache.get(key);
  if (cached && now - cached.ts < FORECAST_CACHE_TTL_SEC) return cached.data;

  if (!OPENWEATHER_API_KEY) {
    const data = _stubForecast(lat, lng, hours);
    _forecastCache.set(key, { ts: now, data });
    return data;
  }

  try {
    const r = await axios.get(OPENWEATHER_FORECAST_URL, {
      params: {
        lat,
        lon: lng,
        appid: OPENWEATHER_API_KEY,
        units: "metric",
      },
      timeout: HTTP_TIMEOUT_MS,
    });
    let data = _fromOpenweatherForecast(r.data, hours);
    if (!data.length) data = _stubForecast(lat, lng, hours);
    _forecastCache.set(key, { ts: now, data });
    return data;
  } catch (err) {
    const data = _stubForecast(lat, lng, hours);
    for (const slot of data) {
      slot.error = `${err.name || "Error"}: ${err.message}`;
      slot.source = "stub-fallback";
    }
    _forecastCache.set(key, { ts: now, data });
    return data;
  }
}

module.exports = { getCurrentWeather, getForecast };
