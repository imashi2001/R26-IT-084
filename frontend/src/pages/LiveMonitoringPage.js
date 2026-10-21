import React, { useState, useMemo } from "react";
import {
  Activity,
  Crosshair,
  RefreshCw,
  Database,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { btnSecondary, bannerTone, summaryTone } from "../components/dashboard/dashboardUi";
import LiveBinMap from "../components/livemonitoring/LiveBinMap";
import BinListPanel from "../components/livemonitoring/BinListPanel";
import BinDetailsModal from "../components/livemonitoring/BinDetailsModal";
import useLiveBinMap from "../hooks/useLiveBinMap";

/*
 * /live-monitoring (was the ESP32 upload UI; that is now /bin-level-detector)
 *
 * Layout under DashboardLayout:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Header: title + nearest-bin chip + active count + refresh    │
 *   ├────────────────────┬─────────────────────────────────────────┤
 *   │                    │                                         │
 *   │  Bin list panel    │  Live bin map                           │
 *   │  (search, active   │  (markers, hover popup, More-details)   │
 *   │   + inactive)      │                                         │
 *   │                    │                                         │
 *   └────────────────────┴─────────────────────────────────────────┘
 *
 * Selecting a bin (from the list or the map's "More details" button)
 * opens BinDetailsModal which fetches /devices/:id/latest and
 * /devices/:id/captures for the full picture.
 */

function StatChip({ icon: Icon, label, value, tone = "default" }) {
  const toneClass = summaryTone(
    tone === "brand"
      ? "brand"
      : tone === "amber"
        ? "amber"
        : tone === "risk"
          ? "risk"
          : "default"
  );
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[11px] uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function formatDistance(m) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function LiveMonitoringPage() {
  const {
    bins,
    activeBins,
    inactiveBins,
    nearestBinId,
    nearestDistanceM,
    userLocation,
    center,
    loading,
    error,
    dbDisabled,
    refresh,
  } = useLiveBinMap();

  const [focusBinId, setFocusBinId] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);

  const nearestBin = useMemo(
    () => bins.find((b) => b.id === nearestBinId) || null,
    [bins, nearestBinId]
  );

  // High-risk count across active bins (used in header chip).
  const highRiskCount = useMemo(
    () =>
      activeBins.filter(
        (b) =>
          b.latest_risk_level === "HIGH" || b.latest_risk_level === "CRITICAL"
      ).length,
    [activeBins]
  );

  const handleSelectBin = (bin) => {
    setFocusBinId(bin.id);
    setSelectedBin(bin);
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Live Monitoring
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Real-time map of registered bins. Hover a marker to see status,
              click <strong>More details</strong> to inspect a bin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nearestBin ? (
              <button
                type="button"
                onClick={() => setFocusBinId(nearestBin.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-500/15"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wider opacity-70">
                  Nearest
                </span>
                <span className="font-semibold">
                  {nearestBin.name || `BIN${nearestBin.id}`}
                </span>
                <span className="text-[10px] text-brand-400">
                  · {formatDistance(nearestDistanceM)}
                </span>
              </button>
            ) : null}

            <StatChip
              icon={Activity}
              label="Active"
              value={activeBins.length}
              tone="brand"
            />

            {highRiskCount > 0 ? (
              <StatChip
                icon={ShieldAlert}
                label="High risk"
                value={highRiskCount}
                tone="risk"
              />
            ) : null}

            <button
              type="button"
              onClick={refresh}
              className={btnSecondary}
              aria-label="Refresh bin data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Banners */}
        {dbDisabled ? (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone("amber")}`}>
            <Database className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <strong>Database is not configured.</strong> Set{" "}
              <code className="rounded bg-amber-500/20 px-1 text-amber-200">DATABASE_URL</code>{" "}
              on the backend service to register bins and start seeing live
              activity here.
            </div>
          </div>
        ) : null}

        {error ? (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone("red")}`}>
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        ) : null}

        {/* Main: list + map */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <BinListPanel
            activeBins={activeBins}
            inactiveBins={inactiveBins}
            nearestBinId={nearestBinId}
            onFocusBin={setFocusBinId}
            onSelectBin={handleSelectBin}
            className="lg:col-span-4 max-h-[78vh]"
          />

          <div className="lg:col-span-8">
            {loading && bins.length === 0 ? (
              <div className="flex h-[78vh] items-center justify-center rounded-xl border border-slate-700/50 bg-slate-950/40 text-sm text-slate-400">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading bins…
              </div>
            ) : bins.length === 0 && !dbDisabled && !error ? (
              <div className="flex h-[78vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-950/30 p-6 text-center text-slate-400">
                <div className="mb-1 text-base font-semibold text-slate-200">
                  No bins on the map
                </div>
                <p className="max-w-md text-sm">
                  Register a bin from the Admin page and assign coordinates to
                  see it appear here in real time.
                </p>
              </div>
            ) : (
              <LiveBinMap
                bins={bins}
                center={center}
                nearestBinId={nearestBinId}
                userLocation={userLocation}
                focusBinId={focusBinId}
                onSelectBin={handleSelectBin}
                height="78vh"
              />
            )}
          </div>
        </div>
      </div>

      <BinDetailsModal bin={selectedBin} onClose={() => setSelectedBin(null)} />
    </DashboardLayout>
  );
}
