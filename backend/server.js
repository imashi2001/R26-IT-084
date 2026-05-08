/**
 * Backend API gateway (Express).
 *
 * This service does NOT load any ML model. It only:
 *   - exposes the public REST API
 *   - validates the request
 *   - forwards images to the appropriate model microservice
 *   - returns a unified response shape (and later: stores in DB, auth, etc.)
 *
 * Model services (e.g. model-yolo) are independent processes and are reached
 * via HTTP. Their URLs are configured through environment variables.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const MODEL_REGISTRY = {
  yolo: process.env.MODEL_YOLO_URL || "http://localhost:6000",
};

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "yolo";
const INFER_TIMEOUT_MS =
  Number(process.env.INFER_TIMEOUT_SECONDS || 60) * 1000;

app.get("/health", async (_req, res) => {
  const models = {};

  await Promise.all(
    Object.entries(MODEL_REGISTRY).map(async ([name, url]) => {
      try {
        const r = await axios.get(`${url}/health`, { timeout: 3000 });
        models[name] = { url, ok: true, status: r.status };
      } catch (err) {
        models[name] = {
          url,
          ok: false,
          error: err.message,
        };
      }
    })
  );

  res.json({
    status: "ok",
    service: "backend",
    runtime: "express",
    default_model: DEFAULT_MODEL,
    models,
  });
});

app.post("/predict", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error:
        "No image file provided. Send as multipart/form-data with key 'image'.",
    });
  }

  if (!req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ error: "Empty image received." });
  }

  const modelName = (req.body.model || DEFAULT_MODEL).toString();
  const targetBase = MODEL_REGISTRY[modelName];

  if (!targetBase) {
    return res.status(400).json({
      error: `Unknown model '${modelName}'. Available: ${Object.keys(
        MODEL_REGISTRY
      ).join(", ")}`,
    });
  }

  const conf = req.body.conf || "0.25";

  const form = new FormData();
  form.append("image", req.file.buffer, {
    filename: req.file.originalname || "upload.jpg",
    contentType: req.file.mimetype || "image/jpeg",
  });
  form.append("conf", String(conf));

  const targetUrl = `${targetBase}/infer`;

  try {
    const r = await axios.post(targetUrl, form, {
      headers: form.getHeaders(),
      timeout: INFER_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const predictions = (r.data && r.data.predictions) || [];
    return res.json(predictions);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        error: `Model service '${modelName}' returned ${err.response.status}.`,
        detail: err.response.data,
      });
    }
    return res.status(502).json({
      error: `Could not reach model service '${modelName}' at ${targetUrl}.`,
      detail: err.message,
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: err.message || "Internal error" });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`backend (express) listening on http://0.0.0.0:${PORT}`);
  console.log(`default model: ${DEFAULT_MODEL}`);
  for (const [name, url] of Object.entries(MODEL_REGISTRY)) {
    console.log(`  model[${name}] -> ${url}`);
  }
});
