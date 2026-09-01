/**
 * HTTP client for the waste-forecast FastAPI microservice (XGBoost).
 * Falls back to local Python exec when MODEL_FORECAST_URL is unset (dev only).
 */

const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { MODEL_FORECAST_URL, FORECAST_TIMEOUT_MS } = require("../config/env");

function isRemoteEnabled() {
  return Boolean(MODEL_FORECAST_URL && String(MODEL_FORECAST_URL).trim());
}

/**
 * @param {object[]} rows Feature rows for the model
 * @param {{ mode?: string }} [opts] mode=auto|trend
 * @returns {Promise<{ predictions: number[], reliability?: string, reliabilityNote?: string|null, error?: string }>}
 */
async function runForecastPredict(rows, opts = {}) {
  const mode = opts.mode || "auto";

  if (isRemoteEnabled()) {
    const base = String(MODEL_FORECAST_URL).replace(/\/+$/, "");
    const res = await axios.post(
      `${base}/predict`,
      { rows, mode },
      { timeout: FORECAST_TIMEOUT_MS, validateStatus: () => true }
    );
    if (res.status >= 200 && res.status < 300 && res.data) {
      return res.data;
    }
    const detail =
      res.data?.detail || res.data?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }

  return runLocalPredict(rows, mode);
}

/**
 * @returns {Promise<object>}
 */
async function fetchSeasonalInsights() {
  if (isRemoteEnabled()) {
    const base = String(MODEL_FORECAST_URL).replace(/\/+$/, "");
    const res = await axios.get(`${base}/insights`, {
      timeout: FORECAST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    throw new Error(res.data?.detail || `HTTP ${res.status}`);
  }

  const repoRoot = path.join(__dirname, "..", "..");
  const pyCmd =
    "import sys, json; sys.path.insert(0, 'waste_forecast/src'); from load_data import compute_seasonal_insights; print(json.dumps(compute_seasonal_insights()))";
  const output = execSync(`python -c "${pyCmd}"`, {
    cwd: repoRoot,
    timeout: 10000,
  }).toString();
  return JSON.parse(output.trim());
}

function runLocalPredict(rows, mode) {
  const repoRoot = path.join(__dirname, "..", "..");
  const modelDir = path.join(repoRoot, "forecasting dashboard");
  const inputName = mode === "trend" ? "input_trend.json" : "input.json";
  const outputName = mode === "trend" ? "output_trend.json" : "output.json";
  const inputPath = path.join(modelDir, inputName);
  const outputPath = path.join(modelDir, outputName);

  fs.writeFileSync(inputPath, JSON.stringify(rows, null, 2));

  if (mode === "trend") {
    execSync("python _run_trend.py", { cwd: modelDir, timeout: 30000 });
    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return { predictions: Array.isArray(parsed) ? parsed : parsed.predictions || [] };
  }

  execSync("python run_model.py", { cwd: modelDir, timeout: 30000 });
  const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  if (Array.isArray(parsed)) {
    return { predictions: parsed };
  }
  return parsed;
}

module.exports = {
  isRemoteEnabled,
  runForecastPredict,
  fetchSeasonalInsights,
};
