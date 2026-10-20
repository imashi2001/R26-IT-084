/**
 * Dashboard popup switches for the litter severity + littering action models.
 * Stored separately from audio settings so other components are unaffected.
 */

const fs = require("fs");
const path = require("path");

const { confirmationOptions } = require("./litteringConfirmation");
const { ADD_BIN_STREAK } = require("./litterSeverityUtils");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "dashboard");
const SETTINGS_PATH = path.join(UPLOAD_DIR, "litter_alert_settings.json");

const DEFAULTS = Object.freeze({
  /** Popup for illegal dumping (littering action model). */
  popup_illegal_dumping: true,
  /** Only pop up once littering is confirmed across frames (fewer false alarms). */
  popup_confirmed_only: true,
  /** Popup when a bin has HIGH litter on ADD_BIN_STREAK captures in a row. */
  popup_add_bin: true,
  /** Popup on every HIGH litter severity capture (can be noisy). */
  popup_high_severity: false,
  /** Play the dashboard alert tone for litter popups. */
  popup_sound: true,
});

const KEYS = Object.keys(DEFAULTS);

function readRaw() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return null;
  }
}

function getSettings() {
  const raw = readRaw() || {};
  const out = {};
  for (const key of KEYS) {
    out[key] = typeof raw[key] === "boolean" ? raw[key] : DEFAULTS[key];
  }
  out.updated_at = raw.updated_at || null;
  return out;
}

/** Settings plus the confirmation rules the browser needs to apply them. */
function getPublicSettings() {
  const opts = confirmationOptions();
  return {
    ...getSettings(),
    confirmation: {
      min_confidence: opts.minConfidence,
      min_frames: opts.minFrames,
      window_seconds: Math.round(opts.windowMs / 1000),
      strong_confidence: opts.strongConfidence,
    },
    add_bin_streak: ADD_BIN_STREAK,
  };
}

function saveSettings(body) {
  if (!body || typeof body !== "object") {
    const err = new Error("Request body must be a JSON object.");
    err.status = 400;
    throw err;
  }
  const next = getSettings();
  let changed = 0;
  for (const key of KEYS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") {
      const err = new Error(`${key} must be true or false.`);
      err.status = 400;
      throw err;
    }
    next[key] = body[key];
    changed += 1;
  }
  if (!changed) {
    const err = new Error(`Provide at least one of: ${KEYS.join(", ")}.`);
    err.status = 400;
    throw err;
  }
  next.updated_at = new Date().toISOString();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  return getPublicSettings();
}

module.exports = {
  DEFAULTS,
  getSettings,
  getPublicSettings,
  saveSettings,
};
