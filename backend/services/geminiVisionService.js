/**
 * Gemini Vision client for VisionWaste voice scenarios.
 * Returns the same four scenario keys used by DFPlayer tracks.
 */

const axios = require("axios");
const audioSettingsService = require("./audioSettingsService");
const geminiSettingsService = require("./geminiSettingsService");

const SCENARIO_KEYS = audioSettingsService.BUILTIN_KEYS;
const { BUILTIN_LABELS } = audioSettingsService;

const FILL_LEVELS = new Set(["empty", "half", "overflow"]);

const PROMPT = `You are analyzing a smart waste bin camera photo for VisionWaste.
Reply with ONLY a single JSON object (no markdown, no code fences) with these keys:
{
  "fill_level": "empty" | "half" | "overflow",
  "litter_on_ground": true | false,
  "animal_detected": true | false,
  "scenario": "illegal_dumping" | "waste_full" | "animal_detected" | "correct_dumping",
  "confidence": number between 0 and 1,
  "reason": "short plain-English reason under 120 characters"
}

Scenario rules (pick exactly one):
- illegal_dumping: litter/waste on the ground beside the bin, or person dumping beside the bin
- waste_full: bin is overflow / clearly full
- animal_detected: animal at or near the bin (and not better classified as illegal_dumping)
- correct_dumping: waste properly in bin / clean scene / empty or tidy bin

Prefer illegal_dumping over animal_detected when both apply. Prefer waste_full over correct_dumping when the bin is overflowing.`;

function parseJsonFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Normalize a Gemini JSON payload into a voice-scenario object.
 * Exported for unit tests.
 */
function normalizeGeminiResult(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: "Empty Gemini response",
      scenario_key: null,
      track: null,
      confidence: 0,
      fill_level: null,
      litter_on_ground: false,
      animal_detected: false,
      reason: null,
      label: null,
      source: "gemini",
    };
  }

  let fill_level = String(raw.fill_level || "")
    .trim()
    .toLowerCase();
  if (!FILL_LEVELS.has(fill_level)) fill_level = null;

  const litter_on_ground = Boolean(raw.litter_on_ground);
  const animal_detected = Boolean(raw.animal_detected);

  let scenario_key = String(raw.scenario || raw.scenario_key || "")
    .trim()
    .toLowerCase();
  if (!SCENARIO_KEYS.includes(scenario_key)) {
    // Derive from flags if model omitted scenario
    if (litter_on_ground) scenario_key = "illegal_dumping";
    else if (fill_level === "overflow") scenario_key = "waste_full";
    else if (animal_detected) scenario_key = "animal_detected";
    else if (fill_level === "empty" || fill_level === "half") {
      scenario_key = "correct_dumping";
    } else {
      return {
        ok: false,
        error: `Unknown scenario: ${raw.scenario || "(missing)"}`,
        scenario_key: null,
        track: null,
        confidence: clampConfidence(raw.confidence),
        fill_level,
        litter_on_ground,
        animal_detected,
        reason: String(raw.reason || "").slice(0, 200) || null,
        label: null,
        source: "gemini",
      };
    }
  }

  const confidence = clampConfidence(raw.confidence);
  const track = audioSettingsService.trackForBuiltin(scenario_key);
  const reason =
    String(raw.reason || "").trim().slice(0, 200) ||
    BUILTIN_LABELS[scenario_key] ||
    scenario_key;

  return {
    ok: true,
    error: null,
    scenario_key,
    track,
    confidence,
    fill_level,
    litter_on_ground,
    animal_detected,
    reason,
    label: BUILTIN_LABELS[scenario_key] || scenario_key,
    source: "gemini",
  };
}

/**
 * Pick the final voice scenario from YOLO + Gemini based on voice_source.
 * Exported for unit tests.
 *
 * @param {"models"|"gemini"|"both"} voiceSource
 * @param {object|null} yoloResolved — from audioPriorityService.resolveAudioScenario
 * @param {object|null} geminiResolved — from normalizeGeminiResult (ok:true)
 */
function pickFinalVoiceScenario(voiceSource, yoloResolved, geminiResolved) {
  const mode = String(voiceSource || "models").toLowerCase();
  const geminiOk =
    geminiResolved &&
    geminiResolved.ok !== false &&
    geminiResolved.scenario_key &&
    geminiResolved.track;

  if (mode === "gemini") {
    if (geminiOk) {
      return {
        ...geminiResolved,
        source: "gemini",
        winner: "gemini",
      };
    }
    return null;
  }

  if (mode === "both") {
    if (geminiOk) {
      return {
        ...geminiResolved,
        source: "both",
        winner: "gemini",
      };
    }
    if (yoloResolved?.scenario_key && yoloResolved?.track) {
      return {
        ...yoloResolved,
        source: "both",
        winner: "models",
      };
    }
    return null;
  }

  // models (default)
  if (yoloResolved?.scenario_key && yoloResolved?.track) {
    return {
      ...yoloResolved,
      source: "models",
      winner: "models",
    };
  }
  return null;
}

/**
 * Call Gemini Vision with a JPEG buffer.
 * @returns {Promise<object>} normalizeGeminiResult shape (+ raw_text, inference_ms)
 */
async function analyzeImage({
  imageBuffer,
  mimetype = "image/jpeg",
  apiKey,
  model,
  timeoutMs = 25000,
} = {}) {
  const started = Date.now();
  const settings = geminiSettingsService.getSettings();
  const key = String(apiKey || geminiSettingsService.resolveApiKey(settings) || "").trim();
  const modelName = String(
    model || settings.gemini_model || geminiSettingsService.DEFAULT_MODEL || "gemini-3.8-flash"
  )
    .trim()
    .replace(/^models\//i, "");

  if (!key) {
    return {
      ...normalizeGeminiResult(null),
      error: "Gemini API key not configured",
      inference_ms: Date.now() - started,
    };
  }

  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < 32) {
    return {
      ...normalizeGeminiResult(null),
      error: "Invalid image buffer for Gemini",
      inference_ms: Date.now() - started,
    };
  }

  const mime = (mimetype || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          {
            inlineData: {
              mimeType: mime,
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
  };

  try {
    const res = await axios.post(url, body, {
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      const msg =
        res.data?.error?.message ||
        res.data?.message ||
        `Gemini HTTP ${res.status}`;
      return {
        ...normalizeGeminiResult(null),
        error: String(msg).slice(0, 300),
        inference_ms: Date.now() - started,
      };
    }

    const parts = res.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("\n");
    const parsed = parseJsonFromText(text);
    if (!parsed) {
      return {
        ...normalizeGeminiResult(null),
        error: "Could not parse Gemini JSON",
        raw_text: String(text).slice(0, 500),
        inference_ms: Date.now() - started,
      };
    }

    const normalized = normalizeGeminiResult(parsed);
    return {
      ...normalized,
      raw_text: undefined,
      inference_ms: Date.now() - started,
    };
  } catch (e) {
    return {
      ...normalizeGeminiResult(null),
      error: (e.message || "Gemini request failed").slice(0, 300),
      inference_ms: Date.now() - started,
    };
  }
}

module.exports = {
  PROMPT,
  parseJsonFromText,
  normalizeGeminiResult,
  pickFinalVoiceScenario,
  analyzeImage,
  SCENARIO_KEYS,
};
