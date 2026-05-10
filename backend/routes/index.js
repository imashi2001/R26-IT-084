const { Router } = require("express");

const healthRoutes = require("./health.routes");
const predictRoutes = require("./predict.routes");
const captureRoutes = require("./captures.routes");
const latestRoutes = require("./latest.routes");
const authRoutes = require("./auth.routes");
const devicesRoutes = require("./devices.routes");
const geoRoutes = require("./geo.routes");
const forecastRoutes = require("./forecast.routes");
const weatherRoutes = require("./weather.routes");

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    service: "VisionWaste-api",
    health: "/health",
    auth: "POST /auth/register, POST /auth/login",
    predict:
      "POST /predict (multipart: image, bridge_instance_id, optional esp32_id/device_id, source_type, lat/lon, optional model=waste|animal|yolo|fill|bin_fill|all)",
    forecast:
      "GET /forecast?lat=&lon=&hours=24, GET /forecast/:deviceId?hours=24",
    weather:
      "GET /weather?lat=&lng= (or ?device_id=) — current temp/humidity/condition",
    captures: "GET /captures, GET /captures/:id, GET /captures/:id/image",
    devices:
      "GET /devices, GET /devices/map, GET /devices/nearest, GET /devices/:id/latest, GET /devices/:id/captures",
    geo: "GET /geo/search?q=",
    latest: "GET /latest (JSON) and GET /latest/image (jpeg)",
  });
});

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/devices", devicesRoutes);
router.use("/geo", geoRoutes);
router.use("/predict", predictRoutes);
router.use("/captures", captureRoutes);
router.use("/latest", latestRoutes);
router.use("/forecast", forecastRoutes);
router.use("/weather", weatherRoutes);

module.exports = router;
