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
        text: "No capture received yet. Send an image from the ESP32-CAM or POST /predict.",
      };
    }
    if (stale) {
      return {
        tone: "warn",
        text: "Snapshot is stale — waiting for a fresh capture from the field device.",
      };
    }
    return null;
  }, [loading, error, snapshot, stale]);

  return (
    <DashboardLayout>
      {banner ? (
        <div
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-sm ${
            banner.tone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : banner.tone === "warn"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-slate-700/60 bg-slate-900/60 text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LatestCaptureCard snapshot={snapshot} stale={stale} />
        <BinFillLevelCard snapshot={snapshot} />
        <WasteClassificationCard snapshot={snapshot} />
        <AnimalDetectionCard snapshot={snapshot} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HygienicRiskLevelCard snapshot={snapshot} />
        <RottingPredictionCard snapshot={snapshot} />
        <EnvironmentalConditionsCard
          snapshot={snapshot}
          history={history.last24h}
          dbDisabled={history.dbDisabled}
        />
        <NextCollectionCard snapshot={snapshot} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
