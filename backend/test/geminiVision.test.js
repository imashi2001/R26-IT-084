const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  parseJsonFromText,
  normalizeGeminiResult,
  pickFinalVoiceScenario,
} = require("../services/geminiVisionService");

describe("parseJsonFromText", () => {
  it("parses plain JSON", () => {
    const out = parseJsonFromText(
      '{"scenario":"illegal_dumping","confidence":0.9}'
    );
    assert.equal(out.scenario, "illegal_dumping");
  });

  it("extracts JSON from surrounding text", () => {
    const out = parseJsonFromText(
      'Here is the result:\n{"scenario":"waste_full","fill_level":"overflow","confidence":0.8}\nThanks'
    );
    assert.equal(out.scenario, "waste_full");
    assert.equal(out.fill_level, "overflow");
  });
});

describe("normalizeGeminiResult", () => {
  it("maps a valid illegal_dumping payload", () => {
    const out = normalizeGeminiResult({
      fill_level: "empty",
      litter_on_ground: true,
      animal_detected: false,
      scenario: "illegal_dumping",
      confidence: 0.91,
      reason: "Waste on pavement beside bin",
    });
    assert.equal(out.ok, true);
    assert.equal(out.scenario_key, "illegal_dumping");
    assert.equal(out.track, 1);
    assert.ok(out.confidence >= 0.9);
    assert.equal(out.source, "gemini");
  });

  it("derives waste_full from overflow when scenario missing", () => {
    const out = normalizeGeminiResult({
      fill_level: "overflow",
      litter_on_ground: false,
      animal_detected: false,
      confidence: 0.77,
    });
    assert.equal(out.ok, true);
    assert.equal(out.scenario_key, "waste_full");
    assert.equal(out.track, 2);
  });

  it("rejects empty input", () => {
    const out = normalizeGeminiResult(null);
    assert.equal(out.ok, false);
    assert.equal(out.scenario_key, null);
  });
});

describe("pickFinalVoiceScenario", () => {
  const yolo = {
    scenario_key: "animal_detected",
    track: 3,
    confidence: 0.7,
    label: "Animal detected",
    reason: "cat",
  };
  const gemini = {
    ok: true,
    scenario_key: "illegal_dumping",
    track: 1,
    confidence: 0.88,
    label: "Illegal dumping",
    reason: "litter on ground",
  };

  it("models mode uses YOLO only", () => {
    const out = pickFinalVoiceScenario("models", yolo, gemini);
    assert.equal(out.winner, "models");
    assert.equal(out.scenario_key, "animal_detected");
    assert.equal(out.track, 3);
  });

  it("gemini mode uses Gemini when valid", () => {
    const out = pickFinalVoiceScenario("gemini", yolo, gemini);
    assert.equal(out.winner, "gemini");
    assert.equal(out.scenario_key, "illegal_dumping");
  });

  it("gemini mode returns null when Gemini failed", () => {
    const out = pickFinalVoiceScenario("gemini", yolo, {
      ok: false,
      error: "no key",
      scenario_key: null,
      track: null,
    });
    assert.equal(out, null);
  });

  it("both mode prefers Gemini when valid", () => {
    const out = pickFinalVoiceScenario("both", yolo, gemini);
    assert.equal(out.winner, "gemini");
    assert.equal(out.scenario_key, "illegal_dumping");
    assert.equal(out.source, "both");
  });

  it("both mode falls back to YOLO when Gemini fails", () => {
    const out = pickFinalVoiceScenario("both", yolo, {
      ok: false,
      error: "timeout",
      scenario_key: null,
      track: null,
    });
    assert.equal(out.winner, "models");
    assert.equal(out.scenario_key, "animal_detected");
    assert.equal(out.source, "both");
  });
});

describe("geminiSettingsService public mask", () => {
  it("masks key and never returns full api_key", () => {
    const geminiSettingsService = require("../services/geminiSettingsService");
    const publicView = geminiSettingsService.toPublicSettings({
      voice_source: "both",
      gemini_model: "gemini-2.0-flash",
      api_key: "AIzaSySecretKey1234",
      last_prediction: null,
      updated_at: null,
    });
    assert.equal(publicView.key_configured, true);
    assert.equal(publicView.key_last4, "1234");
    assert.equal(publicView.api_key, undefined);
    assert.equal(publicView.voice_source, "both");
  });
});
