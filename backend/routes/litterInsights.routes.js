const { Router } = require("express");
const c = require("../controllers/litterInsights.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/settings", requireAuth, c.getAlertSettings);
router.put("/settings", requireAuth, requireRole("admin"), c.saveAlertSettings);
router.get("/summary", requireAuth, c.summary);
router.get("/evidence", requireAuth, c.evidence);
router.post("/feedback", requireAuth, c.feedback);
router.get("/feedback/export", requireAuth, c.feedbackExport);
router.get("/outlines", requireAuth, c.listOutlines);
router.get("/outlines/:deviceId", requireAuth, c.getOutline);
router.put("/outlines/:deviceId", requireAuth, requireRole("admin"), c.saveOutline);
router.delete("/outlines/:deviceId", requireAuth, requireRole("admin"), c.deleteOutline);

module.exports = router;
