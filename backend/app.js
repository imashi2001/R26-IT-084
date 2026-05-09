const express = require("express");
const cors = require("cors");

const { CORS_ORIGINS } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const corsOptions = {
  exposedHeaders: ["X-Capture-Id"],
};
if (CORS_ORIGINS.length > 0) {
  corsOptions.origin = CORS_ORIGINS;
}

app.use(cors(corsOptions));
app.use(express.json());

app.use("/", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
