const { MAPTILER_KEY } = require("../config/env");

function tileUrl(dark) {
  if (MAPTILER_KEY) {
    const style = dark ? "dataviz-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
  }
  return dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

function getMapConfig(_req, res) {
  const key = MAPTILER_KEY;
  return res.json({
    provider: key ? "maptiler" : "carto",
    maptiler_key: key,
    tile_url_dark: tileUrl(true),
    tile_url_light: tileUrl(false),
    attribution: key
      ? "© MapTiler © OpenStreetMap contributors"
      : "© OpenStreetMap contributors © CARTO",
  });
}

module.exports = { getMapConfig };
