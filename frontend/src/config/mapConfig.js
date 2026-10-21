/**
 * Map tile configuration — MapTiler when VITE_MAPTILER_KEY is set, else CARTO/OSM fallback.
 *
 * Get your key: https://cloud.maptiler.com/account/keys/
 * Styles: https://docs.maptiler.com/cloud/api/static-maps/
 */

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || "").trim();

const CARTO_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_LIGHT =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const MAPTILER_STYLES = {
  dark: "dataviz-dark",
  light: "streets-v2",
};

export const MAP_PROVIDER = MAPTILER_KEY ? "maptiler" : "carto";

export function getMapTileUrl(variant = "dark") {
  if (MAPTILER_KEY) {
    const style = MAPTILER_STYLES[variant] || MAPTILER_STYLES.dark;
    return `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
  }
  return variant === "light" ? CARTO_LIGHT : CARTO_DARK;
}

export const MAP_TILE_DARK = getMapTileUrl("dark");
export const MAP_TILE_LIGHT = getMapTileUrl("light");
export const MAP_TILE = MAP_TILE_DARK;

export const MAP_ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';
