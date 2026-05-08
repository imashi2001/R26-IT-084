require("dotenv").config();

const MODEL_REGISTRY = {
  yolo: process.env.MODEL_YOLO_URL || "http://localhost:6000",
};

const DATABASE_URL = process.env.DATABASE_URL || null;

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
};
