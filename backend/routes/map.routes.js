const { Router } = require("express");
const { getMapConfig } = require("../controllers/map.controller");

const router = Router();

router.get("/config", getMapConfig);

module.exports = router;
