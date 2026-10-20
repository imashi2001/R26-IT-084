import {
  DOW_LABELS,
  formatHour,
  heatColor,
  heatScore,
  maxHeatScore,
} from "../../../utils/litterInsights";

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

/** 7 × 24 grid: when HIGH litter and confirmed littering happen (browser local time). */
export default function LitterHeatmap({ heatmap }) {
  const max = maxHeatScore(heatmap);

  if (!max) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-500">
        No HIGH litter or confirmed littering in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div
          className="ml-10 grid gap-[2px] text-[10px] text-slate-500"
          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center">
              {HOUR_TICKS.includes(h) ? formatHour(h) : ""}
            </div>
          ))}
        </div>
        <div className="mt-1 space-y-[2px]">
          {(heatmap || []).map((row, dow) => (
            <div key={DOW_LABELS[dow]} className="flex items-center gap-2">
              <div className="w-8 shrink-0 text-right text-[11px] text-slate-500">
                {DOW_LABELS[dow]}
              </div>
              <div
                className="grid flex-1 gap-[2px]"
                style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
              >
                {row.map((cell, hour) => {
                  const score = heatScore(cell);
                  return (
                    <div
                      key={hour}
                      className="h-5 rounded-[3px]"
                      style={{ backgroundColor: heatColor(score, max) }}
                      title={`${DOW_LABELS[dow]} ${formatHour(hour)} · ${cell.events} confirmed littering · ${cell.high} HIGH of ${cell.captures} readings${cell.avg_lsi != null ? ` · avg LSI ${cell.avg_lsi}` : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-500">
          <span>Less</span>
          {[0.15, 0.4, 0.7, 1].map((r) => (
            <span
              key={r}
              className="inline-block h-3 w-5 rounded-[3px]"
              style={{ backgroundColor: heatColor(r * max, max) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
