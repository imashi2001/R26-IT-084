import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, AlertCircle } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import DashboardSection from "../components/dashboard/DashboardSection";
import DashboardHero from "../components/dashboard/DashboardHero";
import DashboardKpiRow from "../components/dashboard/DashboardKpiRow";
import DashboardBinsTable from "../components/dashboard/DashboardBinsTable";
import DashboardBinDetail from "../components/dashboard/DashboardBinDetail";
import LiveBinMapCard from "../components/dashboard/cards/LiveBinMapCard";
import RecentAlertsCard from "../components/dashboard/cards/RecentAlertsCard";
import RiskTrend7dCard from "../components/dashboard/cards/RiskTrend7dCard";
import WasteClassificationCard from "../components/dashboard/cards/WasteClassificationCard";
import RottingPredictionCard from "../components/dashboard/cards/RottingPredictionCard";
import AnimalDetectionCard from "../components/dashboard/cards/AnimalDetectionCard";
import HygienicRiskLevelCard from "../components/dashboard/cards/HygienicRiskLevelCard";
import { LAYOUT } from "../components/dashboard/dashboardTheme";
import useSystemSnapshot from "../hooks/useSystemSnapshot";
import useCaptureHistory from "../hooks/useCaptureHistory";
import useDevicesOverview from "../hooks/useDevicesOverview";
import useAlertBadgeCount from "../hooks/useAlertBadgeCount";
import useDashboardSettings from "../hooks/useDashboardSettings";
import { binStatusMeta, formatBinCode } from "../utils/dashboardBins";
import {
  ADD_BIN_STREAK,
  formatLsi,
  isHighSeverity,
} from "../utils/litterSeverity";

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

  const litterBanner = useMemo(() => {
    const devices = fleet.devices || [];
    const addBinSite = devices.find(
      (d) =>
        Boolean(d.litter_add_bin_recommended) ||
        (Number(d.litter_high_streak) || 0) >= ADD_BIN_STREAK
    );
    if (addBinSite) {
      const loc =
        addBinSite.location || addBinSite.address || addBinSite.name || "Site";
      return {
        tone: "error",
        text: `${loc} · ${formatBinCode(addBinSite.id)} — HIGH litter around the bin continues. Add a new bin at this location.`,
        link: "/bins",
        linkLabel: "Add Bin",
      };
    }
    const highSite = devices.find((d) =>
      isHighSeverity(d.latest_litter_severity)
    );
    if (highSite) {
      const loc = highSite.location || highSite.address || highSite.name || "Site";
      return {
        tone: "error",
        text: `${loc} · ${formatBinCode(highSite.id)} — High litter severity (LSI ${formatLsi(highSite.latest_litter_lsi)}). Review outside-bin litter.`,
        link: "/litter-severity",
        linkLabel: "View LSI",
      };
    }
    return null;
  }, [fleet.devices]);

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
    if (litterBanner) return litterBanner;
    return null;
  }, [loading, error, snapshot, stale, fleet.devices, litterBanner]);

  const onRefreshAll = () => {
    refresh();
    fleet.refresh();
    history.refresh();
  };

  return (
    <DashboardLayout>
      <div className={LAYOUT.page}>
        {banner ? (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-sm ${
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
            <div className="flex shrink-0 items-center gap-2">
              {banner.link ? (
                <Link
                  to={banner.link}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-500"
                >
                  {banner.linkLabel || "View"}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onRefreshAll}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-600/50 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
          </div>
        ) : null}

        <DashboardHero
          devices={fleet.devices}
          alertCount={alertCount}
          animalsToday={animalsToday}
          heroUrl={heroUrl}
        />

        <DashboardSection label="Fleet overview">
          <DashboardKpiRow
            devices={fleet.devices}
            history={history.captures}
          />
        </DashboardSection>

        <DashboardSection label="Model insights">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WasteClassificationCard snapshot={snapshot} />
            <RottingPredictionCard snapshot={snapshot} />
            <AnimalDetectionCard snapshot={snapshot} />
            <HygienicRiskLevelCard snapshot={snapshot} />
          </div>
        </DashboardSection>

        <DashboardSection label="Operations">
          <div className={LAYOUT.opsGrid}>
            <div className="flex min-h-0 flex-col xl:col-span-7">
              <DashboardBinsTable
                devices={fleet.devices}
                loading={fleet.loading}
                dbDisabled={fleet.dbDisabled}
                selectedId={selectedBinId}
                onSelect={setSelectedBinId}
              />
            </div>
            <div className="flex min-h-0 flex-col xl:col-span-5">
              <DashboardBinDetail
                device={selectedDevice}
                history={history.captures}
              />
            </div>
          </div>
        </DashboardSection>

        <DashboardSection label="Analytics">
          <div className={LAYOUT.analyticsGrid}>
            <div className="flex min-h-0 flex-col lg:col-span-5">
              <LiveBinMapCard />
            </div>
            <div className="flex min-h-0 flex-col lg:col-span-4">
              <RecentAlertsCard
                history={history.captures}
                dbDisabled={history.dbDisabled}
              />
            </div>
            <div className="flex min-h-0 flex-col lg:col-span-3">
              <RiskTrend7dCard
                history={history.last7d}
                dbDisabled={history.dbDisabled}
              />
            </div>
          </div>
        </DashboardSection>
      </div>
    </DashboardLayout>
  );
}
