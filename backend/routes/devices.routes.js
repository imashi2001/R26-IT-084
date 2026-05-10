const { Router } = require("express");

const devices = require("../controllers/devices.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/map", devices.mapPins);
router.get("/nearest", devices.nearest);

router.get("/", devices.list);

router.post("/", requireAuth, requireRole("admin"), devices.create);

router.patch("/:id", requireAuth, requireRole("admin"), devices.patch);

router.get("/:id/captures", devices.listCapturesForDevice);
router.get("/:id/latest", devices.latestDetail);
router.get("/:id/image/latest", devices.latestImage);

router.get("/:id", devices.getOne);

module.exports = router;
