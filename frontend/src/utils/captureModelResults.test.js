import { describe, expect, it } from "vitest";
import {
  buildCaptureModelResults,
  modelResultRows,
  partitionCapturePredictions,
} from "./captureModelResults";

describe("buildCaptureModelResults", () => {
  it("maps all five model fields from a full capture", () => {
    const out = buildCaptureModelResults({
      model_name: "waste+animal+bin_fill+litter+littering_action",
      fill_level: "Half",
      predictions: [
        { label: "half", confidence: 0.82, box: [0, 0, 1, 1] },
        { label: "dog", confidence: 0.71, box: [0, 0, 1, 1] },
        { label: "litter", confidence: 0.6, box: [0, 0, 1, 1] },
      ],
      extras: {
        waste_label: "organic",
        waste_confidence: 0.91,
        animal_count: 1,
        fill_percentage: 52,
        litter_severity: "MEDIUM",
        litter_lsi: 44.2,
        litter_detection_count: 3,
        littering_event_detected: true,
        littering_event_count: 1,
        littering_max_confidence: 0.88,
        risk_level: "MEDIUM",
        risk_case: "B2",
      },
    });

    expect(modelResultRows(out)).toHaveLength(5);
    expect(out.waste.primary).toBe("organic");
    expect(out.fill.primary).toBe("Half");
    expect(out.animal.primary).toBe("1 detected");
    expect(out.litterSeverity.primary).toBe("MEDIUM");
    expect(out.litteringAction.primary).toBe("Event detected");
    expect(out.risk.level).toBe("MEDIUM");
  });

  it("partitions fill, animal, and litter boxes", () => {
    const parts = partitionCapturePredictions([
      { label: "overflow", confidence: 0.9 },
      { label: "cat", confidence: 0.5 },
      { label: "litter", confidence: 0.4 },
      { label: "littering", confidence: 0.7 },
    ]);
    expect(parts.binFill).toHaveLength(1);
    expect(parts.animals).toHaveLength(1);
    expect(parts.litterBoxes).toHaveLength(1);
  });
});
