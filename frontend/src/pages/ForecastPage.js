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
import "./ForecastPage.css";
import { apiUrl } from "../utils/apiBase";

/* ─── helpers ─────────────────────────────────────────────────────────── */

function fillColor(level) {
  if (level >= 80) return "#ef4444";
  if (level >= 60) return "#f97316";
  if (level >= 40) return "#eab308";
  return "#22c55e";
}

function statusBadgeStyle(status) {
  if (status === "ALERT")
    return { background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)" };
  if (status === "WATCH")
    return { background: "rgba(249,115,22,0.18)", color: "#fdba74", border: "1px solid rgba(249,115,22,0.4)" };
  return { background: "rgba(34,197,94,0.18)", color: "#86efac", border: "1px solid rgba(34,197,94,0.4)" };
}

function cardBorderColor(level) {
  if (level >= 80) return "rgba(239,68,68,0.5)";
  if (level >= 60) return "rgba(249,115,22,0.5)";
  if (level >= 40) return "rgba(234,179,8,0.5)";
  return "rgba(34,197,94,0.5)";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── StatCard ─────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="fp-stat-card" style={{ borderColor: accent?.border || "rgba(71,85,105,0.6)", background: accent?.bg || "rgba(30,41,59,0.4)" }}>
      <div className="fp-stat-icon" style={{ color: accent?.iconColor || "#67e8f9" }}>
        <Icon size={16} />
      </div>
      <div className="fp-stat-text">
        <span className="fp-stat-label">{label}</span>
        <span className="fp-stat-value">{value}</span>
        {sub && <span className="fp-stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ─── InsightCard ──────────────────────────────────────────────────────── */

function InsightCard({ loc }) {
  const border = cardBorderColor(loc.fillLevel);
  const badgeStyle = statusBadgeStyle(loc.status);
  const barColor = fillColor(loc.fillLevel);
  const IconEl = loc.status === "ALERT" ? AlertTriangle : loc.status === "WATCH" ? Eye : ChevronRight;

  return (
    <div className="fp-insight-card" style={{ borderColor: border, background: `rgba(15,23,42,0.6)` }}>
      <div className="fp-insight-header">
        <div className="fp-insight-title">
          <IconEl size={13} style={{ color: barColor, flexShrink: 0 }} />
          <div>
            <div className="fp-insight-name">{loc.name}</div>
            <div className="fp-insight-region">{loc.region}</div>
          </div>
        </div>
        <span className="fp-badge" style={badgeStyle}>{loc.status}</span>
      </div>
      <div className="fp-bar-row">
        <span className="fp-bar-label">Fill level</span>
        <span className="fp-bar-val" style={{ color: barColor }}>{loc.fillLevel}%</span>
      </div>
      <div className="fp-bar-bg">
        <div className="fp-bar-fill" style={{ width: `${loc.fillLevel}%`, background: barColor }} />
      </div>
    </div>
  );
}

/* ─── ForecastPage ─────────────────────────────────────────────────────── */

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

  useEffect(() => { fetchData(selectedDate); }, [selectedDate, fetchData]);

  const alerts = data?.locations?.filter((l) => l.status === "ALERT") ?? [];
  const watches = data?.locations?.filter((l) => l.status === "WATCH") ?? [];
  const normals = data?.locations?.filter((l) => l.status === "NORMAL") ?? [];
  const all = [...alerts, ...watches, ...normals];

  const holiday = data?.holidays?.[0] ?? null;

  return (
    <div className="fp-root">

      {/* ── HEADER ── */}
      <header className="fp-header">
        <div className="fp-header-glow" />
        <div className="fp-header-inner">
          <div>
            <div className="fp-header-eyebrow">
              <Activity size={14} style={{ color: "#67e8f9" }} />
              <span>VisionWaste · Forecast Dashboard</span>
            </div>
            <h1 className="fp-title">Spatio-Temporal Event-Aware Waste Analytics</h1>
            <p className="fp-subtitle">Sri Lanka · Hotspot Forecast Engine</p>
          </div>
          <div className="fp-header-controls">
            <label className="fp-date-picker">
              <Calendar size={14} style={{ color: "#67e8f9" }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="fp-date-input"
              />
            </label>
            <button
              className="fp-refresh-btn"
              onClick={() => fetchData(selectedDate)}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "fp-spin" : ""} style={{ color: "#67e8f9" }} />
            </button>
          </div>
        </div>
      </header>

      {/* ── SUMMARY BAR ── */}
      <div className="fp-summary-bar">
        <StatCard
          icon={Calendar}
          label="Selected Date"
          value={selectedDate}
          sub={
            data?.isLongWeekend
              ? `🏖 Long Weekend (${data.longWeekendDates?.join(" → ")})`
              : data?.isWeekend
                ? "Weekend"
                : "Weekday"
          }
          accent={
            data?.isLongWeekend
              ? { border: "rgba(139,92,246,0.55)", bg: "rgba(76,29,149,0.25)", iconColor: "#c4b5fd" }
              : { border: "rgba(71,85,105,0.5)", bg: "rgba(30,41,59,0.4)" }
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
          accent={
            data?.isLongWeekend
              ? { border: "rgba(139,92,246,0.55)", bg: "rgba(76,29,149,0.25)", iconColor: "#c4b5fd" }
              : data?.isHoliday
                ? { border: "rgba(245,158,11,0.5)", bg: "rgba(120,53,15,0.25)", iconColor: "#fbbf24" }
                : { border: "rgba(71,85,105,0.5)", bg: "rgba(30,41,59,0.4)" }
          }
        />
        <StatCard
          icon={TrendingUp}
          label="Filling Avg "
          value={data ? `${data.globalAvgFill}%` : "—"}
          sub={data?.globalAvgFill >= 70 ? "⚠ High load" : data?.globalAvgFill >= 50 ? "Moderate load" : data ? "Normal load" : ""}
          accent={
            data?.globalAvgFill >= 70
              ? { border: "rgba(239,68,68,0.5)", bg: "rgba(127,29,29,0.25)", iconColor: "#f87171" }
              : data?.globalAvgFill >= 50
                ? { border: "rgba(249,115,22,0.5)", bg: "rgba(124,45,18,0.25)", iconColor: "#fb923c" }
                : { border: "rgba(71,85,105,0.5)", bg: "rgba(30,41,59,0.4)" }
          }
        />
        <StatCard
          icon={Bell}
          label="Active Alerts"
          value={`${alerts.length} Alert · ${watches.length} Watch`}
          sub={`${data?.locations?.length ?? 0} sites monitored`}
          accent={
            alerts.length > 0
              ? { border: "rgba(239,68,68,0.5)", bg: "rgba(127,29,29,0.25)", iconColor: "#f87171" }
              : watches.length > 0
                ? { border: "rgba(249,115,22,0.5)", bg: "rgba(124,45,18,0.25)", iconColor: "#fb923c" }
                : { border: "rgba(71,85,105,0.5)", bg: "rgba(30,41,59,0.4)" }
          }
        />
      </div>

      {/* ── BODY ── */}
      <div className="fp-body">

        {/* MAP */}
        <div className="fp-map-wrap">
          {loading && (
            <div className="fp-map-overlay">
              <RefreshCw size={26} className="fp-spin" style={{ color: "#67e8f9" }} />
              <span style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Fetching forecast…</span>
            </div>
          )}
          {error && (
            <div className="fp-error-banner">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <MapContainer
            center={[7.8731, 80.7718]}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
                  <b>{loc.name}</b><br />
                  {loc.region} · {loc.fillLevel}% · {loc.status}
                </Tooltip>
                <Popup>
                  <div style={{ fontFamily: "system-ui", minWidth: 170, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{loc.name}</div>
                    <div>Region: <b>{loc.region}</b></div>
                    <div>Fill Level: <b style={{ color: fillColor(loc.fillLevel) }}>{loc.fillLevel}%</b></div>
                    <div>Status: <b>{loc.status}</b></div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="fp-legend">
            <div className="fp-legend-title"><Info size={11} /> Fill Level</div>
            {[
              { color: "#ef4444", label: "≥80% Alert" },
              { color: "#f97316", label: "≥60% Watch" },
              { color: "#eab308", label: "≥40% Moderate" },
              { color: "#22c55e", label: "<40%  Normal" },
            ].map(({ color, label }) => (
              <div key={label} className="fp-legend-row">
                <span className="fp-legend-dot" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* INSIGHTS PANEL */}
        <aside className="fp-panel">
          <div className="fp-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} style={{ color: "#a78bfa" }} />
              <span className="fp-panel-title">Actionable Insights</span>
            </div>
            <span className="fp-panel-count">{data?.locations?.length ?? 0} sites</span>
          </div>

          {/* Long Weekend banner (highest priority) */}
          {data?.isLongWeekend && (
            <div className="fp-banner fp-banner-longweekend">
              <span style={{ fontSize: 16, flexShrink: 0 }}>🏖</span>
              <div>
                <div className="fp-banner-title" style={{ color: "#c4b5fd" }}>Long Weekend</div>
                <div className="fp-banner-sub">
                  {data.triggerHoliday?.name} ({data.triggerHoliday?.primary_type})
                  {" · "}{data.longWeekendDates?.join(" → ")}
                </div>
                <div className="fp-banner-sub" style={{ marginTop: 2, color: "#a78bfa" }}>
                  Maximum waste surge expected across all hotspots
                </div>
              </div>
            </div>
          )}
          {/* Holiday banner (only if NOT already shown as long weekend trigger) */}
          {data?.isHoliday && !data?.isLongWeekend && (
            <div className="fp-banner fp-banner-holiday">
              <Sun size={13} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <div>
                <div className="fp-banner-title">{data.holidays[0].name}</div>
                <div className="fp-banner-sub">{data.holidays[0].primary_type} · Fill levels boosted</div>
              </div>
            </div>
          )}
          {/* Plain weekend banner (only if no long weekend and no holiday) */}
          {data?.isWeekend && !data?.isHoliday && !data?.isLongWeekend && (
            <div className="fp-banner fp-banner-weekend">
              <Info size={12} style={{ color: "#38bdf8", flexShrink: 0 }} />
              <span className="fp-banner-sub">Weekend — moderately elevated fill expected</span>
            </div>
          )}

          <div className="fp-scroll">
            {!data && !loading && (
              <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                Select a date to load insights.
              </p>
            )}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 40 }}>
                <RefreshCw size={18} className="fp-spin" style={{ color: "#67e8f9" }} />
                <span style={{ color: "#64748b", fontSize: 12 }}>Loading…</span>
              </div>
            )}

            {!loading && all.length > 0 && (
              <>
                {alerts.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#f87171" }}>
                      <AlertTriangle size={10} /> Critical Alerts ({alerts.length})
                    </div>
                    {alerts.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {watches.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#fb923c" }}>
                      <Eye size={10} /> Watch ({watches.length})
                    </div>
                    {watches.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {normals.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#4ade80" }}>
                      <ChevronRight size={10} /> Normal ({normals.length})
                    </div>
                    {normals.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recommendation footer */}
          {data && !loading && (
            <div className="fp-rec">
              <div className="fp-rec-label">Recommendation</div>
              <p className="fp-rec-text">
                {data.isLongWeekend
                  ? `🏖 Long weekend detected (${data.triggerHoliday?.name}). Deploy maximum collection capacity across all hotspots for ${data.longWeekendDates?.join(", ")}.`
                  : alerts.length > 0
                    ? `⚠ Dispatch collection units to ${alerts.map((a) => a.region).join(", ")} immediately.`
                    : watches.length > 0
                      ? `🔶 Pre-position vehicles near ${watches.map((w) => w.region).join(", ")} before peak hours.`
                      : "✅ All sites within normal parameters. Maintain scheduled routes."}
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── ADVANCED INSIGHTS SECTION ── */}
      <div className="fp-insights-section">
        <DashboardInsights selectedDate={selectedDate} />
      </div>
    </div>
  );
}
