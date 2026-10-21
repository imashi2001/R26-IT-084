/**
 * Persist Gemini Vision + voice-source settings for the dashboard.
 * API key is stored locally but never returned in full to the UI.
 */

const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "dashboard");
const SETTINGS_PATH = path.join(UPLOAD_DIR, "gemini_settings.json");

const VOICE_SOURCES = new Set(["models", "gemini", "both"]);
/** gemini-2.0-flash was shut down (June 2026). Prefer current flash. */
const DEFAULT_MODEL = "gemini-3.8-flash";

const RETIRED_MODELS = new Map([
  ["gemini-2.0-flash", DEFAULT_MODEL],
  ["gemini-2.0-flash-001", DEFAULT_MODEL],
  ["gemini-2.0-flash-lite", "gemini-3.1-flash-lite"],
  ["gemini-2.0-flash-lite-001", "gemini-3.1-flash-lite"],
  ["gemini-2.0-flash-exp", DEFAULT_MODEL],
  ["gemini-2.5-flash", DEFAULT_MODEL],
  ["gemini-3.0-flash", DEFAULT_MODEL],
  ["models/gemini-2.0-flash", DEFAULT_MODEL],
]);

function ensureDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function defaultSettings() {
  return {
    voice_source: "models",
    gemini_model: DEFAULT_MODEL,
    api_key: "",
    last_prediction: null,
    updated_at: null,
  };
}

function readRaw() {
  ensureDir();
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return null;
  }
}

function normalizeVoiceSource(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  return VOICE_SOURCES.has(v) ? v : "models";
}

function normalizeModel(value) {
  let m = String(value || "")
    .trim()
    .replace(/^models\//i, "")
    .slice(0, 80);
  if (!m) return DEFAULT_MODEL;
  const lower = m.toLowerCase();
  if (RETIRED_MODELS.has(lower)) {
    return RETIRED_MODELS.get(lower);
  }
  if (RETIRED_MODELS.has(`models/${lower}`)) {
    return RETIRED_MODELS.get(`models/${lower}`);
  }
  return m;
}

function normalizeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  return {
    voice_source: normalizeVoiceSource(raw.voice_source),
    gemini_model: normalizeModel(raw.gemini_model),
    api_key: String(raw.api_key || "").trim(),
    last_prediction:
      raw.last_prediction && typeof raw.last_prediction === "object"
        ? raw.last_prediction
        : null,
    updated_at: raw.updated_at || null,
  };
}

function getSettings() {
  return normalizeSettings(readRaw());
}

function maskKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) {
    return { key_configured: false, key_last4: null };
  }
  return {
    key_configured: true,
    key_last4: key.length >= 4 ? key.slice(-4) : key,
  };
}

/**
 * Public view for GET — never includes the full API key.
 */
function toPublicSettings(settings) {
  const s = settings ? normalizeSettings(settings) : getSettings();
  const mask = maskKey(s.api_key);
  return {
    voice_source: s.voice_source,
    gemini_model: s.gemini_model,
    key_configured: mask.key_configured,
    key_last4: mask.key_last4,
    last_prediction: s.last_prediction,
    updated_at: s.updated_at,
    voice_source_options: [
      {
        value: "models",
        label: "Our models",
        description: "Voice from YOLO / existing model pipeline only.",
      },
      {
        value: "gemini",
        label: "Gemini",
        description: "Voice from Gemini Vision only.",
      },
      {
        value: "both",
        label: "Both (Gemini high priority)",
        description:
          "Run both; Gemini wins for voice when valid, else fall back to our models.",
      },
    ],
  };
}

function writeSettings(next) {
  ensureDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

/**
 * Resolve the API key: settings file first, then GEMINI_API_KEY env.
 */
function resolveApiKey(settings) {
  const s = settings || getSettings();
  const fromFile = String(s.api_key || "").trim();
  if (fromFile) return fromFile;
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function validateForSave(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const current = getSettings();
  let voice_source = current.voice_source;
  if (body.voice_source !== undefined && body.voice_source !== null) {
    const v = String(body.voice_source).trim().toLowerCase();
    if (!VOICE_SOURCES.has(v)) {
      return {
        ok: false,
        error: `voice_source must be one of: ${[...VOICE_SOURCES].join(", ")}.`,
      };
    }
    voice_source = v;
  }

  let gemini_model = current.gemini_model;
  if (body.gemini_model !== undefined && body.gemini_model !== null) {
    const m = String(body.gemini_model).trim();
    if (!m) {
      return { ok: false, error: "gemini_model cannot be empty." };
    }
    gemini_model = normalizeModel(m);
  }

  let api_key = current.api_key;
  // Empty string / omit / whitespace = keep existing key.
  // Only update when a non-empty new key is provided.
  if (
    body.api_key !== undefined &&
    body.api_key !== null &&
    String(body.api_key).trim() !== ""
  ) {
    api_key = String(body.api_key).trim().slice(0, 256);
  }

  // clear_api_key: true removes the stored key
  if (body.clear_api_key === true) {
    api_key = "";
  }

  return {
    ok: true,
    data: {
      voice_source,
      gemini_model,
      api_key,
      last_prediction: current.last_prediction,
    },
  };
}

function saveSettings(body) {
  const validated = validateForSave(body);
  if (!validated.ok) return validated;

  const updated_at = new Date().toISOString();
  const next = {
    ...validated.data,
    updated_at,
  };
  writeSettings(next);
  return { ok: true, settings: toPublicSettings(next) };
}

function saveLastPrediction(prediction) {
  const current = getSettings();
  const next = {
    ...current,
    last_prediction:
      prediction && typeof prediction === "object" ? prediction : null,
    updated_at: current.updated_at || new Date().toISOString(),
  };
  writeSettings(next);
  return next.last_prediction;
}

module.exports = {
  VOICE_SOURCES,
  DEFAULT_MODEL,
  getSettings,
  toPublicSettings,
  resolveApiKey,
  saveSettings,
  validateForSave,
  saveLastPrediction,
  maskKey,
};
