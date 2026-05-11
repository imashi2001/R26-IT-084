require("dotenv").config();

/**
 * Normalize model microservice base URL for axios.
 * - Keeps explicit http:// or https://
 * - localhost / 127.x without scheme → http:// (local dev)
 * - Host-only Railway-style domains → https:// (avoids broken relative URLs)
 */
function normalizeModelServiceUrl(raw, fallback) {
  const fb = fallback || "http://localhost:8001";
  let s = (raw || "").trim().replace(/\/+$/, "");
  if (!s) return fb;
  if (/^https?:\/\//i.test(s)) return s;
  const hostPart = s.split("/")[0];
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(hostPart)) {
    return `http://${s}`;
  }
  return `https://${s}`;
}

const MODEL_WASTE_URL_RAW = process.env.MODEL_WASTE_URL || "";
const MODEL_ANIMAL_URL_RAW = process.env.MODEL_ANIMAL_URL || "";
const MODEL_YOLO_URL_RAW = process.env.MODEL_YOLO_URL || "";
const MODEL_LITTER_URL_RAW = process.env.MODEL_LITTER_URL || "";

/**
 * FastAPI services (waste, animal) plus optional Flask model-yolo (bin fill)
 * and optional litter-severity-api (YOLO + LSI).
 */
const MODEL_REGISTRY = {
  waste: normalizeModelServiceUrl(
    MODEL_WASTE_URL_RAW,
    "http://localhost:8001"
  ),
  animal: normalizeModelServiceUrl(
    MODEL_ANIMAL_URL_RAW,
    "http://localhost:8002"
  ),
};

if (MODEL_YOLO_URL_RAW.trim()) {
  MODEL_REGISTRY.yolo = normalizeModelServiceUrl(
    MODEL_YOLO_URL_RAW,
    "http://localhost:6000"
  );
}

if (MODEL_LITTER_URL_RAW.trim()) {
  MODEL_REGISTRY.litter = normalizeModelServiceUrl(
    MODEL_LITTER_URL_RAW,
    "http://localhost:8003"
  );
}

const DATABASE_URL = process.env.DATABASE_URL || null;

/** Comma-separated allowed origins; empty = permissive default (all origins). */
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || "";
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function parseFloatSafe(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  PORT: Number(process.env.PORT || 5000),
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "waste",
  INFER_TIMEOUT_MS:
    Number(process.env.INFER_TIMEOUT_SECONDS || 60) * 1000,
  MAX_UPLOAD_BYTES:
    Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024,
  MODEL_REGISTRY,

  DATABASE_URL,
  DB_SYNC: String(process.env.DB_SYNC || "false").toLowerCase() === "true",
  DB_SYNC_ALTER:
    String(process.env.DB_SYNC_ALTER || "false").toLowerCase() === "true",
  DB_LOGGING:
    String(process.env.DB_LOGGING || "false").toLowerCase() === "true",
  IS_PROD: process.env.NODE_ENV === "production",

  CORS_ORIGINS,

  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  ADMIN_INVITE_SECRET: process.env.ADMIN_INVITE_SECRET || "",

  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || "",
  DEFAULT_WEATHER_LAT: parseFloatSafe(process.env.DEFAULT_WEATHER_LAT, 6.9271),
  DEFAULT_WEATHER_LON: parseFloatSafe(process.env.DEFAULT_WEATHER_LON, 79.8612),
  HIGH_TEMP_C: parseFloatSafe(process.env.HIGH_TEMP_C, 30),
  HIGH_HUMIDITY_PCT: parseFloatSafe(process.env.HIGH_HUMIDITY_PCT, 70),
};
