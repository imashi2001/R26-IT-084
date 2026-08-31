const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const audioPriorityService = require("../services/audioPriorityService");
const audioSettingsService = require("../services/audioSettingsService");

const baseSettings = audioSettingsService.getSettings();

describe("resolveAudioScenario priority", () => {
  it("littering wins over overflow and animals", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      littering_action: {
        event_detected: true,
        max_confidence: 0.8,
      },
      bin_fill_level: "Overflow",
      fill_percentage: 90,
      animal: { detection_count: 2 },
    });
    assert.equal(out.scenario_key, "illegal_dumping");
    assert.equal(out.track, baseSettings.tracks.illegal_dumping);
  });

  it("overflow wins over animals when no littering", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      bin_fill_level: "Overflow",
      animal: { detection_count: 1 },
    });
    assert.equal(out.scenario_key, "waste_full");
  });

  it("animals only maps to animal_detected", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      animal: { detections: [{ label: "dog", confidence: 0.9 }] },
    });
    assert.equal(out.scenario_key, "animal_detected");
    assert.equal(out.track, baseSettings.tracks.animal_detected);
  });

  it("clean capture maps to correct_dumping", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      risk: { level: "LOW" },
      bin_fill_level: "Empty",
      fill_percentage: 20,
      animal: { detection_count: 0 },
      littering_action: { event_detected: false },
    });
    assert.equal(out.scenario_key, "correct_dumping");
    assert.equal(out.track, baseSettings.tracks.correct_dumping);
  });

  it("returns null when issues exist but littering below threshold", () => {
    const out = audioPriorityService.resolveAudioScenario({
      settings: baseSettings,
      risk: { level: "HIGH" },
      littering_action: { event_detected: true, max_confidence: 0.1 },
      animal: { detection_count: 0 },
      bin_fill_level: "Half",
      fill_percentage: 40,
    });
    assert.equal(out, null);
  });

  it("custom risk_high rule fires before correct_dumping", () => {
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
      littering_action: { event_detected: false },
    });
    assert.equal(out.scenario_key, "custom-high");
    assert.equal(out.track, 9);
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
