/**
 * Backend API base URL + helpers for Vite dashboard pages.
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
  const fromEnv = ensureHttpsBase(import.meta.env.VITE_API_URL || "");

  if (import.meta.env.DEV) {
    return fromEnv || "";
  }

  return fromEnv || null;
}

export function getPredictUrl() {
  const base = getApiBaseUrl();
  if (base === null) return null;
  if (base === "") return "/predict";
  return `${base}/predict`;
}

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

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base === null) {
    throw new Error(
      "API URL missing. Set VITE_API_URL for production builds."
    );
  }
  if (base === "") return p;
  return `${base.replace(/\/+$/, "")}${p}`;
}

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

export async function fetchMetrics() {
  return null;
}

export async function fetchWeather(_binId) {
  return null;
}

export async function fetchRisk(_binId) {
  return null;
}

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

function adaptAnalyzeResponse(data) {
  const animal = data?.animal && !data.animal.error ? data.animal : null;

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
  if (opts.sourceType) form.append("source_type", String(opts.sourceType));

  const res = await axios.post(apiUrl("/predict"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const out = adaptAnalyzeResponse(res.data);
  const cap = res.headers["x-capture-id"] || res.headers["X-Capture-Id"];
  if (cap) out.capture_id = cap;
  return out;
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

/**
 * Litter severity (YOLO + LSI) via Express proxy → litter microservice.
 */
export async function analyzeLitterSeverity(file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await axios.post(apiUrl("/litter-severity"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Littering-event detection (YOLO11) via Express proxy → littering-action microservice.
 */
export async function analyzeLitteringAction(file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await axios.post(apiUrl("/littering-action"), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
