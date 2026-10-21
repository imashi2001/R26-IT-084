const express = require("express");
const alertsController = require("../controllers/alerts.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, alertsController.listAlerts);
router.patch("/:id", requireAuth, requireRole("admin"), alertsController.patchAlert);

module.exports = router;
