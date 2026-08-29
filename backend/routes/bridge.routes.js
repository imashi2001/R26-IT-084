const { Router } = require("express");

const bridge = require("../controllers/bridge.controller");

const router = Router();

router.get("/speaker-pending", bridge.speakerPending);
router.post("/speaker-ack", bridge.speakerAck);

module.exports = router;
