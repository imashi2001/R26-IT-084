const { Router } = require("express");
const collection = require("../controllers/collection.controller");

const router = Router();

router.post("/plan", collection.plan);

module.exports = router;
