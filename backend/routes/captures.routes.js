const { Router } = require("express");
const {
  listCaptures,
  getCapture,
  getCaptureImage,
} = require("../controllers/captures.controller");
const { requireAuth, requireAuthAllowQuery } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, listCaptures);
router.get("/:id/image", requireAuthAllowQuery, getCaptureImage);
router.get("/:id", requireAuth, getCapture);

module.exports = router;
