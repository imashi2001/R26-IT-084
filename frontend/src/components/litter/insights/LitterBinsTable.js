import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { riskBadgeClass } from "../../dashboard/dashboardUi";
import { formatLsi } from "../../../utils/litterSeverity";
import {
  binStatusMeta,
  trendMeta,
  formatDateTime,
} from "../../../utils/litterInsights";

/** Per-bin litter ranking: worst status first, then highest average LSI. */
export default function LitterBinsTable({ bins, onEditOutline }) {
  if (!bins?.length) {
    return (
      <div className="py-8 text-center text-xs text-slate-500">
        No bins have litter readings in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/60">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">Bin</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Latest</th>
            <th className="px-3 py-2">Avg / max LSI</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2">HIGH</th>
            <th className="px-3 py-2">Littering</th>
            <th className="px-3 py-2">Cleanups</th>
            <th className="px-3 py-2">Bin outline</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => {
            const status = binStatusMeta(b.status);
            const trend = trendMeta(b.trend);
            return (
              <tr key={b.device_id} className="border-t border-slate-800/40 align-top">
                <td className="px-3 py-2">
                  <Link
                    to={`/bins/${b.device_id}`}
                    className="font-semibold text-slate-100 hover:text-brand-400"
                  >
                    {b.bin_code}
                  </Link>
                  <div className="max-w-[14rem] truncate text-[11px] text-slate-500">
                    {b.name}
                    {b.location ? ` · ${b.location}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.pill}`}
                    title={status.hint}
                  >
                    {status.label}
                  </span>
                  {b.elevated_since && b.status !== "recovered" ? (
                    <div className="mt-1 text-[10px] text-slate-500">
                      since {formatDateTime(b.elevated_since)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {b.latest_severity ? (
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskBadgeClass(b.latest_severity)}`}
                    >
                      {b.latest_severity} · {formatLsi(b.latest_lsi)}
                    </span>
                  ) : (
                    "—"
                  )}
                  <div className="mt-1 text-[10px] text-slate-500">
                    {formatDateTime(b.latest_at)}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-200">
                  {formatLsi(b.avg_lsi)} / {formatLsi(b.max_lsi)}
                  <div className="text-[10px] text-slate-500">{b.captures} readings</div>
                </td>
                <td className={`px-3 py-2 tabular-nums ${trend.className}`}>
                  {trend.arrow} {trend.label}
                  {b.trend_per_day != null ? (
                    <div className="text-[10px] text-slate-500">
                      {b.trend_per_day > 0 ? "+" : ""}
                      {b.trend_per_day} LSI/day
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-200">{b.high}</td>
                <td className="px-3 py-2 tabular-nums text-slate-200">
                  {b.littering_confirmed}
                  <div className="text-[10px] text-slate-500">
                    {b.littering_frames} frames
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-200">{b.cleanups}</td>
                <td className="px-3 py-2">
                  {b.has_outline ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Set
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Not set</span>
                  )}
                  {onEditOutline ? (
                    <button
                      type="button"
                      onClick={() => onEditOutline(b.device_id)}
                      className="mt-1 block text-[11px] font-semibold text-brand-400 hover:underline"
                    >
                      {b.has_outline ? "Edit" : "Draw outline"}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
