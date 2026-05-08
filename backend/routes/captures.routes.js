const { Router } = require("express");
const {
  listCaptures,
  getCapture,
} = require("../controllers/captures.controller");

const router = Router();

router.get("/", listCaptures);
router.get("/:id", getCapture);

module.exports = router;
