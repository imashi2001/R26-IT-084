const { Router } = require("express");
const upload = require("../middleware/upload");
const { analyze } = require("../controllers/litteringAction.controller");

const router = Router();

router.post("/", upload.single("image"), analyze);

module.exports = router;
