const { Router } = require("express");
const { getLatest, getLatestImage } = require("../controllers/latest.controller");
const { requireAuth, requireAuthAllowQuery } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, getLatest);
router.get("/image", requireAuthAllowQuery, getLatestImage);

module.exports = router;
