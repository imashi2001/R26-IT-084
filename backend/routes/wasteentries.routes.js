const { Router } = require("express");
const path = require("path");
const fs = require("fs");
const WasteEntriesRepository = require("../repositories/wasteEntries.repository");

const router = Router();
const VEHICLE_REGEX = /^[A-Za-z0-9]{2,3} \d{4}$/;

const REPO_ROOT = path.join(__dirname, "..", "..");
const REGISTRY_PATH = path.join(REPO_ROOT, "waste_forecast", "models", "model_registry.json");

function getModelRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch (err) {
    return [];
  }
}

async function runRetrainPipeline({ force = false } = {}) {
  const unprocessedBefore = await WasteEntriesRepository.getUnprocessed();
  await WasteEntriesRepository.exportSnapshotForRetrain();

  const { exec } = require("child_process");
  const args = force ? " --force" : "";
  const cmd = `python waste_forecast/src/retrain_pipeline.py${args}`;

  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: REPO_ROOT, timeout: force ? 30000 : 120000 }, async (err, stdout) => {
      if (err) {
        console.error("[waste-entries] Retrain error:", err.message);
        reject(err);
        return;
      }
      try {
        const marked = await WasteEntriesRepository.markAllUnprocessedAsProcessed();
        console.log(
          `[waste-entries] Retrain done; marked ${marked} entries processed (storage=${WasteEntriesRepository.storageMode()}).`
        );
      } catch (markErr) {
        console.error("[waste-entries] markProcessed after retrain:", markErr.message);
      }
      resolve(stdout);
    });
  });
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
    return res.status(500).json({ error: "Failed to save waste entry." });
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
    const registry = getModelRegistry();
    const stats = await WasteEntriesRepository.countStats();
    const latestRun = registry.length > 0 ? registry[registry.length - 1] : null;

    return res.json({
      currentVersion: latestRun ? latestRun.version : "v1.0",
      totalEntries: stats.totalEntries,
      unprocessedCount: stats.unprocessedEntries,
      threshold: 30,
      storage: WasteEntriesRepository.storageMode(),
      latestRun,
      registryHistory: registry.slice(-5).reverse(),
    });
  } catch (err) {
    console.error("[waste-entries] Retrain status error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve retrain status." });
  }
});

// POST /api/waste-entries/trigger-retrain
router.post("/trigger-retrain", async (_req, res) => {
  try {
    const output = await runRetrainPipeline({ force: true });
    const registry = getModelRegistry();
    const latestRun = registry.length > 0 ? registry[registry.length - 1] : null;
    return res.json({
      message: "Retraining pipeline executed.",
      latestRun,
      storage: WasteEntriesRepository.storageMode(),
      rawOutput: output.trim(),
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
