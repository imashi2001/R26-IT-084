const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const audioPriorityService = require("../services/audioPriorityService");
const audioSettingsService = require("../services/audioSettingsService");

const baseSettings = audioSettingsService.getSettings();

describe("resolveAudioScenario by highest confidence", () => {
  it("picks littering when its confidence beats overflow", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      littering_action: {
        event_detected: true,
        max_confidence: 0.92,
      },
      bin_fill: {
        predictions: [{ label: "overflow", confidence: 0.75 }],
      },
      bin_fill_level: "Overflow",
      animal: { detection_count: 1, detections: [{ confidence: 0.6 }] },
    });
    assert.equal(out.scenario_key, "illegal_dumping");
    assert.equal(out.track, baseSettings.tracks.illegal_dumping);
    assert.ok(out.confidence >= 0.9);
  });

  it("picks overflow when fill confidence beats littering", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      littering_action: {
        event_detected: true,
        max_confidence: 0.55,
      },
      bin_fill: {
        predictions: [{ label: "overflow", confidence: 0.91 }],
      },
      bin_fill_level: "Overflow",
    });
    assert.equal(out.scenario_key, "waste_full");
    assert.ok(out.confidence >= 0.9);
  });

  it("picks animal when it has the highest confidence", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      bin_fill: {
        predictions: [{ label: "half", confidence: 0.4 }],
      },
      bin_fill_level: "Half",
      animal: {
        detections: [{ label: "dog", confidence: 0.88 }],
      },
    });
    assert.equal(out.scenario_key, "animal_detected");
  });

  it("clean capture maps to correct_dumping with empty fill confidence", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      risk: { level: "LOW" },
      bin_fill_level: "Empty",
      bin_fill: {
        predictions: [{ label: "empty", confidence: 0.87 }],
      },
      fill_percentage: 20,
      animal: { detection_count: 0 },
      littering_action: { event_detected: false },
    });
    assert.equal(out.scenario_key, "correct_dumping");
    assert.equal(out.track, baseSettings.tracks.correct_dumping);
    assert.ok(out.confidence >= 0.85);
  });

  it("picks half fill when it is the only active signal", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      risk: { level: "HIGH" },
      littering_action: { event_detected: true, max_confidence: 0.1 },
      animal: { detection_count: 0 },
      bin_fill_level: "Half",
      bin_fill: { predictions: [{ label: "half", confidence: 0.35 }] },
      fill_percentage: 40,
    });
    assert.equal(out.scenario_key, "waste_full");
    assert.equal(out.confidence, 0.35);
  });

  it("custom risk_high wins when its tier confidence beats half fill", () => {
    const settings = {
      ...baseSettings,
      custom_scenarios: [
        {
          id: "custom-high",
          label: "High risk reminder",
          track: 9,
          auto_condition: "risk_high",
        },
      ],
    };
    const out = audioPriorityService.resolveAudioScenario({
      settings,
      risk: { level: "HIGH" },
      animal: { detection_count: 0 },
      bin_fill_level: "Half",
      bin_fill: { predictions: [{ label: "half", confidence: 0.5 }] },
      littering_action: { event_detected: false },
    });
    assert.equal(out.scenario_key, "custom-high");
    assert.equal(out.track, 9);
    assert.ok(out.confidence > 0.5);
  });

  it("picks litter severity when LSI beats half fill", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      littering_action: { event_detected: false },
      litter: { lsi: 58, severity: "HIGH" },
      bin_fill_level: "Half",
      bin_fill: { predictions: [{ label: "half", confidence: 0.4 }] },
    });
    assert.equal(out.scenario_key, "waste_full");
    assert.equal(out.source, "litter");
    assert.ok(out.confidence >= 0.55);
  });

  it("returns candidates list for debugging", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      littering_action: { event_detected: true, max_confidence: 0.8 },
      bin_fill: { predictions: [{ label: "overflow", confidence: 0.7 }] },
      bin_fill_level: "Overflow",
    });
    assert.ok(Array.isArray(out.candidates));
    assert.ok(out.candidates.length >= 2);
  });
});

describe("audioSettingsService validation", () => {
  it("rejects invalid track numbers", () => {
    const result = audioSettingsService.validateForSave({
      tracks: {
        illegal_dumping: 0,
        waste_full: 2,
        animal_detected: 3,
        correct_dumping: 4,
      },
    });
    assert.equal(result.ok, false);
  });

  it("accepts valid payload", () => {
    const result = audioSettingsService.validateForSave({
      tracks: {
        illegal_dumping: 1,
        waste_full: 2,
        animal_detected: 3,
        correct_dumping: 4,
      },
      custom_scenarios: [
        {
          label: "Maintenance",
          track: 5,
          auto_condition: "manual_only",
        },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.custom_scenarios[0].track, 5);
  });
});
