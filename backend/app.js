const express = require("express");
const cors = require("cors");
const path = require("path");

const { CORS_ORIGINS } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);

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
