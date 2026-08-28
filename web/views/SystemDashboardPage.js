"use client";
import { useMemo } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import LatestCaptureCard from "../components/dashboard/cards/LatestCaptureCard";
import BinFillLevelCard from "../components/dashboard/cards/BinFillLevelCard";
import WasteClassificationCard from "../components/dashboard/cards/WasteClassificationCard";
import AnimalDetectionCard from "../components/dashboard/cards/AnimalDetectionCard";
import HygienicRiskLevelCard from "../components/dashboard/cards/HygienicRiskLevelCard";
import RottingPredictionCard from "../components/dashboard/cards/RottingPredictionCard";
import EnvironmentalConditionsCard from "../components/dashboard/cards/EnvironmentalConditionsCard";
import NextCollectionCard from "../components/dashboard/cards/NextCollectionCard";
import LiveBinMapCard from "../components/dashboard/cards/LiveBinMapCard";
import RecentAlertsCard from "../components/dashboard/cards/RecentAlertsCard";
import RiskTrend7dCard from "../components/dashboard/cards/RiskTrend7dCard";
import useSystemSnapshot from "../hooks/useSystemSnapshot";
import useCaptureHistory from "../hooks/useCaptureHistory";

/*
 * System dashboard layout (currently mounted at /system; promoted to / in PR 6).
 *
 * All 11 cards wired. PR 6 will swap routes so this page lives at `/` and the
 * old upload UI moves to `/live-monitoring`, plus add stub pages for the
 * sidebar items that currently 404.
 */
export default function SystemDashboardPage() {
  const { data: snapshot, loading, error, stale, refresh } = useSystemSnapshot();
  const history = useCaptureHistory();

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

      {/* Row 2 - Risk + environment */}
      <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <HygienicRiskLevelCard snapshot={snapshot} />
        <RottingPredictionCard snapshot={snapshot} />
        <EnvironmentalConditionsCard
          snapshot={snapshot}
          history={history.last24h}
          dbDisabled={history.dbDisabled}
        />
        <NextCollectionCard snapshot={snapshot} />
      </div>

      {/* Row 3 - Fleet view (map spans 2 cols on lg+) */}
      <div className="mt-4 grid gap-4 grid-cols-1 lg:grid-cols-3 xl:grid-cols-4">
        <div className="lg:col-span-2 xl:col-span-2">
          <LiveBinMapCard />
        </div>
        <RecentAlertsCard
          history={history.captures}
          dbDisabled={history.dbDisabled}
        />
        <RiskTrend7dCard
          history={history.last7d}
          dbDisabled={history.dbDisabled}
        />
      </div>
    </DashboardLayout>
  );
}
