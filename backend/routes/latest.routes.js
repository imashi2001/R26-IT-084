const { Router } = require("express");
const { getLatest, getLatestImage } = require("../controllers/latest.controller");

const router = Router();

router.get("/", getLatest);
router.get("/image", getLatestImage);

module.exports = router;
