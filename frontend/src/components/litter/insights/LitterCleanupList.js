import { ArrowRight } from "lucide-react";
import { formatLsi } from "../../../utils/litterSeverity";
import { formatDateTime, binStatusMeta } from "../../../utils/litterInsights";
import { listRowCompact } from "../../dashboard/dashboardTheme";

/**
 * Cleanup verification: bins whose LSI dropped from MEDIUM/HIGH back to LOW,
 * plus bins that are still elevated (cleanup pending).
 */
export default function LitterCleanupList({ cleanups, bins }) {
  const pending = (bins || []).filter((b) => b.status === "persistent");

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Still waiting for cleanup ({pending.length})
        </div>
        {pending.length ? (
          <ul className="space-y-1.5">
            {pending.slice(0, 6).map((b) => (
              <li key={b.device_id} className={listRowCompact}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-100">
                    {b.bin_code}
                    <span className="ml-1 font-normal text-slate-500">{b.name}</span>
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${binStatusMeta(b.status).pill}`}
                  >
                    LSI {formatLsi(b.latest_lsi)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Elevated since {formatDateTime(b.elevated_since)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No bins are stuck at MEDIUM/HIGH.</p>
        )}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Verified cleanups ({cleanups?.length || 0})
        </div>
        {cleanups?.length ? (
          <ul className="space-y-1.5">
            {cleanups.slice(0, 8).map((c) => (
              <li key={`${c.device_id}-${c.at}`} className={listRowCompact}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-100">{c.bin_code}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums text-xs">
                    <span className="text-red-300">{formatLsi(c.before_lsi)}</span>
                    <ArrowRight className="h-3 w-3 text-slate-500" />
                    <span className="text-brand-300">{formatLsi(c.after_lsi)}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatDateTime(c.at)} · was {c.before_severity} for{" "}
                  {c.hours_elevated != null ? `${c.hours_elevated}h` : "—"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">
            No MEDIUM/HIGH → LOW drops yet in this range.
          </p>
        )}
      </div>
    </div>
  );
}
