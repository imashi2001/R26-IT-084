import { describe, it, expect } from "vitest";
import {
  qualifiesForAddBinAlert,
  litterSeverityMeta,
  trailingHighLitterStreak,
  countHighLitterSites,
} from "./litterSeverity.js";
import { buildAlerts } from "../components/dashboard/cards/RecentAlertsCard.js";

describe("litterSeverity utils", () => {
  it("maps device litter severity to pill meta", () => {
    expect(litterSeverityMeta({ latest_litter_severity: "HIGH" }).tone).toBe(
      "danger"
    );
    expect(litterSeverityMeta({ latest_litter_severity: "LOW" }).tone).toBe(
      "ok"
    );
  });

  it("counts high litter sites", () => {
    expect(
      countHighLitterSites([
        { latest_litter_severity: "HIGH" },
        { latest_litter_severity: "LOW" },
      ])
    ).toBe(1);
  });

  it("qualifies add-bin after 3 HIGH captures", () => {
    const caps = [
      { litter_severity: "HIGH" },
      { litter_severity: "HIGH" },
      { litter_severity: "HIGH" },
    ];
    expect(trailingHighLitterStreak(caps)).toBe(3);
    expect(qualifiesForAddBinAlert(caps)).toBe(true);
  });
});

describe("buildAlerts litter module", () => {
  it("includes high litter severity row", () => {
    const alerts = buildAlerts([
      {
        device_id: 3,
        captured_at: new Date().toISOString(),
        litter_severity: "HIGH",
        litter_lsi: 57,
        litter_detection_count: 8,
      },
    ]);
    expect(alerts.some((a) => a.title === "High litter severity")).toBe(true);
  });

  it("includes add-bin row when streak holds", () => {
    const now = new Date().toISOString();
    const alerts = buildAlerts([
      { device_id: 2, captured_at: now, litter_severity: "HIGH" },
      { device_id: 2, captured_at: now, litter_severity: "HIGH" },
      { device_id: 2, captured_at: now, litter_severity: "HIGH" },
    ]);
    expect(
      alerts.some((a) => a.title === "Add a new bin at this location")
    ).toBe(true);
  });

  it("includes littering event row", () => {
    const alerts = buildAlerts([
      {
        device_id: 1,
        captured_at: new Date().toISOString(),
        littering_event_detected: true,
        littering_event_count: 1,
        littering_max_confidence: 0.8,
      },
    ]);
    expect(alerts.some((a) => a.title === "Littering event detected")).toBe(
      true
    );
  });
});
