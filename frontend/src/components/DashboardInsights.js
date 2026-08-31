import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { FileDown, TrendingUp, Zap, MapPin } from "lucide-react";
import { jsPDF } from "jspdf";
import { apiUrl } from "../utils/apiBase";
import "./DashboardInsights.css";

/* ─── Location metadata ────────────────────────────────────────────────── */
const LOCATIONS = [
  { id: "moratuwa-mc", name: "Moratuwa M.C.", region: "Moratuwa" },
  { id: "boralesgamuwa-uc", name: "Boralesgamuwa U.C.", region: "Boralesgamuwa" },
  { id: "kesbewa-uc", name: "Kesbewa U.C.", region: "Kesbewa" },
  { id: "dehiwala-mtlavinia", name: "Dehiwala - Mt Lavinia", region: "Dehiwala" },
  { id: "kotte-mc", name: "Sri J,puraKotte M.C.", region: "Kotte" },
  { id: "maharagama-uc", name: "Maharagama U.C.", region: "Maharagama" },
  { id: "homagama-ps", name: "Homagama P.S.", region: "Homagama" },
  { id: "kdu-campus", name: "Kothalawala Defence University", region: "Kdu" },
];

/* ─── Status color helper ──────────────────────────────────────────────── */
function getStatusColor(status) {
  switch (status) {
    case "VERY_HIGH": return "#ef4444";
    case "HIGH":      return "#f97316";
    case "NORMAL":    return "#22c55e";
    case "LOW":       return "#3b82f6";
    case "UNAVAILABLE":
    default:          return "#eab308";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "VERY_HIGH": return "🔴";
    case "HIGH":      return "🟠";
    case "NORMAL":    return "🟢";
    case "LOW":       return "🔵";
    default:          return "🟡";
  }
}

/* ─── Category colors ──────────────────────────────────────────────────── */
function getCategoryColor(name) {
  const colors = {
    "Unburnable": "#94a3b8",
    "SOW": "#10b981",
    "Burnable": "#ef4444",
    "Bulky Waste": "#f59e0b",
    "Industrial Waste": "#8b5cf6",
    "Slaughter House Waste": "#ec4899",
    "Sanitary Waste": "#e11d48",
    "C & D": "#06b6d4",
  };
  return colors[name] || "#64748b";
}

/* ─── 1. Waste Category Distribution (Donut) ─────────────────────────── */
function WasteCategoryChart({ locationId, locationsData }) {
  const activeLoc = locationsData?.find((l) => l.id === locationId);
  const composition = activeLoc?.composition;

  if (!composition || Object.keys(composition).length === 0) {
    return (
      <div className="di-chart-card">
        <div className="di-chart-header">
          <div>
            <h3 className="di-chart-title">Estimated Waste Category Distribution</h3>
            <p className="di-chart-subtitle">
              Based on Historical Category Proportions (2023–2025)
            </p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#64748b", fontSize: 13 }}>
          Category data unavailable for this location.
        </div>
      </div>
    );
  }

  const rawEntries = Object.entries(composition);
  const rawTotalKg = rawEntries.reduce((sum, [, val]) => {
    const kgVal = typeof val === "object" && val !== null ? val.kg : Number(val);
    return sum + (Number.isFinite(kgVal) ? kgVal : 0);
  }, 0);

  const chartData = rawEntries.map(([name, val]) => {
    const rawKg = typeof val === "object" && val !== null ? (val.kg ?? 0) : Number(val) || 0;
    const percent = typeof val === "object" && val !== null && val.percent !== undefined
      ? val.percent
      : rawTotalKg > 0 ? Number(((rawKg / rawTotalKg) * 100).toFixed(1)) : 0;

    return {
      name,
      value: percent,
      rawKg: Math.round(rawKg * 10) / 10,
      fill: getCategoryColor(name),
    };
  });

  const totalKg = Math.round(rawTotalKg * 10) / 10;

  return (
    <div className="di-chart-card">
      <div className="di-chart-header">
        <div>
          <h3 className="di-chart-title">Estimated Waste Category Distribution</h3>
          <p className="di-chart-subtitle">
            Based on Historical Category Proportions (2023–2025)
          </p>
        </div>
        <div className="di-header-icon" style={{ color: "#10b981" }}>
          <TrendingUp size={18} />
        </div>
      </div>

      <div className="di-donut-container">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => {
                const rawKg = props.payload.rawKg;
                return [`${value}% (${rawKg} kg)`, name];
              }}
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid rgba(51,65,85,0.5)",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="di-donut-center">
          <div className="di-total-label">Total Forecasted</div>
          <div className="di-total-value">{Math.round(totalKg * 10) / 10} kg</div>
        </div>
      </div>

      <div className="di-legend">
        {chartData.map((cat) => (
          <div key={cat.name} className="di-legend-item">
            <div className="di-legend-color" style={{ background: cat.fill }} />
            <span className="di-legend-name">{cat.name}</span>
            <span className="di-legend-value">
              {cat.value}% ({cat.rawKg} kg)
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 12px", fontSize: 10, color: "#64748b", borderTop: "1px solid rgba(51,65,85,0.3)" }}>
        ⓘ Category allocation estimated from historical proportions. XGBoost predicts total waste only.
      </div>
    </div>
  );
}

/* ─── 2. Waste Trend Chart (7+7 from API) ─────────────────────────────── */
function WasteTrendChart({ selectedDate, locationId }) {
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(null);

  const fetchTrend = useCallback(async () => {
    if (!selectedDate || !locationId) return;
    setTrendLoading(true);
    setTrendError(null);
    try {
      const q = new URLSearchParams({ date: selectedDate, location: locationId });
      const res = await fetch(apiUrl(`/api/waste-trend?${q.toString()}`));
      if (!res.ok) throw new Error(`Trend API error ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setTrendData(json.trend || []);
    } catch (err) {
      setTrendError(err.message);
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [selectedDate, locationId]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  // Transform for recharts
  const chartData = trendData.map((point) => ({
    date: point.label,
    fullDate: point.date,
    historical: point.type === "historical" ? point.totalWasteKg : null,
    predicted: point.type === "forecast" ? point.totalWasteKg : null,
    isAnchor: point.isAnchor,
    // Bridge: connect the last historical point to the first forecast point
    ...(point.isAnchor ? { predicted: point.totalWasteKg } : {}),
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      const value = data.historical || data.predicted;
      const type = data.historical ? "Observed Historical" : "XGBoost Forecast";
      return (
        <div className="di-tooltip">
          <p className="di-tooltip-date">{data.fullDate}</p>
          <p className="di-tooltip-value">{type}: {value} KG</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="di-chart-card">
      <div className="di-chart-header">
        <div>
          <h3 className="di-chart-title">Waste Trend Analysis</h3>
          <p className="di-chart-subtitle">
            Observed Historical Waste (KG) vs XGBoost Forecasted Waste (KG)
          </p>
        </div>
        <div className="di-header-icon" style={{ color: "#06b6d4" }}>
          <TrendingUp size={18} />
        </div>
      </div>

      {trendLoading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#64748b", fontSize: 13 }}>
          Loading trend data…
        </div>
      )}

      {trendError && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#f87171", fontSize: 13 }}>
          {trendError}
        </div>
      )}

      {!trendLoading && !trendError && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "12px" }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} label={{ value: "KG", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              contentStyle={{
                background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(51,65,85,0.5)",
                borderRadius: "6px",
              }}
            />
            <ReferenceLine
              x={chartData.find((d) => d.isAnchor)?.date}
              stroke="#a78bfa"
              strokeDasharray="5 5"
              label={{ value: "Forecast starts", position: "top", fill: "#a78bfa", fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="historical"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              name="Observed Historical Waste (KG)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
              name="XGBoost Forecasted Waste (KG)"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div style={{ padding: "8px 12px", fontSize: 10, color: "#64748b", borderTop: "1px solid rgba(51,65,85,0.3)" }}>
        ⓘ Both historical reconstruction and forecasts use the trained XGBoost model (2023–2025 data). No live sensor data.
      </div>
    </div>
  );
}

/* ─── Download Report (PDF) ──────────────────────────────────────────── */
function downloadReport(locationId, selectedDate, locationsData) {
  const selectedLocation = LOCATIONS.find((l) => l.id === locationId);
  const activeLoc = locationsData?.find((l) => l.id === locationId);

  const pdf = new jsPDF();
  let yPosition = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("VisionWaste Forecast Report", 20, yPosition);
  yPosition += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text("Location: " + (selectedLocation?.name || locationId), 20, yPosition);
  yPosition += 7;
  pdf.text("Region: " + (selectedLocation?.region || "—"), 20, yPosition);
  yPosition += 7;
  pdf.text("Selected Date: " + (selectedDate || "—"), 20, yPosition);
  yPosition += 7;
  pdf.text("Report Generated: " + new Date().toLocaleDateString(), 20, yPosition);
  yPosition += 12;

  if (activeLoc) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Forecast Summary", 20, yPosition);
    yPosition += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Predicted Waste: " + (activeLoc.predictedWasteKg != null ? activeLoc.predictedWasteKg + " KG" : "Unavailable"), 25, yPosition);
    yPosition += 6;
    pdf.text("Status: " + (activeLoc.statusLabel || activeLoc.status || "—"), 25, yPosition);
    yPosition += 6;

    if (activeLoc.baseline) {
      pdf.text("Historical Median: " + activeLoc.baseline.medianKg + " KG", 25, yPosition);
      yPosition += 6;
      pdf.text("Historical P90: " + activeLoc.baseline.p90Kg + " KG", 25, yPosition);
      yPosition += 6;
      pdf.text("Baseline Period: " + activeLoc.baseline.periodStart + " to " + activeLoc.baseline.periodEnd, 25, yPosition);
      yPosition += 6;
      pdf.text("Sample Size: " + activeLoc.baseline.sampleSize + " days", 25, yPosition);
      yPosition += 10;
    }

    if (activeLoc.composition) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Waste Category Breakdown (estimated from historical proportions)", 20, yPosition);
      yPosition += 8;
      pdf.setFont("helvetica", "normal");

      for (const [cat, data] of Object.entries(activeLoc.composition)) {
        pdf.text(cat + ": " + (data.kg || 0) + " kg (" + (data.percent || 0) + "%)", 25, yPosition);
        yPosition += 6;
      }
    }
  }

  const fileName = "waste-forecast-" + (selectedLocation?.name || locationId).replace(/\s+/g, "-") + "-" + selectedDate + ".pdf";
  pdf.save(fileName);
}

/* ─── Location Selector ──────────────────────────────────────────────── */
function LocationSelector({ activeLocation, onLocationChange, locationsData }) {
  return (
    <div className="di-location-selector">
      <div className="di-location-header">
        <MapPin size={14} style={{ color: "#67e8f9" }} />
        <h4 className="di-location-title">Monitoring Sites</h4>
      </div>
      <div className="di-location-list">
        {LOCATIONS.map((loc) => {
          const activeLoc = locationsData?.find((l) => l.id === loc.id);
          const status = activeLoc?.status || "UNAVAILABLE";
          const color = getStatusColor(status);
          const icon = getStatusIcon(status);
          const isActive = activeLocation === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => onLocationChange(loc.id)}
              className={`di-location-item ${isActive ? "active" : ""}`}
            >
              <div className="di-location-indicator" style={{ background: color }} />
              <div className="di-location-content">
                <div className="di-location-name">{loc.name}</div>
                <div className="di-location-region">
                  {activeLoc?.predictedWasteKg != null ? `${activeLoc.predictedWasteKg} KG` : loc.region}
                </div>
              </div>
              <div className="di-location-badge">{icon}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function DashboardInsights({ selectedDate, locationsData }) {
  const [activeLocation, setActiveLocation] = useState("moratuwa-mc");

  return (
    <div className="di-root">
      <div className="di-header-section">
        <div className="di-section-title">
          <Zap size={20} style={{ color: "#fbbf24" }} />
          <h2>Advanced Insights</h2>
        </div>
        <button
          className="di-download-btn"
          onClick={() => downloadReport(activeLocation, selectedDate || new Date().toISOString().slice(0, 10), locationsData)}
        >
          <FileDown size={14} />
          Download Report
        </button>
      </div>

      <div className="di-main-layout">
        {/* Location Selector Sidebar */}
        <div className="di-sidebar">
          <LocationSelector activeLocation={activeLocation} onLocationChange={setActiveLocation} locationsData={locationsData} />
        </div>

        {/* Charts Section */}
        <div className="di-charts-section">
          <div className="di-charts-grid">
            <div className="di-chart-wrapper">
              <WasteCategoryChart
                locationId={activeLocation}
                locationsData={locationsData}
              />
            </div>
            <div className="di-chart-wrapper">
              <WasteTrendChart
                selectedDate={selectedDate}
                locationId={activeLocation}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
