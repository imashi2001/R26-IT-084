const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "dashboard");
const SETTINGS_PATH = path.join(UPLOAD_DIR, "audio_settings.json");

const BUILTIN_KEYS = [
  "illegal_dumping",
  "waste_full",
  "animal_detected",
  "correct_dumping",
];

const BUILTIN_LABELS = {
  illegal_dumping: "Illegal dumping",
  waste_full: "Waste full / overflow",
  animal_detected: "Animal detected",
  correct_dumping: "Correct dumping",
};

const DEFAULT_TRACKS = {
  illegal_dumping: 1,
  waste_full: 2,
  animal_detected: 3,
  correct_dumping: 4,
};

const AUTO_CONDITIONS = new Set([
  "manual_only",
  "risk_high",
  "risk_critical",
  "risk_medium",
]);

function ensureDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function normalizeTrack(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  if (t < 1 || t > 9999) return fallback;
  return t;
}

function defaultSettings() {
  return {
    tracks: { ...DEFAULT_TRACKS },
    custom_scenarios: [],
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

function normalizeCustomScenario(row, index) {
  const id =
    row?.id && String(row.id).trim()
      ? String(row.id).trim()
      : crypto.randomUUID();
  const label = String(row?.label || `Custom ${index + 1}`).trim().slice(0, 120);
  const track = normalizeTrack(row?.track, 5 + index);
  const auto_condition = AUTO_CONDITIONS.has(String(row?.auto_condition || ""))
    ? String(row.auto_condition)
    : "manual_only";
  return { id, label, track, auto_condition };
}

function normalizeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;

  const tracks = { ...base.tracks };
  if (raw.tracks && typeof raw.tracks === "object") {
    for (const key of BUILTIN_KEYS) {
      tracks[key] = normalizeTrack(raw.tracks[key], DEFAULT_TRACKS[key]);
    }
  }

  const custom_scenarios = Array.isArray(raw.custom_scenarios)
    ? raw.custom_scenarios
        .slice(0, 20)
        .map((row, i) => normalizeCustomScenario(row, i))
    : [];

  return {
    tracks,
    custom_scenarios,
    updated_at: raw.updated_at || null,
  };
}

function getSettings() {
  return normalizeSettings(readRaw());
}

function validateForSave(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const tracksIn = body.tracks;
  if (!tracksIn || typeof tracksIn !== "object") {
    return { ok: false, error: "tracks object is required." };
  }

  const tracks = {};
  for (const key of BUILTIN_KEYS) {
    if (tracksIn[key] === undefined || tracksIn[key] === "") {
      return { ok: false, error: `tracks.${key} is required.` };
    }
    const t = normalizeTrack(tracksIn[key], null);
    if (t == null) {
      return {
        ok: false,
        error: `tracks.${key} must be an integer from 1 to 9999.`,
      };
    }
    tracks[key] = t;
  }

  const customIn = Array.isArray(body.custom_scenarios)
    ? body.custom_scenarios
    : [];
  if (customIn.length > 20) {
    return { ok: false, error: "At most 20 custom scenarios allowed." };
  }

  const custom_scenarios = customIn.map((row, i) => {
    const label = String(row?.label || "").trim();
    if (!label) {
      const err = new Error(`custom_scenarios[${i}].label is required.`);
      err.status = 400;
      throw err;
    }
    const track = normalizeTrack(row?.track, null);
    if (track == null) {
      const err = new Error(
        `custom_scenarios[${i}].track must be an integer from 1 to 9999.`
      );
      err.status = 400;
      throw err;
    }
    const auto_condition = String(row?.auto_condition || "manual_only");
    if (!AUTO_CONDITIONS.has(auto_condition)) {
      const err = new Error(
        `custom_scenarios[${i}].auto_condition must be one of: ${[...AUTO_CONDITIONS].join(", ")}.`
      );
      err.status = 400;
      throw err;
    }
    return normalizeCustomScenario(
      {
        id: row?.id,
        label,
        track,
        auto_condition,
      },
      i
    );
  });

  return { ok: true, data: { tracks, custom_scenarios } };
}

function saveSettings(body) {
  let validated;
  try {
    validated = validateForSave(body);
  } catch (e) {
    if (e.status) throw e;
    return { ok: false, error: e.message };
  }
  if (!validated.ok) return validated;

  const updated_at = new Date().toISOString();
  const next = {
    tracks: validated.data.tracks,
    custom_scenarios: validated.data.custom_scenarios,
    updated_at,
  };
  ensureDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  return { ok: true, settings: next };
}

function trackForBuiltin(key, settings) {
  const s = settings || getSettings();
  const k = String(key || "").trim();
  if (!BUILTIN_KEYS.includes(k)) return null;
  return normalizeTrack(s.tracks?.[k], DEFAULT_TRACKS[k]);
}

function allTestTracks(settings) {
  const s = settings || getSettings();
  const rows = BUILTIN_KEYS.map((key) => ({
    key,
    label: BUILTIN_LABELS[key],
    track: trackForBuiltin(key, s),
    builtin: true,
  }));
  for (const c of s.custom_scenarios || []) {
    rows.push({
      key: c.id,
      label: c.label,
      track: c.track,
      builtin: false,
      auto_condition: c.auto_condition,
    });
  }
  return rows;
}

module.exports = {
  BUILTIN_KEYS,
  BUILTIN_LABELS,
  DEFAULT_TRACKS,
  AUTO_CONDITIONS,
  getSettings,
  saveSettings,
  validateForSave,
  trackForBuiltin,
  allTestTracks,
};
