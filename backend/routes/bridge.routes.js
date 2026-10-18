const { Router } = require("express");

const bridge = require("../controllers/bridge.controller");
const { requireDevice } = require("../middleware/auth");

const router = Router();

router.get("/speaker-pending", requireDevice, bridge.speakerPending);
router.post("/speaker-ack", requireDevice, bridge.speakerAck);

module.exports = router;
