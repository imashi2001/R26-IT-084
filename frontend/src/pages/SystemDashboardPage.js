import { useEffect, useMemo, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import DashboardHero from "../components/dashboard/DashboardHero";
import DashboardKpiRow from "../components/dashboard/DashboardKpiRow";
import DashboardBinsTable from "../components/dashboard/DashboardBinsTable";
import DashboardBinDetail from "../components/dashboard/DashboardBinDetail";
import LiveBinMapCard from "../components/dashboard/cards/LiveBinMapCard";
import RecentAlertsCard from "../components/dashboard/cards/RecentAlertsCard";
import RiskTrend7dCard from "../components/dashboard/cards/RiskTrend7dCard";
import useSystemSnapshot from "../hooks/useSystemSnapshot";
import useCaptureHistory from "../hooks/useCaptureHistory";
import useDevicesOverview from "../hooks/useDevicesOverview";
import useAlertBadgeCount from "../hooks/useAlertBadgeCount";
import useDashboardSettings from "../hooks/useDashboardSettings";
import { binStatusMeta } from "../utils/dashboardBins";

export default function SystemDashboardPage() {
  const { data: snapshot, loading, error, stale, refresh } = useSystemSnapshot();
  const history = useCaptureHistory();
  const fleet = useDevicesOverview();
  const alertCount = useAlertBadgeCount();
  const { heroUrl } = useDashboardSettings();
  const [selectedBinId, setSelectedBinId] = useState(null);

  const animalsToday = useMemo(() => {
    const today = new Date();
    return (history.captures || []).filter((c) => {
      const t = new Date(c.captured_at);
      return (
        t.getFullYear() === today.getFullYear() &&
        t.getMonth() === today.getMonth() &&
        t.getDate() === today.getDate() &&
        (c.animal_count || 0) > 0
      );
    }).length;
  }, [history.captures]);

  const selectedDevice = useMemo(() => {
    if (selectedBinId == null) return null;
    return (fleet.devices || []).find((d) => d.id === selectedBinId) || null;
  }, [fleet.devices, selectedBinId]);

  useEffect(() => {
    if (selectedBinId != null) return;
    const urgent = (fleet.devices || []).find((d) => {
      const s = binStatusMeta(d);
      return s.tone === "danger" || s.tone === "warn";
    });
    const pick = urgent || fleet.devices?.[0];
    if (pick?.id != null) setSelectedBinId(pick.id);
  }, [fleet.devices, selectedBinId]);

  const banner = useMemo(() => {
    if (loading && !snapshot) return null;
    if (error) {
      return {
        tone: "error",
        text: `Backend error: ${error}. Will retry automatically.`,
      };
    }
    if (!snapshot && !fleet.devices?.length) {
      return {
        tone: "info",
        text: "No capture received yet. Send an image from the ESP32-CAM or POST /predict.",
      };
    }
    if (stale) {
      return {
        tone: "warn",
        text: "Latest snapshot is stale — waiting for a fresh field capture.",
      };
    }
    return null;
  }, [loading, error, snapshot, stale, fleet.devices]);

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
            onClick={() => {
              refresh();
              fleet.refresh();
              history.refresh();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      ) : null}

      <DashboardHero
        devices={fleet.devices}
        alertCount={alertCount}
        animalsToday={animalsToday}
        heroUrl={heroUrl}
      />

      <DashboardKpiRow
        devices={fleet.devices}
        history={history.captures}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DashboardBinsTable
            devices={fleet.devices}
            loading={fleet.loading}
            dbDisabled={fleet.dbDisabled}
            selectedId={selectedBinId}
            onSelect={setSelectedBinId}
          />
        </div>
        <div className="xl:col-span-2">
          <DashboardBinDetail
            device={selectedDevice}
            history={history.captures}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <LiveBinMapCard />
        </div>
        <div className="lg:col-span-4">
          <RecentAlertsCard
            history={history.captures}
            dbDisabled={history.dbDisabled}
          />
        </div>
        <div className="lg:col-span-3">
          <RiskTrend7dCard
            history={history.last7d}
            dbDisabled={history.dbDisabled}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
