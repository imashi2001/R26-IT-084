import { describe, it, expect } from "vitest";
import { summarizeLitteringAction } from "../utils/litteringAction";

describe("summarizeLitteringAction", () => {
  it("handles successful detection", () => {
    const out = summarizeLitteringAction({
      event_detected: true,
      event_count: 1,
      max_confidence: 0.87,
      detections: [{ class_name: "littering", confidence: 0.87 }],
    });
    expect(out.ok).toBe(true);
    expect(out.eventDetected).toBe(true);
    expect(out.maxConfidence).toBe(0.87);
  });

  it("handles no-event result", () => {
    const out = summarizeLitteringAction({
      event_detected: false,
      event_count: 0,
      max_confidence: 0,
      detections: [],
    });
    expect(out.eventDetected).toBe(false);
  });

  it("handles API error", () => {
    const out = summarizeLitteringAction({ error: "Service down" });
    expect(out.ok).toBe(false);
  });
});
