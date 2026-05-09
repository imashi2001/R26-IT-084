const { Router } = require("express");

const healthRoutes = require("./health.routes");
const predictRoutes = require("./predict.routes");
const captureRoutes = require("./captures.routes");

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    service: "VisionWaste-api",
    health: "/health",
    predict: "POST /predict (multipart field: image)",
    captures: "GET /captures",
  });
});

router.use("/health", healthRoutes);
router.use("/predict", predictRoutes);
router.use("/captures", captureRoutes);

module.exports = router;
