import React, { useState, useEffect, useCallback } from "react";
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
  Eye,
  Calendar,
  TrendingUp,
  MapPin,
  Bell,
  Activity,
  Sun,
  RefreshCw,
  Info,
  ChevronRight,
} from "lucide-react";
import DashboardInsights from "../components/DashboardInsights";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import DashboardSection from "../components/dashboard/DashboardSection";
import Card from "../components/dashboard/Card";
import EmptyState from "../components/dashboard/EmptyState";
import StatusBanner from "../components/dashboard/StatusBanner";
import { LAYOUT, MAP_TILE_DARK } from "../components/dashboard/dashboardTheme";
import {
  btnGhost,
  btnSecondary,
  inputClass,
} from "../components/dashboard/dashboardUi";
import { apiUrl } from "../utils/apiBase";

function fillColor(level) {
  if (level >= 80) return "#ef4444";
  if (level >= 60) return "#f97316";
  if (level >= 40) return "#eab308";
  return "#22c55e";
}

function statusBadgeClass(status) {
  if (status === "ALERT") return "border-red-500/40 bg-red-500/15 text-red-300";
  if (status === "WATCH") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  return "border-brand-500/30 bg-brand-500/15 text-brand-300";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ icon: Icon, label, value, sub, accentBorder = "border-slate-700/50" }) {
  return (
    <div className={`rounded-xl border ${accentBorder} bg-slate-900/60 p-4`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-brand-400">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-bold text-slate-100">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ loc }) {
  const barColor = fillColor(loc.fillLevel);
  const IconEl =
    loc.status === "ALERT"
      ? AlertTriangle
      : loc.status === "WATCH"
        ? Eye
        : ChevronRight;

  return (
    <div
      className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3"
      style={{ borderColor: `${barColor}55` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <IconEl className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: barColor }} />
          <div>
            <p className="text-sm font-semibold text-slate-100">{loc.name}</p>
            <p className="text-xs text-slate-500">{loc.region}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(loc.status)}`}
        >
          {loc.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">Fill level</span>
        <span className="font-semibold" style={{ color: barColor }}>
          {loc.fillLevel}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${loc.fillLevel}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [selectedDate, setSelectedDate] = useState(today());
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

  const alerts = data?.locations?.filter((l) => l.status === "ALERT") ?? [];
  const watches = data?.locations?.filter((l) => l.status === "WATCH") ?? [];
  const normals = data?.locations?.filter((l) => l.status === "NORMAL") ?? [];
  const all = [...alerts, ...watches, ...normals];

  return (
    <DashboardLayout>
      <PageShell
        banner={
          error ? { tone: "error", text: error, onRetry: () => fetchData(selectedDate) } : null
        }
      >
        <PageHeader
          title="Spatio-Temporal Forecast"
          subtitle="Sri Lanka hotspot forecast engine — holiday and tourism demand analytics"
          actions={
            <>
              <label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`${inputClass} mt-0 w-auto`}
                />
              </label>
              <button
                type="button"
                onClick={() => fetchData(selectedDate)}
                disabled={loading}
                className={btnSecondary}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </>
          }
        />

        <div className={LAYOUT.kpiGrid}>
          <StatCard
            icon={Calendar}
            label="Selected Date"
            value={selectedDate}
            sub={
              data?.isLongWeekend
                ? `Long weekend (${data.longWeekendDates?.join(" → ")})`
                : data?.isWeekend
                  ? "Weekend"
                  : "Weekday"
            }
          />
          <StatCard
            icon={Sun}
            label="Day Type"
            value={
              data?.isLongWeekend
                ? "LONG WEEKEND"
                : data?.isHoliday
                  ? "HOLIDAY"
                  : data?.isWeekend
                    ? "WEEKEND"
                    : "NORMAL WEEKDAY"
            }
          />
          <StatCard
            icon={TrendingUp}
            label="Filling Avg"
            value={data ? `${data.globalAvgFill}%` : "—"}
            sub={
              data?.globalAvgFill >= 70
                ? "High load"
                : data?.globalAvgFill >= 50
                  ? "Moderate load"
                  : data
                    ? "Normal load"
                    : ""
            }
            accentBorder={
              data?.globalAvgFill >= 70
                ? "border-red-500/40"
                : data?.globalAvgFill >= 50
                  ? "border-amber-500/40"
                  : undefined
            }
          />
          <StatCard
            icon={Bell}
            label="Active Alerts"
            value={`${alerts.length} Alert · ${watches.length} Watch`}
            sub={`${data?.locations?.length ?? 0} sites monitored`}
            accentBorder={
              alerts.length > 0 ? "border-red-500/40" : watches.length > 0 ? "border-amber-500/40" : undefined
            }
          />
        </div>

        <DashboardSection label="Forecast map & insights">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:min-h-[28rem]">
            <Card className="relative min-h-[20rem] xl:col-span-8">
              <Card.Header icon={MapPin} title="Hotspot map" accent="text-sky-400" />
              <Card.Body className="relative min-h-[18rem] overflow-hidden rounded-xl p-0">
                {loading ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                    <RefreshCw className="h-6 w-6 animate-spin text-brand-400" />
                    <span className="mt-2 text-sm text-slate-400">Fetching forecast…</span>
                  </div>
                ) : null}
                <MapContainer
                  center={[7.8731, 80.7718]}
                  zoom={7}
                  style={{ height: "100%", minHeight: "18rem", width: "100%" }}
                  zoomControl
                >
                  <TileLayer
                    url={MAP_TILE_DARK}
                    attribution='&copy; <a href="https://carto.com">CARTO</a>'
                    maxZoom={19}
                  />
                  {data?.locations?.map((loc) => (
                    <CircleMarker
                      key={loc.id}
                      center={[loc.lat, loc.lng]}
                      radius={13 + (loc.fillLevel / 100) * 12}
                      pathOptions={{
                        fillColor: fillColor(loc.fillLevel),
                        fillOpacity: 0.78,
                        color: "#fff",
                        weight: 1.5,
                        opacity: 0.7,
                      }}
                    >
                      <Tooltip direction="top">
                        <b>{loc.name}</b>
                        <br />
                        {loc.region} · {loc.fillLevel}% · {loc.status}
                      </Tooltip>
                      <Popup>
                        <div className="min-w-[170px] text-sm leading-relaxed text-slate-800">
                          <div className="mb-1 font-bold">{loc.name}</div>
                          <div>Region: <b>{loc.region}</b></div>
                          <div>
                            Fill:{" "}
                            <b style={{ color: fillColor(loc.fillLevel) }}>
                              {loc.fillLevel}%
                            </b>
                          </div>
                          <div>Status: <b>{loc.status}</b></div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
                <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-700/60 bg-slate-950/90 p-3 text-xs text-slate-300 backdrop-blur-sm">
                  <div className="mb-2 flex items-center gap-1 font-semibold text-slate-400">
                    <Info className="h-3 w-3" /> Fill Level
                  </div>
                  {[
                    { color: "#ef4444", label: "≥80% Alert" },
                    { color: "#f97316", label: "≥60% Watch" },
                    { color: "#eab308", label: "≥40% Moderate" },
                    { color: "#22c55e", label: "<40% Normal" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2 py-0.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: color }}
                      />
                      {label}
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>

            <Card className="flex min-h-[20rem] flex-col xl:col-span-4">
              <Card.Header
                icon={Activity}
                title="Actionable insights"
                accent="text-violet-400"
                right={
                  <span className="text-[11px] text-slate-500">
                    {data?.locations?.length ?? 0} sites
                  </span>
                }
              />
              <Card.Body className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                {data?.isLongWeekend ? (
                  <StatusBanner
                    tone="info"
                    text={`Long weekend: ${data.triggerHoliday?.name} (${data.longWeekendDates?.join(" → ")})`}
                  />
                ) : null}
                {data?.isHoliday && !data?.isLongWeekend ? (
                  <StatusBanner
                    tone="warn"
                    text={`${data.holidays[0].name} — ${data.holidays[0].primary_type}`}
                  />
                ) : null}
                {data?.isWeekend && !data?.isHoliday && !data?.isLongWeekend ? (
                  <StatusBanner tone="info" text="Weekend — moderately elevated fill expected" />
                ) : null}

                {!data && !loading ? (
                  <EmptyState title="Select a date to load insights" />
                ) : null}
                {loading && !data ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-brand-400" />
                    <span className="text-xs text-slate-500">Loading…</span>
                  </div>
                ) : null}

                {!loading && all.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.length > 0 ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">
                          Critical ({alerts.length})
                        </p>
                        <div className="space-y-2">
                          {alerts.map((l) => (
                            <InsightCard key={l.id} loc={l} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {watches.length > 0 ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Watch ({watches.length})
                        </p>
                        <div className="space-y-2">
                          {watches.map((l) => (
                            <InsightCard key={l.id} loc={l} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {normals.length > 0 ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-400">
                          Normal ({normals.length})
                        </p>
                        <div className="space-y-2">
                          {normals.map((l) => (
                            <InsightCard key={l.id} loc={l} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card.Body>
              {data && !loading ? (
                <Card.Footer>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Recommendation
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {data.isLongWeekend
                      ? `Long weekend (${data.triggerHoliday?.name}). Deploy maximum collection capacity for ${data.longWeekendDates?.join(", ")}.`
                      : alerts.length > 0
                        ? `Dispatch collection units to ${alerts.map((a) => a.region).join(", ")} immediately.`
                        : watches.length > 0
                          ? `Pre-position vehicles near ${watches.map((w) => w.region).join(", ")} before peak hours.`
                          : "All sites within normal parameters. Maintain scheduled routes."}
                  </p>
                </Card.Footer>
              ) : null}
            </Card>
          </div>
        </DashboardSection>

        <DashboardSection label="Advanced analytics">
          <DashboardInsights selectedDate={selectedDate} />
        </DashboardSection>
      </PageShell>
    </DashboardLayout>
  );
}
