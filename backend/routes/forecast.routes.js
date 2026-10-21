const { Router } = require("express");
const {
  getForecastForDevice,
  getForecastDefault,
} = require("../controllers/forecast.controller");

const router = Router();

router.get("/", getForecastDefault);
router.get("/:id", getForecastForDevice);

module.exports = router;
