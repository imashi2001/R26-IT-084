/**
 * One-time import: backend/data/waste_entries.json → MySQL waste_entries table.
 *
 * Usage (requires DATABASE_URL):
 *   node scripts/import-waste-entries-json.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const db = require("../config/db");
const models = require("../models");

const JSON_FILE = path.join(__dirname, "..", "data", "waste_entries.json");

async function main() {
  const connected = await db.connect();
  if (!connected) {
    console.error("[import-waste-entries] DATABASE_URL is required.");
    process.exit(1);
  }

  const { WasteEntry } = models.init();
  if (!WasteEntry) {
    console.error("[import-waste-entries] WasteEntry model not registered.");
    process.exit(1);
  }

  if (!fs.existsSync(JSON_FILE)) {
    console.log("[import-waste-entries] No JSON file — nothing to import.");
    process.exit(0);
  }

  const existing = await WasteEntry.count();
  if (existing > 0) {
    console.log(
      `[import-waste-entries] Table already has ${existing} row(s). Skipping import.`
    );
    process.exit(0);
  }

  const raw = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log("[import-waste-entries] JSON empty — nothing to import.");
    process.exit(0);
  }

  const rows = raw.map((e) => ({
    entry_date: e.entry_date,
    vehicle_no: String(e.vehicle_no || "").trim(),
    location_id: e.location_id,
    waste_type: e.waste_type,
    weight_kg: Number(Number(e.weight_kg).toFixed(2)),
    submitted_at: e.submitted_at ? new Date(e.submitted_at) : new Date(),
    processed_for_training: Boolean(e.processed_for_training),
  }));

  await WasteEntry.bulkCreate(rows);
  console.log(`[import-waste-entries] Imported ${rows.length} row(s) into waste_entries.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[import-waste-entries] failed:", err.message);
  process.exit(1);
});
