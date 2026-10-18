const { Router } = require("express");
const upload = require("../middleware/upload");
const { predict } = require("../controllers/predict.controller");
const { requireDevice } = require("../middleware/auth");

const router = Router();

router.post("/", requireDevice, upload.single("image"), predict);

module.exports = router;
