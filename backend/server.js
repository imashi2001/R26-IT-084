const app = require("./app");
const {
  PORT,
  DEFAULT_MODEL,
  MODEL_REGISTRY,
  DB_SYNC,
  DB_SYNC_ALTER,
  IS_PROD,
  JWT_SECRET,
  DATABASE_URL,
  DEVICE_API_KEY,
  CORS_ORIGINS,
  ADMIN_INVITE_SECRET,
} = require("./config/env");
const db = require("./config/db");
const models = require("./models");
const WasteEntriesRepository = require("./repositories/wasteEntries.repository");

/**
 * Refuse to boot a production server without the secrets auth depends on,
 * and warn about settings that leave endpoints open.
 */
function checkConfig() {
  const problems = [];
  if (!JWT_SECRET || JWT_SECRET.length < 8) {
    problems.push("JWT_SECRET is missing or shorter than 8 characters.");
  }
  if (!DATABASE_URL) {
    problems.push("DATABASE_URL is not set.");
  }
  if (IS_PROD && problems.length > 0) {
    for (const p of problems) console.error(`[config] ${p}`);
    console.error("[config] Refusing to start in production. Fix the variables above.");
    process.exit(1);
  }
  for (const p of problems) console.warn(`[config] ${p}`);

  if (JWT_SECRET && JWT_SECRET.length < 32) {
    console.warn("[config] JWT_SECRET should be at least 32 random characters.");
  }
  if (!DEVICE_API_KEY) {
    console.warn(
      "[config] DEVICE_API_KEY is not set — /predict, /devices/commands and /bridge/* accept unauthenticated requests."
    );
  }
  if (CORS_ORIGINS.length === 0) {
    console.warn("[config] CORS_ORIGIN is empty — any website can call this API.");
  }
  if (!ADMIN_INVITE_SECRET) {
    console.warn(
      "[config] ADMIN_INVITE_SECRET is not set — only the first admin can register."
    );
  }
}

async function bootstrap() {
  checkConfig();

  const connected = await db.connect();

  if (connected) {
    const registry = models.init();

    if (registry?.WasteEntry) {
      try {
        await registry.WasteEntry.sync();
        console.log("[db] waste_entries table ready.");
      } catch (err) {
        console.error("[db] waste_entries sync failed:", err.message);
      }
    }

    if (DB_SYNC) {
      try {
        await db.getSequelize().sync({ alter: DB_SYNC_ALTER });
        console.log(
          `[db] tables synced (alter=${DB_SYNC_ALTER ? "true" : "false"}).`
        );
      } catch (err) {
        console.error("[db] sync failed:", err.message);
      }
    }

    try {
      const imported = await WasteEntriesRepository.importJsonIfEmpty();
      if (imported > 0) {
        await WasteEntriesRepository.exportSnapshotForRetrain();
      }
    } catch (err) {
      console.error("[wasteEntries] JSON import skipped:", err.message);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`backend (express) listening on http://0.0.0.0:${PORT}`);
    console.log(`default model: ${DEFAULT_MODEL}`);
    for (const [name, url] of Object.entries(MODEL_REGISTRY)) {
      console.log(`  model[${name}] -> ${url}`);
    }
    console.log(`db enabled: ${db.isDbEnabled() ? "yes" : "no"}`);
  });
}

bootstrap().catch((err) => {
  console.error("[bootstrap] fatal:", err);
  process.exit(1);
});
