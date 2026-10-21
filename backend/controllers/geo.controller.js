const axios = require("axios");

/** Sri Lanka bounding box for Nominatim bias (west, south, east, north). */
const LK_VIEWBOX = "79.5,5.9,82.0,9.9";

function mapPlace(row) {
  return {
    label: row.display_name,
    latitude: row.lat != null ? Number(row.lat) : null,
    longitude: row.lon != null ? Number(row.lon) : null,
  };
}

/**
 * Thin proxy for Nominatim (OpenStreetMap) forward geocoding.
 * Biased to Sri Lanka so searches like "Malabe" don't resolve to Kandy by mistake.
 */
async function searchPlaces(req, res, next) {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Query q is required (min 2 chars)" });
    }

    const url = "https://nominatim.openstreetmap.org/search";
    const { data } = await axios.get(url, {
      params: {
        q,
        format: "json",
        limit: 8,
        countrycodes: "lk",
        viewbox: LK_VIEWBOX,
        bounded: 0,
      },
      headers: {
        "User-Agent": "VisionWaste-backend/1.0 (research demo)",
      },
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });

    if (!Array.isArray(data)) {
      return res.status(502).json({ error: "Unexpected geocoder response" });
    }

    const results = data.map(mapPlace);
    return res.json({ results });
  } catch (e) {
    return next(e);
  }
}

/**
 * Reverse geocode GPS coordinates to a human-readable Sri Lanka place name.
 */
async function reversePlace(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng query params are required" });
    }

    const url = "https://nominatim.openstreetmap.org/reverse";
    const { data } = await axios.get(url, {
      params: {
        lat,
        lon: lng,
        format: "json",
        zoom: 14,
        countrycodes: "lk",
      },
      headers: {
        "User-Agent": "VisionWaste-backend/1.0 (research demo)",
      },
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });

    if (!data || data.error) {
      return res.status(502).json({ error: data?.error || "Reverse geocode failed" });
    }

    const label =
      data.address?.neighbourhood ||
      data.address?.suburb ||
      data.address?.city_district ||
      data.address?.town ||
      data.address?.village ||
      data.address?.city ||
      data.address?.county ||
      data.display_name?.split(",")[0] ||
      "My location";

    return res.json({
      label,
      display_name: data.display_name || label,
      latitude: lat,
      longitude: lng,
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { searchPlaces, reversePlace };
