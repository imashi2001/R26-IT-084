import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Activity,
  Sun,
  RefreshCw,
  Info,
  BarChart3,
  ChevronDown,
  ChevronUp,
  PlusCircle,
} from "lucide-react";
import DashboardInsights from "../components/DashboardInsights";
import "./ForecastPage.css";
import { apiUrl } from "../utils/apiBase";

/* ─── Status utilities (single source from backend) ─────────────────────── */
function statusColor(status) {
  switch (status) {
    case "VERY_HIGH": return "#ef4444";
    case "HIGH":      return "#f97316";
    case "NORMAL":    return "#22c55e";
    case "LOW":       return "#3b82f6";
    case "UNAVAILABLE":
    default:          return "#eab308";
  }
}

function statusBadgeStyle(status) {
  const color = statusColor(status);
  return {
    background: `${color}22`,
    color,
    border: `1px solid ${color}55`,
  };
}

function statusIcon(status) {
  switch (status) {
    case "VERY_HIGH": return "🔴";
    case "HIGH":      return "🟠";
    case "NORMAL":    return "🟢";
    case "LOW":       return "🔵";
    default:          return "⚪";
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

/* ─── InsightCard (KG-based, no fill-level) ────────────────────────────── */
function InsightCard({ loc }) {
  const color = statusColor(loc.status);
  const badge = statusBadgeStyle(loc.status);
  const predicted = loc.predictedWasteKg;
  const baseline = loc.baseline;
  const comparison = loc.comparison;

  let contextLine = "";
  if (loc.status === "VERY_HIGH" && baseline && comparison?.kgAboveP90 != null) {
    const pctAbove = baseline.p90Kg > 0
      ? ((comparison.kgAboveP90 / baseline.p90Kg) * 100).toFixed(1)
      : "0";
    contextLine = `${pctAbove}% above historical high threshold`;
  } else if (loc.status === "HIGH" && baseline) {
    contextLine = "Within upper historical range";
  } else if (loc.status === "NORMAL" && baseline) {
    contextLine = "Within normal historical range";
  } else if (loc.status === "LOW" && baseline) {
    contextLine = "Below typical historical range";
  } else {
    contextLine = "Forecast unavailable";
  }

  return (
    <div className="fp-insight-card" style={{ borderColor: `${color}55`, background: "rgba(15,23,42,0.6)" }}>
      <div className="fp-insight-header">
        <div className="fp-insight-title">
          <span style={{ fontSize: 13, flexShrink: 0 }}>{statusIcon(loc.status)}</span>
          <div>
            <div className="fp-insight-name">{loc.name}</div>
            <div className="fp-insight-region">{loc.region}</div>
          </div>
        </div>
        <span className="fp-badge" style={badge}>{loc.statusLabel || loc.status}</span>
      </div>

      {predicted !== null && predicted !== undefined ? (
        <>
          <div className="fp-bar-row">
            <span className="fp-bar-label">Predicted</span>
            <span className="fp-bar-val" style={{ color }}>{predicted} KG</span>
          </div>
          {baseline && (
            <div className="fp-bar-row" style={{ marginTop: 2 }}>
              <span className="fp-bar-label" style={{ fontSize: 10 }}>Typical (median): {baseline.medianKg} KG</span>
              {baseline.p90Kg && (
                <span className="fp-bar-label" style={{ fontSize: 10 }}>P90: {baseline.p90Kg} KG</span>
              )}
            </div>
          )}
          <div className="fp-bar-label" style={{ fontSize: 10, color: `${color}cc`, marginTop: 4 }}>
            {contextLine}
          </div>
        </>
      ) : (
        <div className="fp-bar-label" style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          Prediction unavailable
        </div>
      )}
    </div>
  );
}

/* ─── ForecastPage ─────────────────────────────────────────────────────── */
export default function ForecastPage() {
  const navigate = useNavigate();
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

  useEffect(() => { fetchData(selectedDate); }, [selectedDate, fetchData]);

  const summary = data?.summary || {};
  const locations = data?.locations || [];

  // Group by status
  const veryHighLocs = locations.filter((l) => l.status === "VERY_HIGH");
  const highLocs = locations.filter((l) => l.status === "HIGH");
  const normalLocs = locations.filter((l) => l.status === "NORMAL");
  const lowLocs = locations.filter((l) => l.status === "LOW");
  const unavailableLocs = locations.filter((l) => l.status === "UNAVAILABLE");

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
            <h1 className="fp-title">Municipal Waste Forecasting Dashboard</h1>
            <p className="fp-subtitle">Historical-data-driven XGBoost predictions · Sri Lanka</p>
          </div>
          <div className="fp-header-controls">
            <button
              className="fp-waste-update-btn"
              onClick={() => navigate("/waste-update")}
              title="Waste Entry & Retraining Pipeline"
            >
              <PlusCircle size={16} />
              <span>Waste Update</span>
            </button>
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

      {/* ── RELIABILITY HORIZON BANNER ── */}
      {data?.reliability === "out_of_range" && (
        <div style={{ background: "rgba(234,179,8,0.15)", border: "1px solid #eab308", color: "#fef08a", padding: "12px 16px", borderRadius: 8, margin: "16px 24px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} style={{ color: "#eab308", flexShrink: 0 }} />
          <span><strong>Forecast Horizon Notice:</strong> {data?.reliabilityNote || "The selected date exceeds the 12-month reliable forecast horizon (2023-01 to 2026-12). Showing nearest reliable forecast."}</span>
        </div>
      )}

      {/* ── SUMMARY BAR ── */}
      <div className="fp-summary-bar">
        <StatCard
          icon={Calendar}
          label="Selected Date"
          value={data?.selectedDate || selectedDate}
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
            data?.dayType
              ? data.dayType.replace(/_/g, " ")
              : "—"
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
          label="Average Predicted Waste"
          value={data ? `${summary.averagePredictedWasteKg} KG` : "—"}
          sub={data ? `Across ${summary.totalSites || locations.length} monitoring sites` : ""}
        />
        <StatCard
          icon={BarChart3}
          label="Forecast Status"
          value={
            data
              ? `${summary.veryHighCount || 0} Very High · ${summary.highCount || 0} High`
              : "—"
          }
          sub={
            data
              ? `${summary.normalCount || 0} Normal · ${summary.lowCount || 0} Low · ${summary.totalSites || locations.length} sites`
              : ""
          }
          accent={
            (summary.veryHighCount || 0) > 0
              ? { border: "rgba(239,68,68,0.5)", bg: "rgba(127,29,29,0.25)", iconColor: "#f87171" }
              : (summary.highCount || 0) > 0
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
            center={[6.84, 79.92]}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />

            {locations.map((loc) => {
              if (loc.lat === undefined || loc.lng === undefined) return null;

              const markerColor = statusColor(loc.status);

              return (
                <CircleMarker
                  key={loc.id}
                  center={[loc.lat, loc.lng]}
                  radius={10}
                  pathOptions={{
                    fillColor: markerColor,
                    color: markerColor,
                    fillOpacity: 0.8,
                    weight: 2
                  }}
                >
                  <Tooltip sticky direction="top">
                    <b>{loc.name}</b><br />
                    Predicted: {loc.predictedWasteKg != null ? `${loc.predictedWasteKg} KG` : "Unavailable"}<br />
                    Status: <b>{loc.statusLabel || loc.status}</b>
                  </Tooltip>
                  <Popup>
                    <div style={{ fontFamily: "system-ui", minWidth: 200, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{loc.name}</div>
                      <div>Forecast date: <b>{loc.forecastDate || data?.selectedDate}</b></div>
                      <div>Predicted waste: <b style={{ color: markerColor }}>{loc.predictedWasteKg != null ? `${loc.predictedWasteKg} KG` : "Unavailable"}</b></div>
                      {loc.baseline && (
                        <>
                          <div>Typical daily waste (median): <b>{loc.baseline.medianKg} KG</b></div>
                          <div>High threshold (P90): <b>{loc.baseline.p90Kg} KG</b></div>
                        </>
                      )}
                      <div>Status: <span style={{ color: markerColor, fontWeight: 700 }}>{loc.statusLabel || loc.status}</span></div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Legend */}
          <div className="fp-legend">
            <div className="fp-legend-title"><Info size={11} /> Waste Forecast Status</div>
            {[
              { color: "#ef4444", label: "Very High: ≥ location P90" },
              { color: "#f97316", label: "High: Q3 to < P90" },
              { color: "#22c55e", label: "Normal: Q1 to < Q3" },
              { color: "#3b82f6", label: "Low: < location Q1" },
              { color: "#eab308", label: "Unavailable" },
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
              <span className="fp-panel-title">Forecast Insights</span>
            </div>
            <span className="fp-panel-count">{locations.length} sites</span>
          </div>

          {/* Long Weekend banner */}
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
          {/* Holiday banner */}
          {data?.isHoliday && !data?.isLongWeekend && (
            <div className="fp-banner fp-banner-holiday">
              <Sun size={13} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <div>
                <div className="fp-banner-title">{data.holidays?.[0]?.name}</div>
                <div className="fp-banner-sub">{data.holidays?.[0]?.primary_type} · Elevated waste expected</div>
              </div>
            </div>
          )}
          {/* Weekend banner */}
          {data?.isWeekend && !data?.isHoliday && !data?.isLongWeekend && (
            <div className="fp-banner fp-banner-weekend">
              <Info size={12} style={{ color: "#38bdf8", flexShrink: 0 }} />
              <span className="fp-banner-sub">Weekend — moderately elevated waste expected</span>
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

            {!loading && locations.length > 0 && (
              <>
                {veryHighLocs.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#f87171" }}>
                      <AlertTriangle size={10} /> Very High Forecasts ({veryHighLocs.length})
                    </div>
                    {veryHighLocs.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {highLocs.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#fb923c" }}>
                      <ChevronUp size={10} /> High Forecasts ({highLocs.length})
                    </div>
                    {highLocs.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {normalLocs.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#4ade80" }}>
                      <Info size={10} /> Normal Forecasts ({normalLocs.length})
                    </div>
                    {normalLocs.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {lowLocs.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#60a5fa" }}>
                      <ChevronDown size={10} /> Low Forecasts ({lowLocs.length})
                    </div>
                    {lowLocs.map((l) => <InsightCard key={l.id} loc={l} />)}
                  </div>
                )}
                {unavailableLocs.length > 0 && (
                  <div className="fp-section">
                    <div className="fp-section-label" style={{ color: "#94a3b8" }}>
                      Unavailable ({unavailableLocs.length})
                    </div>
                    {unavailableLocs.map((l) => <InsightCard key={l.id} loc={l} />)}
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
                  : veryHighLocs.length > 0
                    ? `🔴 ${veryHighLocs.length} site(s) forecasting above historical P90. Prioritize collection at ${veryHighLocs.map((a) => a.region).join(", ")}.`
                    : highLocs.length > 0
                      ? `🟠 ${highLocs.length} site(s) in upper historical range. Pre-position vehicles near ${highLocs.map((w) => w.region).join(", ")}.`
                      : "✅ All sites within normal or low range. Maintain scheduled routes."}
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── ADVANCED INSIGHTS SECTION ── */}
      <div className="fp-insights-section">
        <DashboardInsights selectedDate={selectedDate} locationsData={data?.locations} />
      </div>
    </div>
  );
}
