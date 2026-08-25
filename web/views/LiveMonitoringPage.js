"use client";
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
  const tones = {
    default: "bg-slate-100 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    risk: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${tones[tone]}`}
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
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
              Live Monitoring
            </h1>
            <p className="text-sm text-ink-500 mt-0.5">
              Real-time map of registered bins. Hover a marker to see status,
              click <strong>More details</strong> to inspect a bin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nearestBin ? (
              <button
                type="button"
                onClick={() => setFocusBinId(nearestBin.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wider opacity-70">
                  Nearest
                </span>
                <span className="font-semibold">
                  {nearestBin.name || `BIN${nearestBin.id}`}
                </span>
                <span className="text-[10px] text-brand-500">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 transition"
              aria-label="Refresh bin data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Banners */}
        {dbDisabled ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Database className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <strong>Database is not configured.</strong> Set{" "}
              <code className="rounded bg-amber-100 px-1">DATABASE_URL</code>{" "}
              on the backend service to register bins and start seeing live
              activity here.
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">{error}</div>
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
              <div className="flex h-[78vh] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-ink-500">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading bins…
              </div>
            ) : bins.length === 0 && !dbDisabled && !error ? (
              <div className="flex h-[78vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-ink-500 p-6">
                <div className="text-base font-semibold text-ink-700 mb-1">
                  No bins on the map
                </div>
                <p className="text-sm max-w-md">
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
