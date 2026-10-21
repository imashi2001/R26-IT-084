/**
 * GET /weather
 *
 * Returns current weather (temp / humidity / condition) for a coordinate.
 *
 * Query:
 *   - lat, lng  (optional)  : explicit coordinates
 *   - device_id (optional)  : look up the bin's coords (only honored when
 *                             DB is enabled; falls back silently otherwise)
 *
 * When neither is provided, falls back to DEFAULT_WEATHER_LAT/LON from env.
 *
 * Unlike /latest (which only works after the first capture), /weather is
 * always available because weatherService.getCurrentWeather has a built-in
 * stub fallback when OPENWEATHER_API_KEY is unset.
 */

const {
  DEFAULT_WEATHER_LAT,
  DEFAULT_WEATHER_LON,
} = require("../config/env");
const weatherService = require("../services/weatherService");
const deviceService = require("../services/deviceService");
const db = require("../config/db");

async function resolveCoords(req) {
  const explicitLat = Number(req.query.lat);
  const explicitLng = Number(req.query.lng);
  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
    return { lat: explicitLat, lng: explicitLng, source: "query" };
  }

  const deviceIdRaw = req.query.device_id;
  const deviceId = parseInt(deviceIdRaw, 10);
  if (Number.isFinite(deviceId) && db.isDbEnabled()) {
    try {
      const dev = await deviceService.getDeviceById(deviceId);
      if (
        dev &&
        Number.isFinite(Number(dev.latitude)) &&
        Number.isFinite(Number(dev.longitude))
      ) {
        return {
          lat: Number(dev.latitude),
          lng: Number(dev.longitude),
          source: "device",
          device: {
            id: dev.id,
            name: dev.name,
          },
        };
      }
    } catch {
      // Fall through to default coordinates.
    }
  }

  return {
    lat: DEFAULT_WEATHER_LAT,
    lng: DEFAULT_WEATHER_LON,
    source: "default",
  };
}

async function getCurrent(req, res, next) {
  try {
    const coords = await resolveCoords(req);
    const weather = await weatherService.getCurrentWeather(
      coords.lat,
      coords.lng
    );

    return res.json({
      lat: coords.lat,
      lng: coords.lng,
      coord_source: coords.source,
      device: coords.device || null,
      temp_c: weather.temp_c,
      humidity_pct: weather.humidity_pct,
      condition: weather.condition,
      description: weather.description,
      source: weather.source,
      fetched_at: weather.fetched_at,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCurrent };
