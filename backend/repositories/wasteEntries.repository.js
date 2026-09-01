const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "waste_entries.json");

function ensureJsonFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
  }
}

function readJsonEntries() {
  ensureJsonFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("[wasteEntries.repository] JSON read error:", err.message);
    return [];
  }
}

function writeJsonEntries(entries) {
  ensureJsonFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(entries, null, 2));
}

function getWasteEntryModel() {
  if (!db.isDbEnabled()) return null;
  const models = modelsRegistry.getModels() || modelsRegistry.init();
  return models?.WasteEntry || null;
}

function useDatabase() {
  return Boolean(getWasteEntryModel());
}

function toApiRecord(row) {
  if (!row) return null;
  const j = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    id: j.id,
    entry_date:
      typeof j.entry_date === "string"
        ? j.entry_date.slice(0, 10)
        : j.entry_date,
    vehicle_no: j.vehicle_no,
    location_id: j.location_id,
    waste_type: j.waste_type,
    weight_kg: Number(Number(j.weight_kg).toFixed(2)),
    submitted_at:
      j.submitted_at instanceof Date
        ? j.submitted_at.toISOString()
        : j.submitted_at,
    processed_for_training: Boolean(j.processed_for_training),
  };
}

function buildWhere(options = {}) {
  const where = {};
  if (options.locationId) {
    where.location_id = options.locationId;
  }
  if (options.startDate || options.endDate) {
    where.entry_date = {};
    if (options.startDate) where.entry_date[Op.gte] = options.startDate;
    if (options.endDate) where.entry_date[Op.lte] = options.endDate;
  }
  return where;
}

/**
 * Waste entries repository — Sequelize (MySQL) when DATABASE_URL is set,
 * otherwise JSON file fallback for local dev without a database.
 */
class WasteEntriesRepository {
  static async create(entryData) {
    const payload = {
      entry_date: entryData.entry_date,
      vehicle_no: String(entryData.vehicle_no).trim(),
      location_id: entryData.location_id,
      waste_type: entryData.waste_type,
      weight_kg: Number(Number(entryData.weight_kg).toFixed(2)),
      submitted_at: new Date(),
      processed_for_training: false,
    };

    const WasteEntry = getWasteEntryModel();
    if (WasteEntry) {
      const row = await WasteEntry.create(payload);
      return toApiRecord(row);
    }

    const entries = readJsonEntries();
    const newId =
      entries.length > 0 ? Math.max(...entries.map((e) => e.id || 0)) + 1 : 1;
    const record = {
      id: newId,
      ...payload,
      submitted_at: payload.submitted_at.toISOString(),
    };
    entries.push(record);
    writeJsonEntries(entries);
    return record;
  }

  static async findAll(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Number(options.limit) || 20);
    const offset = (page - 1) * limit;
    const where = buildWhere(options);

    const WasteEntry = getWasteEntryModel();
    if (WasteEntry) {
      const { count, rows } = await WasteEntry.findAndCountAll({
        where,
        order: [["submitted_at", "DESC"]],
        limit,
        offset,
      });
      return {
        items: rows.map(toApiRecord),
        totalCount: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      };
    }

    let filtered = readJsonEntries();
    if (options.locationId) {
      filtered = filtered.filter((e) => e.location_id === options.locationId);
    }
    if (options.startDate) {
      filtered = filtered.filter((e) => e.entry_date >= options.startDate);
    }
    if (options.endDate) {
      filtered = filtered.filter((e) => e.entry_date <= options.endDate);
    }
    filtered.sort(
      (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
    );
    const totalCount = filtered.length;
    return {
      items: filtered.slice(offset, offset + limit),
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  static async countStats() {
    const WasteEntry = getWasteEntryModel();
    if (WasteEntry) {
      const totalEntries = await WasteEntry.count();
      const unprocessedEntries = await WasteEntry.count({
        where: { processed_for_training: false },
      });
      return { totalEntries, unprocessedEntries };
    }

    const entries = readJsonEntries();
    return {
      totalEntries: entries.length,
      unprocessedEntries: entries.filter((e) => !e.processed_for_training)
        .length,
    };
  }

  static async getUnprocessed() {
    const WasteEntry = getWasteEntryModel();
    if (WasteEntry) {
      const rows = await WasteEntry.findAll({
        where: { processed_for_training: false },
        order: [["submitted_at", "ASC"]],
      });
      return rows.map(toApiRecord);
    }
    return readJsonEntries().filter((e) => !e.processed_for_training);
  }

  static async markProcessed(ids) {
    const idList = (ids || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (idList.length === 0) return;

    const WasteEntry = getWasteEntryModel();
    if (WasteEntry) {
      await WasteEntry.update(
        { processed_for_training: true },
        { where: { id: { [Op.in]: idList } } }
      );
      return;
    }

    const entries = readJsonEntries();
    const idSet = new Set(idList);
    entries.forEach((e) => {
      if (idSet.has(e.id)) e.processed_for_training = true;
    });
    writeJsonEntries(entries);
  }

  static async markAllUnprocessedAsProcessed() {
    const unprocessed = await this.getUnprocessed();
    const ids = unprocessed.map((e) => e.id);
    await this.markProcessed(ids);
    return ids.length;
  }

  /**
   * Export all rows to backend/data/waste_entries.json for retrain_pipeline.py.
   */
  static async exportSnapshotForRetrain() {
    const WasteEntry = getWasteEntryModel();
    let items;
    if (WasteEntry) {
      const rows = await WasteEntry.findAll({
        order: [["id", "ASC"]],
      });
      items = rows.map(toApiRecord);
    } else {
      items = readJsonEntries();
    }
    ensureJsonFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2));
    return items;
  }

  static async update(id, entryData) {
    const numId = Number(id);
    const WasteEntry = getWasteEntryModel();

    if (WasteEntry) {
      const row = await WasteEntry.findByPk(numId);
      if (!row) return null;

      const patch = {};
      if (entryData.entry_date) patch.entry_date = entryData.entry_date;
      if (entryData.vehicle_no) {
        patch.vehicle_no = String(entryData.vehicle_no).trim();
      }
      if (entryData.location_id) patch.location_id = entryData.location_id;
      if (entryData.waste_type) patch.waste_type = entryData.waste_type;
      if (entryData.weight_kg !== undefined) {
        patch.weight_kg = Number(Number(entryData.weight_kg).toFixed(2));
      }

      await row.update(patch);
      await row.reload();
      return toApiRecord(row);
    }

    const entries = readJsonEntries();
    const index = entries.findIndex((e) => e.id === numId);
    if (index === -1) return null;

    const existing = entries[index];
    const updated = {
      ...existing,
      entry_date: entryData.entry_date || existing.entry_date,
      vehicle_no: entryData.vehicle_no
        ? String(entryData.vehicle_no).trim()
        : existing.vehicle_no,
      location_id: entryData.location_id || existing.location_id,
      waste_type: entryData.waste_type || existing.waste_type,
      weight_kg:
        entryData.weight_kg !== undefined
          ? Number(Number(entryData.weight_kg).toFixed(2))
          : existing.weight_kg,
    };
    entries[index] = updated;
    writeJsonEntries(entries);
    return updated;
  }

  static async delete(id) {
    const numId = Number(id);
    const WasteEntry = getWasteEntryModel();

    if (WasteEntry) {
      const deleted = await WasteEntry.destroy({ where: { id: numId } });
      return deleted > 0;
    }

    const entries = readJsonEntries();
    const index = entries.findIndex((e) => e.id === numId);
    if (index === -1) return false;
    entries.splice(index, 1);
    writeJsonEntries(entries);
    return true;
  }

  static storageMode() {
    return useDatabase() ? "mysql" : "json";
  }

  /**
   * One-time import from backend/data/waste_entries.json when MySQL table is empty.
   * Preserves ids and processed_for_training flags from the JSON file.
   */
  static async importJsonIfEmpty() {
    const WasteEntry = getWasteEntryModel();
    if (!WasteEntry) return 0;

    const existing = await WasteEntry.count();
    if (existing > 0) return 0;

    const jsonEntries = readJsonEntries();
    if (!jsonEntries.length) return 0;

    const rows = jsonEntries.map((e) => ({
      id: e.id,
      entry_date: e.entry_date,
      vehicle_no: String(e.vehicle_no || "").trim(),
      location_id: e.location_id,
      waste_type: e.waste_type,
      weight_kg: Number(Number(e.weight_kg).toFixed(2)),
      submitted_at: e.submitted_at ? new Date(e.submitted_at) : new Date(),
      processed_for_training: Boolean(e.processed_for_training),
    }));

    await WasteEntry.bulkCreate(rows);

    const maxId = Math.max(...rows.map((r) => Number(r.id) || 0));
    if (maxId > 0) {
      const sequelize = WasteEntry.sequelize;
      await sequelize.query(
        "ALTER TABLE waste_entries AUTO_INCREMENT = :next",
        { replacements: { next: maxId + 1 } }
      );
    }

    console.log(
      `[wasteEntries.repository] Imported ${rows.length} row(s) from JSON into waste_entries.`
    );
    return rows.length;
  }
}

module.exports = WasteEntriesRepository;
