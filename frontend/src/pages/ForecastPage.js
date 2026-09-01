import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Calendar,
  TrendingUp,
  MapPin,
  Sun,
  RefreshCw,
  Info,
  BarChart3,
  ChevronDown,
  ChevronUp,
  PlusCircle,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import StatusBanner from "../components/dashboard/StatusBanner";
import EmptyState from "../components/dashboard/EmptyState";
import DashboardInsights from "../components/DashboardInsights";
import {
  LAYOUT,
  MAP_TILE_DARK,
  MAP_ATTRIBUTION,
  badge,
} from "../components/dashboard/dashboardTheme";
import {
  btnSecondary,
  btnGhost,
  labelClass,
  bannerTone,
  forecastStatusBadgeClass,
  forecastStatusColor,
} from "../components/dashboard/dashboardUi";
import { apiUrl } from "../utils/apiBase";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10"
        : tone === "holiday"
          ? "border-violet-500/30 bg-violet-500/10"
          : "border-slate-700/50 bg-slate-950/40";

  return (
    <Card className={`flex items-center gap-3 p-4 ${toneClass}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/60 text-brand-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className={labelClass}>{label}</div>
        <div className="truncate text-sm font-bold text-slate-100">{value}</div>
        {sub ? <div className="truncate text-xs text-slate-500">{sub}</div> : null}
      </div>
    </Card>
  );
}

function InsightCard({ loc }) {
  const color = forecastStatusColor(loc.status);
  const predicted = loc.predictedWasteKg;
  const baseline = loc.baseline;

  let contextLine = "Forecast unavailable";
  if (loc.status === "VERY_HIGH" && baseline?.p90Kg != null) {
    const pct =
      baseline.p90Kg > 0
        ? (((loc.comparison?.kgAboveP90 || 0) / baseline.p90Kg) * 100).toFixed(1)
        : "0";
    contextLine = `${pct}% above historical high threshold`;
  } else if (loc.status === "HIGH") {
    contextLine = "Within upper historical range";
  } else if (loc.status === "NORMAL") {
    contextLine = "Within normal historical range";
  } else if (loc.status === "LOW") {
    contextLine = "Below typical historical range";
  }

  return (
    <div
      className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 transition hover:border-slate-600/60"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">{loc.name}</div>
          <div className="text-xs text-slate-500">{loc.region}</div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${forecastStatusBadgeClass(loc.status)}`}
        >
          {loc.statusLabel || loc.status}
        </span>
      </div>
      {predicted != null ? (
        <>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Predicted</span>
            <span className="font-bold" style={{ color }}>
              {predicted} KG
            </span>
          </div>
          {baseline ? (
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>Median: {baseline.medianKg} KG</span>
              <span>P90: {baseline.p90Kg} KG</span>
            </div>
          ) : null}
          <div className="mt-1 text-[10px]" style={{ color: `${color}cc` }}>
            {contextLine}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">Prediction unavailable</p>
      )}
    </div>
  );
}

function InsightSection({ title, color, icon: Icon, items }) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <div
        className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        <Icon className="h-3 w-3" />
        {title} ({items.length})
      </div>
      <div className="space-y-2">
        {items.map((l) => (
          <InsightCard key={l.id} loc={l} />
        ))}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [selectedDate, setSelectedDate] = useState(tomorrow());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ date });
      const res = await fetch(apiUrl(`/api/waste-data?${q.toString()}`));
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  const summary = data?.summary || {};
  const locations = data?.locations || [];
  const veryHighLocs = locations.filter((l) => l.status === "VERY_HIGH");
  const highLocs = locations.filter((l) => l.status === "HIGH");
  const normalLocs = locations.filter((l) => l.status === "NORMAL");
  const lowLocs = locations.filter((l) => l.status === "LOW");
  const unavailableLocs = locations.filter((l) => l.status === "UNAVAILABLE");

  const headerActions = (
    <>
      <Link to="/waste-update" className={btnSecondary}>
        <PlusCircle className="h-4 w-4" />
        Waste Update
      </Link>
      <label className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2">
        <Calendar className="h-4 w-4 text-brand-400" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border-0 bg-transparent text-sm text-slate-100 outline-none [color-scheme:dark]"
        />
      </label>
      <button
        type="button"
        className={btnGhost}
        onClick={() => fetchData(selectedDate)}
        disabled={loading}
        title="Refresh"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </>
  );

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Municipal Waste Forecast"
          subtitle="Location-based KG forecasts with holiday and long-weekend awareness"
          actions={headerActions}
        />

        {data?.reliability === "out_of_range" ? (
          <StatusBanner
            tone="warn"
            text={
              data?.reliabilityNote ||
              "Selected date exceeds the reliable 12-month forecast window."
            }
          />
        ) : null}

        {error ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${bannerTone("error")}`}>
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Calendar}
            label="Selected date"
            value={data?.selectedDate || selectedDate}
            sub={
              data?.isLongWeekend
                ? `Long weekend · ${data.longWeekendDates?.join(" → ")}`
                : data?.isWeekend
                  ? "Weekend"
                  : "Weekday"
            }
            tone={data?.isLongWeekend ? "holiday" : "default"}
          />
          <StatCard
            icon={Sun}
            label="Day type"
            value={data?.dayType ? data.dayType.replace(/_/g, " ") : "—"}
            tone={data?.isHoliday ? "warn" : "default"}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg predicted waste"
            value={data ? `${summary.averagePredictedWasteKg} KG` : "—"}
            sub={
              data
                ? `Across ${summary.totalSites || locations.length} sites`
                : ""
            }
          />
          <StatCard
            icon={BarChart3}
            label="Status mix"
            value={
              data
                ? `${summary.veryHighCount || 0} very high · ${summary.highCount || 0} high`
                : "—"
            }
            sub={
              data
                ? `${summary.normalCount || 0} normal · ${summary.lowCount || 0} low`
                : ""
            }
            tone={(summary.veryHighCount || 0) > 0 ? "danger" : "default"}
          />
        </div>

        <div className={`${LAYOUT.opsGrid} min-h-[28rem]`}>
          <Card className="relative xl:col-span-8 overflow-hidden p-0">
            {loading ? (
              <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-brand-400" />
                <span className="mt-2 text-sm text-slate-400">Fetching forecast…</span>
              </div>
            ) : null}
            <MapContainer
              center={[6.84, 79.92]}
              zoom={11}
              className="h-[28rem] w-full min-h-[20rem]"
              zoomControl
            >
              <TileLayer url={MAP_TILE_DARK} attribution={MAP_ATTRIBUTION} maxZoom={19} />
              {locations.map((loc) => {
                if (loc.lat == null || loc.lng == null) return null;
                const markerColor = forecastStatusColor(loc.status);
                return (
                  <CircleMarker
                    key={loc.id}
                    center={[loc.lat, loc.lng]}
                    radius={10}
                    pathOptions={{
                      fillColor: markerColor,
                      color: markerColor,
                      fillOpacity: 0.85,
                      weight: 2,
                    }}
                  >
                    <Tooltip sticky direction="top">
                      <strong>{loc.name}</strong>
                      <br />
                      {loc.predictedWasteKg != null
                        ? `${loc.predictedWasteKg} KG`
                        : "Unavailable"}
                      <br />
                      {loc.statusLabel || loc.status}
                    </Tooltip>
                    <Popup>
                      <div className="min-w-[12rem] text-sm leading-relaxed">
                        <div className="font-bold">{loc.name}</div>
                        <div>
                          Predicted:{" "}
                          <strong style={{ color: markerColor }}>
                            {loc.predictedWasteKg != null
                              ? `${loc.predictedWasteKg} KG`
                              : "N/A"}
                          </strong>
                        </div>
                        {loc.baseline ? (
                          <div className="text-xs text-slate-600">
                            Median {loc.baseline.medianKg} KG · P90{" "}
                            {loc.baseline.p90Kg} KG
                          </div>
                        ) : null}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
            <div className="absolute bottom-3 left-3 z-[400] max-w-[14rem] rounded-xl border border-slate-700/60 bg-slate-950/90 p-3 text-xs text-slate-400 backdrop-blur">
              <div className="mb-2 flex items-center gap-1 font-semibold text-slate-300">
                <Info className="h-3 w-3" /> Status legend
              </div>
              {[
                ["Very high", "#ef4444"],
                ["High", "#f97316"],
                ["Normal", "#22c55e"],
                ["Low", "#3b82f6"],
              ].map(([label, color]) => (
                <div key={label} className="mb-1 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  {label}
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex max-h-[28rem] flex-col overflow-hidden xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <MapPin className="h-4 w-4 text-brand-400" />
                Forecast insights
              </div>
              <span className={badge.info}>{locations.length} sites</span>
            </div>

            {data?.isLongWeekend ? (
              <div className={`mx-3 mt-3 rounded-xl border px-3 py-2 text-xs ${bannerTone("info")}`}>
                <strong>Long weekend:</strong> {data.triggerHoliday?.name} · max surge expected
              </div>
            ) : null}
            {data?.isHoliday && !data?.isLongWeekend ? (
              <div className={`mx-3 mt-3 rounded-xl border px-3 py-2 text-xs ${bannerTone("warn")}`}>
                <strong>{data.holidays?.[0]?.name}</strong> — elevated waste expected
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-3">
              {!data && !loading ? (
                <EmptyState
                  title="Select a date"
                  message="Pick a date to load forecasts."
                />
              ) : null}
              {loading && !locations.length ? (
                <div className="flex flex-col items-center py-10 text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin text-brand-400" />
                  <span className="mt-2 text-xs">Loading…</span>
                </div>
              ) : null}
              <InsightSection
                title="Very high"
                color="#f87171"
                icon={AlertTriangle}
                items={veryHighLocs}
              />
              <InsightSection
                title="High"
                color="#fb923c"
                icon={ChevronUp}
                items={highLocs}
              />
              <InsightSection
                title="Normal"
                color="#4ade80"
                icon={Info}
                items={normalLocs}
              />
              <InsightSection
                title="Low"
                color="#60a5fa"
                icon={ChevronDown}
                items={lowLocs}
              />
              <InsightSection
                title="Unavailable"
                color="#94a3b8"
                icon={Info}
                items={unavailableLocs}
              />
            </div>

            {data && !loading ? (
              <div className="border-t border-slate-700/50 bg-slate-950/40 px-4 py-3 text-xs leading-relaxed text-slate-400">
                <div className={labelClass}>Recommendation</div>
                {data.isLongWeekend
                  ? `Long weekend — deploy maximum collection capacity for ${data.longWeekendDates?.join(", ")}.`
                  : veryHighLocs.length > 0
                    ? `${veryHighLocs.length} site(s) above P90 — prioritize ${veryHighLocs.map((a) => a.region).join(", ")}.`
                    : highLocs.length > 0
                      ? `Pre-position vehicles near ${highLocs.map((w) => w.region).join(", ")}.`
                      : "All sites within normal or low range — maintain scheduled routes."}
              </div>
            ) : null}
          </Card>
        </div>

        <Card>
          <Card.Header title="Trend & composition analytics" subtitle="Historical baselines and category breakdown" />
          <Card.Body className="mt-0">
            <DashboardInsights
              selectedDate={selectedDate}
              locationsData={data?.locations}
            />
          </Card.Body>
        </Card>
      </PageShell>
    </DashboardLayout>
  );
}
