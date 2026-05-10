/**
 * /forecast/:deviceId   - 24h risk timeline for a specific bin
 * /forecast             - 24h risk timeline at default coords (or ?lat&lon)
 *
 * Forecasting reuses the rule-based `computeRisk` engine over future
 * weather slots from OpenWeather (or its stub). It does NOT use a
 * separate trained model.
 */

const {
  DEFAULT_WEATHER_LAT,
  DEFAULT_WEATHER_LON,
} = require("../config/env");
const weatherService = require("../services/weatherService");
const { forecastRisk } = require("../services/forecastService");
const deviceService = require("../services/deviceService");
const latestState = require("../services/latestState");
const db = require("../config/db");

function clampHours(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 24;
  return Math.max(3, Math.min(120, n));
}

function buildLatestObservation(deviceId) {
  // Prefer in-memory snapshot for the most recent waste/animal observation.
  const mem = deviceId
    ? latestState.getLatestForDevice(deviceId) || latestState.getLatest()
    : latestState.getLatest();

  if (!mem) {
    return {
      waste: null,
      animals: [],
      source: "none",
    };
  }

  const extras = mem.extras || {};
  const waste = extras.waste_label
    ? { label: extras.waste_label, confidence: extras.waste_confidence }
    : null;

  // mem.predictions already has the YOLO detection shape we feed the engine.
  const animals = (mem.predictions || []).map((p) => ({
    class_name: p.label,
    label: p.label,
    confidence: Number(p.confidence) || 0,
    box: Array.isArray(p.box) ? p.box.map(Number) : [0, 0, 0, 0],
  }));

  return { waste, animals, source: "latest" };
}

async function getForecastForDevice(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    if (!db.isDbEnabled()) {
      return res.status(503).json({
        error: "Database not configured. Forecast per device requires DATABASE_URL.",
      });
    }

    const device = await deviceService.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const lat = Number.isFinite(Number(device.latitude))
      ? Number(device.latitude)
      : DEFAULT_WEATHER_LAT;
    const lon = Number.isFinite(Number(device.longitude))
      ? Number(device.longitude)
      : DEFAULT_WEATHER_LON;
    const hours = clampHours(req.query.hours);

    const slots = await weatherService.getForecast(lat, lon, hours);
    const obs = buildLatestObservation(id);

    const out = forecastRisk({
      forecastSlots: slots,
      waste: obs.waste,
      animals: obs.animals,
      binDoc: {
        name: device.name,
        hours_since_clean: 0,
      },
    });

    return res.json({
      device: {
        id: device.id,
        name: device.name,
        esp32_id: device.esp32_id,
        latitude: device.latitude,
        longitude: device.longitude,
      },
      hours,
      observation_source: obs.source,
      ...out,
    });
  } catch (err) {
    return next(err);
  }
}

async function getForecastDefault(req, res, next) {
  try {
    const lat = Number.isFinite(Number(req.query.lat))
      ? Number(req.query.lat)
      : DEFAULT_WEATHER_LAT;
    const lon = Number.isFinite(Number(req.query.lon))
      ? Number(req.query.lon)
      : DEFAULT_WEATHER_LON;
    const hours = clampHours(req.query.hours);

    const slots = await weatherService.getForecast(lat, lon, hours);
    const obs = buildLatestObservation(null);

    const out = forecastRisk({
      forecastSlots: slots,
      waste: obs.waste,
      animals: obs.animals,
      binDoc: { name: "default location", hours_since_clean: 0 },
    });

    return res.json({
      lat,
      lon,
      hours,
      observation_source: obs.source,
      ...out,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getForecastForDevice, getForecastDefault };
