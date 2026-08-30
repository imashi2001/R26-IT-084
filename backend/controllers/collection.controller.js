const db = require("../config/db");
const deviceService = require("../services/deviceService");
const latestState = require("../services/latestState");
const {
  resolveDeviceFillLevel,
  resolveDeviceFillPercentage,
  effectiveFillTier,
} = require("../utils/deviceFill");
const {
  collectionUrgency,
  filterCollectionStops,
  sortCollectionStops,
} = require("../utils/collectionPriority");

function dbRequired(res) {
  if (!db.isDbEnabled()) {
    res.status(503).json({
      error:
        "Database not configured. Set DATABASE_URL on the backend service.",
    });
    return false;
  }
  return true;
}

/**
 * POST /collection/plan
 * Returns ordered Half + Overflow stops (Empty excluded).
 */
async function plan(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const body = req.body || {};
    const startLat = Number(body.start?.latitude ?? body.latitude);
    const startLng = Number(body.start?.longitude ?? body.longitude);
    if (!Number.isFinite(startLat) || !Number.isFinite(startLng)) {
      return res.status(400).json({
        error: "start.latitude and start.longitude are required numbers",
      });
    }

    const devices = await deviceService.listDevicesWithCoordinates();
    const enriched = [];
    let excludedEmptyCount = 0;

    for (const d of devices) {
      const latestCap = await deviceService.getLatestCaptureForDevice(d.id);
      const mem = latestState.getLatestForDevice(d.id);
      const latest_fill_level = resolveDeviceFillLevel(d, { latestCap, mem });
      const latest_fill_percentage = resolveDeviceFillPercentage(d, {
        latestCap,
        mem,
      });
      const tier = effectiveFillTier({
        ...d,
        latest_fill_level,
        latest_fill_percentage,
      });

      if (tier === "empty") {
        excludedEmptyCount += 1;
        continue;
      }

      enriched.push({
        id: d.id,
        name: d.name,
        bin_type: d.bin_type || "smart",
        esp32_id: d.esp32_id,
        location: d.location,
        address: d.address,
        latitude: d.latitude,
        longitude: d.longitude,
        latest_fill_level,
        latest_fill_percentage,
        latest_risk_level: latestCap?.risk_level || null,
        latest_captured_at: latestCap?.captured_at || mem?.timestamp || null,
        manual_fill_level: d.manual_fill_level || null,
        urgency: collectionUrgency({
          latest_fill_level,
          latest_fill_percentage,
          latest_risk_level: latestCap?.risk_level || null,
        }),
        fill_tier: tier,
      });
    }

    const candidates = filterCollectionStops(enriched);
    const ordered = sortCollectionStops(candidates).map((stop, idx) => ({
      ...stop,
      order: idx + 1,
    }));

    return res.json({
      start: { latitude: startLat, longitude: startLng },
      start_mode: body.start_mode === "depot" ? "depot" : "gps",
      stops: ordered,
      excluded_empty_count: excludedEmptyCount,
      total_stops: ordered.length,
      ordering: "overflow_first_then_half_by_urgency",
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { plan };
