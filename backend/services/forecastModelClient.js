/**
 * HTTP client for the waste-forecast FastAPI microservice (XGBoost).
 * Falls back to local Python exec when MODEL_FORECAST_URL is unset (dev only).
 */

const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { MODEL_FORECAST_URL, FORECAST_TIMEOUT_MS, IS_PROD } = require("../config/env");

const RETRAIN_TIMEOUT_MS = Number(process.env.FORECAST_RETRAIN_TIMEOUT_MS) || 120000;

let cachedPythonBin = null;

function getRepoRoot() {
  if (process.env.REPO_ROOT) {
    return process.env.REPO_ROOT;
  }
  const backendRoot = path.join(__dirname, "..", "..");
  const monoRoot = path.join(backendRoot, "..");
  if (fs.existsSync(path.join(monoRoot, "waste_forecast"))) {
    return monoRoot;
  }
  if (fs.existsSync(path.join(backendRoot, "waste_forecast"))) {
    return backendRoot;
  }
  return monoRoot;
}

/**
 * Resolve the Python executable used for local forecast subprocesses.
 * Prefers FORECAST_PYTHON, then repo .venv, then any interpreter with xgboost.
 */
function resolvePythonExecutable() {
  if (cachedPythonBin) return cachedPythonBin;
  if (process.env.FORECAST_PYTHON) {
    cachedPythonBin = process.env.FORECAST_PYTHON;
    return cachedPythonBin;
  }

  const repoRoot = getRepoRoot();
  const candidates = [
    path.join(repoRoot, ".venv", "Scripts", "python.exe"),
    path.join(repoRoot, ".venv", "bin", "python"),
    path.join(repoRoot, "waste_forecast", ".venv", "Scripts", "python.exe"),
    path.join(repoRoot, "waste_forecast", ".venv", "bin", "python"),
    "python3",
    "python",
  ];

  for (const bin of candidates) {
    const isPath = bin.includes(path.sep) || bin.includes("/");
    if (isPath && !fs.existsSync(bin)) continue;
    try {
      execSync(`"${bin}" -c "import xgboost; import pandas"`, {
        stdio: "pipe",
        timeout: 8000,
        shell: true,
      });
      cachedPythonBin = bin;
      return bin;
    } catch {
      /* try next */
    }
  }

  cachedPythonBin = process.platform === "win32" ? "python" : "python3";
  return cachedPythonBin;
}

function execPython(args, opts = {}) {
  const py = resolvePythonExecutable();
  return execSync(`"${py}" ${args}`, { shell: true, ...opts });
}

function assertForecastRuntime(mode) {
  if (isRemoteEnabled()) return;
  if (IS_PROD) {
    throw new Error(
      "Forecast model unavailable: set MODEL_FORECAST_URL to your forecast-api Railway URL on the backend service."
    );
  }
  const repoRoot = getRepoRoot();
  const modelDir = path.join(repoRoot, "forecasting dashboard");
  if (!fs.existsSync(path.join(repoRoot, "waste_forecast", "models", "model.json"))) {
    throw new Error(
      `Forecast model files not found under ${repoRoot}/waste_forecast. Deploy forecast-api and set MODEL_FORECAST_URL.`
    );
  }
  if (!fs.existsSync(modelDir)) {
    throw new Error(`Forecast scripts not found at ${modelDir}.`);
  }
}

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

  assertForecastRuntime(mode);
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

  const repoRoot = getRepoRoot();
  const pyCmd =
    "import sys, json; sys.path.insert(0, 'waste_forecast/src'); from load_data import compute_seasonal_insights; print(json.dumps(compute_seasonal_insights()))";
  const output = execPython(`-c "${pyCmd}"`, {
    cwd: repoRoot,
    timeout: 10000,
  }).toString();
  return JSON.parse(output.trim());
}

function runLocalPredict(rows, mode) {
  const repoRoot = getRepoRoot();
  const modelDir = path.join(repoRoot, "forecasting dashboard");
  const inputName = mode === "trend" ? "input_trend.json" : "input.json";
  const outputName = mode === "trend" ? "output_trend.json" : "output.json";
  const inputPath = path.join(modelDir, inputName);
  const outputPath = path.join(modelDir, outputName);

  fs.writeFileSync(inputPath, JSON.stringify(rows, null, 2));

  if (mode === "trend") {
    execPython("_run_trend.py", { cwd: modelDir, timeout: 30000 });
    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return { predictions: Array.isArray(parsed) ? parsed : parsed.predictions || [] };
  }

  execPython("run_model.py", { cwd: modelDir, timeout: 30000 });
  const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  if (Array.isArray(parsed)) {
    return { predictions: parsed };
  }
  return parsed;
}

/**
 * @param {{ entries?: object[], force?: boolean }} [opts]
 * @returns {Promise<object>}
 */
async function runRetrainPipeline(opts = {}) {
  const { entries = [], force = false } = opts;

  if (isRemoteEnabled()) {
    const base = String(MODEL_FORECAST_URL).replace(/\/+$/, "");
    const res = await axios.post(
      `${base}/retrain`,
      { entries, force },
      { timeout: RETRAIN_TIMEOUT_MS, validateStatus: () => true }
    );
    if (res.status >= 200 && res.status < 300 && res.data) {
      return res.data;
    }
    const detail =
      res.data?.detail || res.data?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }

  const repoRoot = getRepoRoot();
  const args = force ? " --force" : "";
  const output = execPython(`waste_forecast/src/retrain_pipeline.py${args}`, {
    cwd: repoRoot,
    timeout: RETRAIN_TIMEOUT_MS,
  }).toString();
  try {
    return JSON.parse(output.trim().split("\n").pop());
  } catch {
    return { status: "completed", rawOutput: output.trim() };
  }
}

/**
 * @returns {Promise<{ currentVersion: string, latestRun: object|null, registryHistory: object[] }>}
 */
async function fetchModelRegistry() {
  if (isRemoteEnabled()) {
    const base = String(MODEL_FORECAST_URL).replace(/\/+$/, "");
    const res = await axios.get(`${base}/registry`, {
      timeout: FORECAST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    throw new Error(res.data?.detail || `HTTP ${res.status}`);
  }

  const repoRoot = getRepoRoot();
  const registryPath = path.join(repoRoot, "waste_forecast", "models", "model_registry.json");
  if (!fs.existsSync(registryPath)) {
    return { currentVersion: "v1.0", latestRun: null, registryHistory: [] };
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const latestRun = registry.length > 0 ? registry[registry.length - 1] : null;
  return {
    currentVersion: latestRun ? latestRun.version : "v1.0",
    latestRun,
    registryHistory: registry.slice(-5).reverse(),
  };
}

module.exports = {
  isRemoteEnabled,
  runForecastPredict,
  fetchSeasonalInsights,
  runRetrainPipeline,
  fetchModelRegistry,
  resolvePythonExecutable,
  getRepoRoot,
};
