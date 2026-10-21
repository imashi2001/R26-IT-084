const { Router } = require("express");

const devices = require("../controllers/devices.controller");
const {
  requireAuth,
  requireAuthAllowQuery,
  requireRole,
  requireDevice,
} = require("../middleware/auth");

const router = Router();

router.get("/map", devices.mapPins);
router.get("/nearest", devices.nearest);

router.get("/", devices.list);

router.post("/", requireAuth, requireRole("admin"), devices.create);

/** ESP32 DFPlayer command poll / ACK (X-Device-Key when DEVICE_API_KEY is set). */
router.get("/commands", requireDevice, devices.pollCommands);
router.post("/commands/:command_id/ack", requireDevice, devices.ackCommand);
router.get(
  "/commands/:command_id",
  requireAuth,
  requireRole("admin"),
  devices.getCommand
);

router.patch("/:id", requireAuth, requireRole("admin"), devices.patch);

/** Laptop bridge speaker relay (existing). */
router.post(
  "/:id/speaker-test",
  requireAuth,
  requireRole("admin"),
  devices.speakerTest
);

/** ESP32 poll-based remote audio test (new; independent of speaker-test). */
router.post(
  "/:id/audio-test",
  requireAuth,
  requireRole("admin"),
  devices.audioTest
);

/** ESP32 poll-based stop playback. */
router.post(
  "/:id/audio-stop",
  requireAuth,
  requireRole("admin"),
  devices.audioStop
);

router.get("/:id/captures", requireAuth, devices.listCapturesForDevice);
router.get("/:id/latest", devices.latestDetail);
router.get("/:id/image/latest", requireAuthAllowQuery, devices.latestImage);

router.get("/:id", devices.getOne);

module.exports = router;
