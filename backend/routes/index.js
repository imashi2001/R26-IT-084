const { Router } = require("express");

const healthRoutes = require("./health.routes");
const predictRoutes = require("./predict.routes");
const captureRoutes = require("./captures.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/predict", predictRoutes);
router.use("/captures", captureRoutes);

module.exports = router;
