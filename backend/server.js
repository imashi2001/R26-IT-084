const app = require("./app");
const {
  PORT,
  DEFAULT_MODEL,
  MODEL_REGISTRY,
  DB_SYNC,
  DB_SYNC_ALTER,
} = require("./config/env");
const db = require("./config/db");
const models = require("./models");
const WasteEntriesRepository = require("./repositories/wasteEntries.repository");

async function bootstrap() {
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
