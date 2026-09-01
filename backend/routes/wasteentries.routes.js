const { Router } = require("express");
const WasteEntriesRepository = require("../repositories/wasteEntries.repository");
const {
  runRetrainPipeline: runForecastRetrain,
  fetchModelRegistry,
} = require("../services/forecastModelClient");

const router = Router();
const VEHICLE_REGEX = /^[A-Za-z0-9]{2,3} \d{4}$/;

async function runRetrainPipeline({ force = false } = {}) {
  const entries = await WasteEntriesRepository.exportSnapshotForRetrain();

  const result = await runForecastRetrain({ entries, force });

  if (result.status !== "skipped") {
    try {
      const marked = await WasteEntriesRepository.markAllUnprocessedAsProcessed();
      console.log(
        `[waste-entries] Retrain done; marked ${marked} entries processed (storage=${WasteEntriesRepository.storageMode()}).`
      );
    } catch (markErr) {
      console.error("[waste-entries] markProcessed after retrain:", markErr.message);
    }
  }

  return result;
}

// POST /api/waste-entries
router.post("/", async (req, res) => {
  try {
    const { entry_date, vehicle_no, location_id, waste_type, weight_kg } = req.body;

    if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
      return res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD." });
    }

    if (!vehicle_no || !VEHICLE_REGEX.test(vehicle_no.trim())) {
      return res.status(400).json({
        error: "Invalid Vehicle No. Expected 2-3 alphanumeric characters, a space, and 4 digits (e.g. 251 5678, HW 3628, ACC 2657).",
      });
    }

    if (!location_id || typeof location_id !== "string") {
      return res.status(400).json({ error: "Location is required." });
    }

    if (!waste_type || typeof waste_type !== "string") {
      return res.status(400).json({ error: "Waste Type is required." });
    }

    const weightNum = Number(weight_kg);
    if (isNaN(weightNum) || weightNum <= 0) {
      return res.status(400).json({ error: "Weight (kg) must be a positive number." });
    }

    const newRecord = await WasteEntriesRepository.create({
      entry_date,
      vehicle_no: vehicle_no.trim(),
      location_id,
      waste_type,
      weight_kg: weightNum,
    });

    const stats = await WasteEntriesRepository.countStats();

    let retrainTriggered = false;
    if (stats.unprocessedEntries >= 30) {
      retrainTriggered = true;
      runRetrainPipeline().catch((err) => {
        console.error("[waste-entries] Auto-retrain failed:", err.message);
      });
    }

    return res.status(201).json({
      message: "Waste entry submitted successfully.",
      record: newRecord,
      stats,
      retrainTriggered,
    });
  } catch (err) {
    console.error("[waste-entries] Create error:", err.message);
    const detail = err.message || "Unknown error";
    let hint;
    if (/doesn't exist|no such table|unknown table/i.test(detail)) {
      hint =
        "The waste_entries table is missing. Redeploy the backend (migrations run on start) or run: node scripts/migrate.js";
    }
    return res.status(500).json({
      error: "Failed to save waste entry.",
      detail,
      hint,
      storage: WasteEntriesRepository.storageMode(),
    });
  }
});

// GET /api/waste-entries
router.get("/", async (req, res) => {
  try {
    const { page, limit, locationId, startDate, endDate } = req.query;
    const result = await WasteEntriesRepository.findAll({
      page,
      limit,
      locationId,
      startDate,
      endDate,
    });
    const stats = await WasteEntriesRepository.countStats();
    return res.json({ ...result, stats });
  } catch (err) {
    console.error("[waste-entries] List error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve waste entries." });
  }
});

// GET /api/waste-entries/retrain-status
router.get("/retrain-status", async (_req, res) => {
  try {
    const registryInfo = await fetchModelRegistry();
    const stats = await WasteEntriesRepository.countStats();

    return res.json({
      currentVersion: registryInfo.currentVersion || "v1.0",
      totalEntries: stats.totalEntries,
      unprocessedCount: stats.unprocessedEntries,
      threshold: 30,
      storage: WasteEntriesRepository.storageMode(),
      latestRun: registryInfo.latestRun || null,
      registryHistory: registryInfo.registryHistory || [],
    });
  } catch (err) {
    console.error("[waste-entries] Retrain status error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve retrain status." });
  }
});

// POST /api/waste-entries/trigger-retrain
router.post("/trigger-retrain", async (_req, res) => {
  try {
    const result = await runRetrainPipeline({ force: true });
    const registryInfo = await fetchModelRegistry();
    return res.json({
      message: "Retraining pipeline executed.",
      latestRun: registryInfo.latestRun || result,
      storage: WasteEntriesRepository.storageMode(),
      result,
    });
  } catch (err) {
    console.error("[waste-entries] Trigger retrain error:", err.message);
    return res.status(500).json({ error: "Retraining execution failed." });
  }
});

// PUT /api/waste-entries/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { entry_date, vehicle_no, location_id, waste_type, weight_kg } = req.body;

    if (vehicle_no && !VEHICLE_REGEX.test(vehicle_no.trim())) {
      return res.status(400).json({
        error: "Invalid Vehicle No. Expected 2-3 alphanumeric characters, a space, and 4 digits (e.g. 251 5678, HW 3628).",
      });
    }

    if (weight_kg !== undefined) {
      const weightNum = Number(weight_kg);
      if (isNaN(weightNum) || weightNum <= 0) {
        return res.status(400).json({ error: "Weight (kg) must be a positive number." });
      }
    }

    const updated = await WasteEntriesRepository.update(id, {
      entry_date,
      vehicle_no,
      location_id,
      waste_type,
      weight_kg,
    });

    if (!updated) {
      return res.status(404).json({ error: "Entry not found." });
    }

    const stats = await WasteEntriesRepository.countStats();
    return res.json({ message: "Entry updated successfully.", record: updated, stats });
  } catch (err) {
    console.error("[waste-entries] Update error:", err.message);
    return res.status(500).json({ error: "Failed to update waste entry." });
  }
});

// DELETE /api/waste-entries/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await WasteEntriesRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Entry not found." });
    }
    const stats = await WasteEntriesRepository.countStats();
    return res.json({ message: "Entry deleted successfully.", stats });
  } catch (err) {
    console.error("[waste-entries] Delete error:", err.message);
    return res.status(500).json({ error: "Failed to delete waste entry." });
  }
});

module.exports = router;
