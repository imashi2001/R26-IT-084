const { Router } = require("express");
const {
  listCaptures,
  getCapture,
  getCaptureImage,
  getCaptureStats,
  deleteCaptures,
} = require("../controllers/captures.controller");
const {
  requireAuth,
  requireAuthAllowQuery,
  requireRole,
} = require("../middleware/auth");

const router = Router();
const requireAdmin = [requireAuth, requireRole("admin")];

router.get("/", requireAuth, listCaptures);
router.get("/stats", requireAuth, getCaptureStats);
router.delete("/", ...requireAdmin, deleteCaptures);
router.get("/:id/image", requireAuthAllowQuery, getCaptureImage);
router.get("/:id", requireAuth, getCapture);

module.exports = router;
