const { Router } = require("express");
const upload = require("../middleware/upload");
const { predict } = require("../controllers/predict.controller");

const router = Router();

router.post("/", upload.single("image"), predict);

module.exports = router;
