const { Router } = require("express");
const upload = require("../middleware/upload");
const { requireAuth, requireRole } = require("../middleware/auth");
const dashboardSettings = require("../controllers/dashboardSettings.controller");

const router = Router();

router.get("/settings", dashboardSettings.getSettings);

router.post(
  "/settings/hero",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  dashboardSettings.uploadHero
);

router.delete(
  "/settings/hero",
  requireAuth,
  requireRole("admin"),
  dashboardSettings.deleteHero
);

router.post(
  "/settings/promo",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  dashboardSettings.uploadPromo
);

router.delete(
  "/settings/promo",
  requireAuth,
  requireRole("admin"),
  dashboardSettings.deletePromo
);

module.exports = router;
