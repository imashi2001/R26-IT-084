const { Router } = require("express");
const {
  listCaptures,
  getCapture,
  getCaptureImage,
} = require("../controllers/captures.controller");

const router = Router();

router.get("/", listCaptures);
router.get("/:id/image", getCaptureImage);
router.get("/:id", getCapture);

module.exports = router;
