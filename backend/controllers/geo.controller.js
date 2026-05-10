const axios = require("axios");

/**
 * Thin proxy for Nominatim (OpenStreetMap) forward geocoding.
 * Use from the admin UI to resolve addresses without browser CORS limits.
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

    const results = data.map((row) => ({
      label: row.display_name,
      latitude: row.lat != null ? Number(row.lat) : null,
      longitude: row.lon != null ? Number(row.lon) : null,
    }));

    return res.json({ results });
  } catch (e) {
    return next(e);
  }
}

module.exports = { searchPlaces };
