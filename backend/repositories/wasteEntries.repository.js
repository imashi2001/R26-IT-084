const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "waste_entries.json");

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
  }
}

function readAllEntries() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("[wasteEntries.repository] Read error:", err.message);
    return [];
  }
}

function writeAllEntries(entries) {
  ensureDbFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Waste Entries Repository (MySQL Schema Abstracted)
 *
 * Target MySQL Table Schema:
 *   CREATE TABLE waste_entries (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     entry_date DATE NOT NULL,
 *     vehicle_no VARCHAR(20) NOT NULL,
 *     location_id VARCHAR(100) NOT NULL,
 *     waste_type VARCHAR(100) NOT NULL,
 *     weight_kg DECIMAL(10,2) NOT NULL,
 *     submitted_at DATETIME NOT NULL,
 *     processed_for_training BOOLEAN DEFAULT FALSE
 *   );
 */
class WasteEntriesRepository {
  /**
   * Insert a new waste entry.
   * @param {Object} entryData { entry_date, vehicle_no, location_id, waste_type, weight_kg }
   * @returns {Object} Newly created entry with auto-assigned id and submitted_at timestamp
   */
  static async create(entryData) {
    const entries = readAllEntries();
    const newId = entries.length > 0 ? Math.max(...entries.map((e) => e.id || 0)) + 1 : 1;

    const record = {
      id: newId,
      entry_date: entryData.entry_date,
      vehicle_no: entryData.vehicle_no.trim(),
      location_id: entryData.location_id,
      waste_type: entryData.waste_type,
      weight_kg: Number(Number(entryData.weight_kg).toFixed(2)),
      submitted_at: new Date().toISOString(),
      processed_for_training: false,
    };

    entries.push(record);
    writeAllEntries(entries);
    return record;
  }

  /**
   * Find entries with optional filtering and pagination.
   * @param {Object} options { startDate, endDate, locationId, page = 1, limit = 20 }
   */
  static async findAll(options = {}) {
    const entries = readAllEntries();
    let filtered = [...entries];

    if (options.locationId) {
      filtered = filtered.filter((e) => e.location_id === options.locationId);
    }
    if (options.startDate) {
      filtered = filtered.filter((e) => e.entry_date >= options.startDate);
    }
    if (options.endDate) {
      filtered = filtered.filter((e) => e.entry_date <= options.endDate);
    }

    filtered.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const totalCount = filtered.length;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Number(options.limit) || 20);
    const offset = (page - 1) * limit;

    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  /**
   * Count total entries and total unprocessed entries.
   */
  static async countStats() {
    const entries = readAllEntries();
    const unprocessed = entries.filter((e) => !e.processed_for_training);
    return {
      totalEntries: entries.length,
      unprocessedEntries: unprocessed.length,
    };
  }

  /**
   * Get all unprocessed entries for retraining pipeline.
   */
  static async getUnprocessed() {
    const entries = readAllEntries();
    return entries.filter((e) => !e.processed_for_training);
  }

  /**
   * Mark entries as processed after retraining run.
   */
  static async markProcessed(ids) {
    const idSet = new Set(ids);
    const entries = readAllEntries();
    entries.forEach((e) => {
      if (idSet.has(e.id)) {
        e.processed_for_training = true;
      }
    });
    writeAllEntries(entries);
  }

  /**
   * Update an existing waste entry by ID.
   * @param {number} id
   * @param {Object} entryData
   */
  static async update(id, entryData) {
    const entries = readAllEntries();
    const index = entries.findIndex((e) => e.id === Number(id));
    if (index === -1) return null;

    const existing = entries[index];
    const updated = {
      ...existing,
      entry_date: entryData.entry_date || existing.entry_date,
      vehicle_no: entryData.vehicle_no ? entryData.vehicle_no.trim() : existing.vehicle_no,
      location_id: entryData.location_id || existing.location_id,
      waste_type: entryData.waste_type || existing.waste_type,
      weight_kg: entryData.weight_kg !== undefined ? Number(Number(entryData.weight_kg).toFixed(2)) : existing.weight_kg,
    };

    entries[index] = updated;
    writeAllEntries(entries);
    return updated;
  }

  /**
   * Delete a waste entry by ID.
   * @param {number} id
   */
  static async delete(id) {
    const entries = readAllEntries();
    const index = entries.findIndex((e) => e.id === Number(id));
    if (index === -1) return false;

    entries.splice(index, 1);
    writeAllEntries(entries);
    return true;
  }
}

module.exports = WasteEntriesRepository;
