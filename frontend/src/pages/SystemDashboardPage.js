import { useMemo } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import LatestCaptureCard from "../components/dashboard/cards/LatestCaptureCard";
import BinFillLevelCard from "../components/dashboard/cards/BinFillLevelCard";
import WasteClassificationCard from "../components/dashboard/cards/WasteClassificationCard";
import AnimalDetectionCard from "../components/dashboard/cards/AnimalDetectionCard";
import useSystemSnapshot from "../hooks/useSystemSnapshot";

/*
 * System dashboard layout (currently mounted at /system; promoted to / in PR 6).
 *
 * Row 1 is built. Rows 2-3 land in PR 4-5; left as a placeholder strip so the
 * page renders at full height with a clear roadmap.
 */
export default function SystemDashboardPage() {
  const { data: snapshot, loading, error, stale, refresh } = useSystemSnapshot();

  const banner = useMemo(() => {
    if (loading) return null;
    if (error) {
      return {
        tone: "error",
        text: `Backend error: ${error}. Will retry automatically.`,
      };
    }
    if (!snapshot) {
      return {
        tone: "info",
        text: "No capture received yet. Send an image through the bridge or POST /predict.",
      };
    }
    if (stale) {
      return {
        tone: "warn",
        text: "Snapshot is stale - the last refresh did not return a new capture.",
      };
    }
    return null;
  }, [loading, error, snapshot, stale]);

  return (
    <DashboardLayout>
      {banner ? (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm ${
            banner.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : banner.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-50 text-ink-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      ) : null}

      {/* Row 1 - Latest capture summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <LatestCaptureCard snapshot={snapshot} stale={stale} />
        <BinFillLevelCard snapshot={snapshot} />
        <WasteClassificationCard snapshot={snapshot} />
        <AnimalDetectionCard snapshot={snapshot} />
      </div>

      {/* Row 2 + 3 placeholders */}
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-ink-500">
        Row 2 (Risk Level · Rotting · Environmental · Next Collection) lands in
        PR 4. Row 3 (Live Bin Map · Recent Alerts · Risk Trend) lands in PR 5.
      </div>
    </DashboardLayout>
  );
}
