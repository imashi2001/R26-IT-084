require("dotenv").config();

/**
 * Normalize model microservice base URL for axios.
 * - Keeps explicit http:// or https://
 * - localhost / 127.x without scheme → http:// (local dev)
 * - Host-only Railway-style domains → https:// (avoids broken relative URLs)
 */
function normalizeModelServiceUrl(raw, fallback) {
  const fb = fallback || "http://localhost:6000";
  let s = (raw || "").trim().replace(/\/+$/, "");
  if (!s) return fb;
  if (/^https?:\/\//i.test(s)) return s;
  const hostPart = s.split("/")[0];
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(hostPart)) {
    return `http://${s}`;
  }
  return `https://${s}`;
}

const MODEL_YOLO_URL_RAW = process.env.MODEL_YOLO_URL || "";

const MODEL_REGISTRY = {
  yolo: normalizeModelServiceUrl(
    MODEL_YOLO_URL_RAW,
    "http://localhost:6000"
  ),
};

const DATABASE_URL = process.env.DATABASE_URL || null;

/** Comma-separated allowed origins; empty = permissive default (all origins). */
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || "";
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  PORT: Number(process.env.PORT || 5000),
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "yolo",
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
};
