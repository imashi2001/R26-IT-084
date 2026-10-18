const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const { CORS_ORIGINS } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);

// JSON API: no HTML to protect with a CSP. Images (captures, dashboard
// uploads) are embedded by the frontend on another origin, so allow
// cross-origin resource loading.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const corsOptions = {
  exposedHeaders: ["X-Capture-Id"],
};
if (CORS_ORIGINS.length > 0) {
  corsOptions.origin = CORS_ORIGINS;
}

app.use(cors(corsOptions));
app.use(express.json());

app.use(
  "/uploads/dashboard",
  express.static(path.join(__dirname, "uploads", "dashboard"), {
    maxAge: "1h",
    fallthrough: true,
  })
);

app.use("/", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
