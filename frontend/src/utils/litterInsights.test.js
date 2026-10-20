import { describe, it, expect } from "vitest";
import {
  lsiColor,
  hotspotRadius,
  heatScore,
  heatColor,
  maxHeatScore,
  describePeak,
  formatHour,
  polygonToSvgPoints,
  clickToFraction,
  binStatusMeta,
} from "./litterInsights.js";

describe("litterInsights helpers", () => {
  it("colours LSI by severity band", () => {
    expect(lsiColor(10)).toBe("#22c55e");
    expect(lsiColor(40)).toBe("#f59e0b");
    expect(lsiColor(60)).toBe("#ef4444");
    expect(lsiColor(null)).toBe("#64748b");
  });

  it("sizes hotspots by LSI and confirmed littering", () => {
    expect(hotspotRadius({ avg_lsi: 0, littering_confirmed: 0 })).toBe(8);
    expect(hotspotRadius({ avg_lsi: 50, littering_confirmed: 2 })).toBe(22);
    expect(hotspotRadius({ avg_lsi: 100, littering_confirmed: 20 })).toBe(28);
  });

  it("scores heatmap cells", () => {
    expect(heatScore({ events: 2, high: 1 })).toBe(5);
    expect(maxHeatScore([[{ events: 1, high: 0 }], [{ events: 0, high: 4 }]])).toBe(4);
    expect(heatColor(0, 5)).toContain("30, 41, 59");
    expect(heatColor(5, 5)).toBe("rgba(239, 68, 68, 0.90)");
  });

  it("describes the peak slot", () => {
    expect(formatHour(0)).toBe("12am");
    expect(formatHour(13)).toBe("1pm");
    expect(describePeak({ dow: 5, hour: 18 })).toBe("Fri 6pm–7pm");
    expect(describePeak(null)).toBe(null);
  });

  it("converts outline points for SVG and clicks", () => {
    expect(polygonToSvgPoints([[0.1, 0.2], [0.5, 0.5]])).toBe("100,200 500,500");
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(clickToFraction(110, 70, rect)).toEqual([0.5, 0.5]);
    expect(clickToFraction(500, 0, rect)).toEqual([1, 0]);
    expect(clickToFraction(0, 0, { width: 0, height: 0 })).toBe(null);
  });

  it("falls back for unknown bin status", () => {
    expect(binStatusMeta("persistent").label).toBe("Needs action");
    expect(binStatusMeta("nope").label).toBe("No data");
  });
});
