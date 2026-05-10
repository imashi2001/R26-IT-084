/**
 * Resolves the backend API base URL for axios calls.
 *
 * - Development: empty string -> use relative URLs like "/predict" so CRA's
 *   package.json "proxy" forwards to localhost:5000 (no CORS hassle).
 * - Production: REACT_APP_API_URL must be set to the backend origin only,
 *   e.g. https://your-backend.up.railway.app (no trailing slash).
 *
 * The named URL helpers (`getApiBaseUrl`, `apiUrl`, `getPredictUrl`,
 * `isApiUrlPointingAtFrontend`) match the test branch verbatim so a
 * future merge stays clean.
 *
 * The fetch helpers below talk to the new Express backend (server.js):
 *   POST /predict          - runs both model microservices + risk engine
 *   GET  /forecast[/:id]   - rule-based risk timeline
 *   GET  /devices          - bin list (requires DB)
 *   GET  /captures         - capture history (requires DB)
 *   GET  /health           - service ping (used to read model accuracies)
 *
 * Each helper reshapes the Express response to the shape App.js already
 * consumes, so the dashboard logic stays untouched.
 */

import axios from "axios";

function ensureHttpsBase(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const hostPart = trimmed.split("/")[0];
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(hostPart)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function getApiBaseUrl() {
  const fromEnv = ensureHttpsBase(process.env.REACT_APP_API_URL || "");

  if (process.env.NODE_ENV === "development") {
    return fromEnv || "";
  }

  return fromEnv || null;
}

/** Full URL for POST /predict */
export function getPredictUrl() {
  const base = getApiBaseUrl();
  if (base === null) return null;
  if (base === "") return "/predict";
  return `${base}/predict`;
}

/** True if base URL looks like "same host as this SPA" (classic mis-config -> 405). */
export function isApiUrlPointingAtFrontend(baseUrl) {
  if (typeof window === "undefined" || !baseUrl) return false;
  try {
    const u = new URL(baseUrl);
    return (
      u.origin === window.location.origin ||
      `${u.protocol}//${u.host}` === window.location.origin
    );
  } catch {
    return false;
  }
}

/** Build absolute or proxied URL for any API path (leading slash optional). */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base === null) {
    throw new Error(
      "API URL missing. Set REACT_APP_API_URL for production builds."
    );
  }
  if (base === "") return p;
  return `${base.replace(/\/+$/, "")}${p}`;
}

/* ============================================================
 * Dashboard fetch helpers - wired to the new Express backend.
 * Each helper preserves the response shape App.js already uses.
 * ============================================================ */

/** Bin list. Express returns {devices: [...]} when DATABASE_URL is set; 503 otherwise. */
export async function fetchBins() {
  try {
    const { data } = await axios.get(apiUrl("/devices"));
    const bins = (data?.devices || []).map((d) => ({
      id: d.id,
      name: d.name,
      esp32_id: d.esp32_id,
      lat: d.latitude,
      lng: d.longitude,
    }));
    return { bins };
  } catch (e) {
    if (e?.response?.status === 503) return { bins: [] };
    throw e;
  }
}

/**
 * Model accuracy stats. The new Express backend has no /metrics endpoint,
 * so this returns null and the "Model info" accordion in App.js stays hidden.
 * (Kept for back-compat so App.js doesn't need editing.)
 */
export async function fetchMetrics() {
  return null;
}

/** Per-bin current weather. Stand-alone /weather endpoint isn't on Express;
 *  the weather snapshot is included in /predict and /forecast responses. */
export async function fetchWeather(_binId) {
  return null;
}

/** Per-bin risk. Like weather, risk now ships inside /predict; no standalone route. */
export async function fetchRisk(_binId) {
  return null;
}

/** Capture history. Express returns {captures: [...]} when DB is enabled; 503 otherwise. */
export async function fetchAnalyzeHistory() {
  try {
    const { data } = await axios.get(apiUrl("/captures"));
    const history = (data?.captures || []).map((c) => ({
      ts: c.captured_at,
      level: c.risk_level,
      case: c.risk_case,
      waste_label: c.waste_label,
      animal_count: c.animal_count,
      temp_c: c.temp_c,
      humidity_pct: c.humidity_pct,
      bin_id: c.device_id,
    }));
    return { history };
  } catch (e) {
    if (e?.response?.status === 503) return { history: [] };
    throw e;
  }
}

/** 24h risk forecast. Express returns a flat shape; we wrap it back into
 *  {hours_ahead, forecast: {slots, summary}} so App.js's existing render code
 *  (`forecast.forecast.slots.map(...)`) keeps working. */
export async function fetchForecast(binId, hours = 24) {
  const path = binId
    ? `/forecast/${encodeURIComponent(binId)}?hours=${hours}`
    : `/forecast?hours=${hours}`;
  try {
    const { data } = await axios.get(apiUrl(path));
    return {
      hours_ahead: data?.hours ?? hours,
      forecast: {
        slots: data?.slots || [],
        summary: data?.summary || {},
        assumptions: data?.assumptions || [],
      },
      observation_source: data?.observation_source || null,
    };
  } catch (e) {
    if (e?.response?.status === 503) {
      return {
        hours_ahead: hours,
        forecast: { slots: [], summary: {}, assumptions: [] },
      };
    }
    throw e;
  }
}

/* ----------------------------------------------------------------
 * Single-image analysis (the main dashboard action).
 *
 * The Express POST /predict contract:
 *   - multipart field "image"          (the file)
 *   - field "device_id" (optional)     bin id
 *   - field "esp32_id" (optional)
 *   - field "bridge_instance_id" (optional)
 *   - field "lat" / "lon" (optional)   override weather location
 *   - field "model" (optional)         "waste" | "animal" | omit for both
 *
 * Response keys:
 *   { timestamp, model, waste, animal, weather, risk, bin, bridge_instance_id }
 *
 * App.js was written against the old FastAPI shape that used `animals`
 * (plural) and `result.server_time`/`device_id`. We adapt here so the
 * dashboard renders untouched.
 * ---------------------------------------------------------------- */

function adaptAnalyzeResponse(data) {
  const animal = data?.animal && !data.animal.error ? data.animal : null;

  // The old FastAPI also surfaced these fields on the animal block.
  // Express puts no_animal_attacks on the risk block; mirror it onto
  // animal so App.js's `animals?.no_animal_attacks` check still works.
  const animals = animal
    ? {
        ...animal,
        no_animal_attacks:
          data?.risk?.no_animal_attacks ?? animal.detection_count === 0,
      }
    : null;

  return {
    ...data,
    animals,
    server_time: data?.timestamp || null,
    device_id: data?.bin?.id || null,
    esp32_id: data?.bin?.esp32_id || null,
  };
}

export async function analyzeCapture(file, opts = {}) {
  const form = new FormData();
  form.append("image", file);
  if (opts.binId) form.append("device_id", String(opts.binId));
  if (opts.lat != null) form.append("lat", String(opts.lat));
  if (opts.lon != null) form.append("lon", String(opts.lon));
  if (opts.deviceId) form.append("device_id", String(opts.deviceId));
  if (opts.bridgeInstanceId)
    form.append("bridge_instance_id", String(opts.bridgeInstanceId));
  if (opts.esp32Id) form.append("esp32_id", String(opts.esp32Id));

  const { data } = await axios.post(apiUrl("/predict"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return adaptAnalyzeResponse(data);
}

export async function predictWaste(file, binId) {
  const form = new FormData();
  form.append("image", file);
  form.append("model", "waste");
  if (binId) form.append("device_id", String(binId));

  const { data } = await axios.post(apiUrl("/predict"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return adaptAnalyzeResponse(data);
}

export async function predictAnimal(file, binId) {
  const form = new FormData();
  form.append("image", file);
  form.append("model", "animal");
  if (binId) form.append("device_id", String(binId));

  const { data } = await axios.post(apiUrl("/predict"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return adaptAnalyzeResponse(data);
}
