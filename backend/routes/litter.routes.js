const { Router } = require("express");
const upload = require("../middleware/upload");
const { analyze } = require("../controllers/litter.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/", requireAuth, upload.single("image"), analyze);

module.exports = router;
