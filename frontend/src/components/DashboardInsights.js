import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
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
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { FileDown, TrendingUp, Zap, Calendar, MapPin } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./DashboardInsights.css";

/* ─── Location Data ────────────────────────────────────────────────────── */
const LOCATIONS = [
  { id: "colombo-fort", name: "Fort Railway Station", region: "Colombo", baseLevel: 62 },
  { id: "galle-face", name: "Galle Face ", region: "Colombo", baseLevel: 55 },
  { id: "kandy-tooth", name: "Temple of the Tooth", region: "Kandy", baseLevel: 48 },
  { id: "anuradhapura", name: "Ruwanwelisaya", region: "Anuradhapura", baseLevel: 41 },
  { id: "kataragama", name: "Kataragama Temple", region: "Kataragama", baseLevel: 38 },
  { id: "sri-pada", name: "Sri Pada", region: "Sri Pada", baseLevel: 33 },
];

/* ─── Seeded Random for deterministic data ─────────────────────────────── */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ─── Helper functions ─────────────────────────────────────────────────── */
function shiftDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isHolidayLike(dateStr) {
  const dow = new Date(dateStr).getDay();
  return dow === 0 || dow === 6; // Sunday or Saturday
}

/* ─── Weekend/Long-weekend detection for high waste ─────────────────────── */
function isWeekendOrLongWeekend(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay();
  // Check if it's Friday (5), Saturday (6), or Sunday (0)
  return dow === 0 || dow === 5 || dow === 6;
}

/* ─── Mock Data Generator: Location-specific Waste Composition ─────────── */
function generateLocationWasteComposition(locationId, selectedDate = new Date().toISOString().slice(0, 10)) {
  // Base composition
  let composition = {
    organic: 45,
    plastic: 20,
    paper: 15,
    glass: 10,
    mixed: 10,
  };

  // Location-specific variations
  if (locationId === "colombo-fort" || locationId === "galle-face") {
    // Urban commercial areas - more mixed waste
    composition = {
      organic: 30,
      plastic: 35,
      paper: 20,
      glass: 8,
      mixed: 7,
    };
  } else if (locationId === "kandy-tooth") {
    // Temple - more organic (flowers/offerings)
    composition = {
      organic: 55,
      plastic: 15,
      paper: 12,
      glass: 10,
      mixed: 8,
    };
    // Boost on Poya days
    if (isHolidayLike(selectedDate)) {
      composition.organic = Math.min(70, composition.organic + 10);
      composition.mixed -= 5;
    }
  } else if (locationId === "anuradhapura") {
    // Historical site - balanced
    composition = {
      organic: 48,
      plastic: 22,
      paper: 16,
      glass: 8,
      mixed: 6,
    };
  } else if (locationId === "kataragama") {
    // Sacred site - more organic
    composition = {
      organic: 52,
      plastic: 18,
      paper: 14,
      glass: 10,
      mixed: 6,
    };
  } else if (locationId === "sri-pada") {
    // Mountain pilgrimage site - lots of plastic bottles
    composition = {
      organic: 35,
      plastic: 45,
      paper: 10,
      glass: 5,
      mixed: 5,
    };
  }

  return [
    { name: "Organic", value: composition.organic, fill: "#10b981" },
    { name: "Plastic", value: composition.plastic, fill: "#0ea5e9" },
    { name: "Paper", value: composition.paper, fill: "#f59e0b" },
    { name: "Glass", value: composition.glass, fill: "#8b5cf6" },
    { name: "Mixed", value: composition.mixed, fill: "#ec4899" },
  ];
}

function generateTrendData(today, locationId) {
  const data = [];
  const location = LOCATIONS.find(l => l.id === locationId);
  const baseBoost = location?.baseLevel || 45; // Use location's base level
  const dateSeed = parseInt(today.replace(/-/g, "")) + locationId.length * 23;
  const rand = seededRandom(dateSeed);
  const isColomboFort = locationId === "colombo-fort";

  // Historical (past 7 days)
  for (let i = -7; i <= 0; i++) {
    const date = shiftDate(today, i);
    const noise = (rand() - 0.5) * 14;
    const holidayBoost = isHolidayLike(date) ? 15 : 0;
    // High waste on weekends/long weekends for Colombo Fort
    const weekendBoost = isColomboFort && isWeekendOrLongWeekend(date) ? 35 : 0;
    const value = Math.max(20, baseBoost + noise + holidayBoost + weekendBoost);

    data.push({
      date: getDateLabel(date),
      fullDate: date,
      historical: Math.round(value),
      predicted: null,
      isToday: i === 0,
    });
  }

  // Predicted (next 7 days)
  for (let i = 1; i <= 7; i++) {
    const date = shiftDate(today, i);
    const noise = (rand() - 0.5) * 14;
    const holidayBoost = isHolidayLike(date) ? 15 : 0;
    // High waste on weekends/long weekends for Colombo Fort
    const weekendBoost = isColomboFort && isWeekendOrLongWeekend(date) ? 35 : 0;
    const value = Math.max(20, baseBoost + noise + holidayBoost + weekendBoost);

    data.push({
      date: getDateLabel(date),
      fullDate: date,
      historical: null,
      predicted: Math.round(value),
      isToday: false,
    });
  }

  return data;
}

function generateSeasonalData() {
  return [
    {
      name: "Regular Days",
      waste: 45,
      baseline: 45,
      event: "Normal Operation",
    },
    {
      name: "Sinhala/Tamil New Year",
      waste: 78,
      baseline: 45,
      event: "Apr 13-14",
    },
    {
      name: "Poya Days",
      waste: 68,
      baseline: 45,
      event: "Monthly",
    },
    {
      name: "School Vacations",
      waste: 72,
      baseline: 45,
      event: "3 months/year",
    },
    {
      name: "Long Weekends",
      waste: 82,
      baseline: 45,
      event: "Holiday Adjacent",
    },
    {
      name: "Temple Festivals",
      waste: 92,
      baseline: 45,
      event: "Variable",
    },
  ];
}

/* ─── 1. Waste Category Distribution (Donut Chart) ──────────────────────── */
function WasteCategoryChart({ locationId, selectedDate }) {
  const categoryData = generateLocationWasteComposition(locationId, selectedDate);
  const total = categoryData.reduce((sum, cat) => sum + cat.value, 0);

  return (
    <div className="di-chart-card">
      <div className="di-chart-header">
        <div>
          <h3 className="di-chart-title">Waste Category Distribution</h3>
          <p className="di-chart-subtitle">Composition breakdown</p>
        </div>
        <div className="di-header-icon" style={{ color: "#10b981" }}>
          <TrendingUp size={18} />
        </div>
      </div>

      <div className="di-donut-container">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
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
          <div className="di-total-label">Total Waste</div>
          <div className="di-total-value">{total}%</div>
        </div>
      </div>

      <div className="di-legend">
        {categoryData.map((cat) => (
          <div key={cat.name} className="di-legend-item">
            <div className="di-legend-color" style={{ background: cat.fill }} />
            <span className="di-legend-name">{cat.name}</span>
            <span className="di-legend-value">{cat.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 2. Predictive Waste Trend (Dual-line Chart) ────────────────────────── */
function WasteTrendChart({ selectedDate, locationId }) {
  const trendData = generateTrendData(selectedDate || new Date().toISOString().slice(0, 10), locationId);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      const value = data.historical || data.predicted;
      const type = data.historical ? "Historical" : "Forecasted";
      return (
        <div className="di-tooltip">
          <p className="di-tooltip-date">{data.date}</p>
          <p className="di-tooltip-value">{type}: {value} kg</p>
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
          <p className="di-chart-subtitle">Historical vs Forecasted (7+7 days)</p>
        </div>
        <div className="di-header-icon" style={{ color: "#06b6d4" }}>
          <TrendingUp size={18} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            style={{ fontSize: "12px" }}
          />
          <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
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
            x={trendData.find((d) => d.isToday)?.date}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: "Today", position: "top", fill: "#ef4444", fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="historical"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            fill="url(#historicalGradient)"
            name="Historical"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#f59e0b"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={false}
            fill="url(#predictedGradient)"
            name="Forecasted"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── 3. Seasonal Impact Analysis (Composed Chart) ────────────────────────── */
function SeasonalImpactChart() {
  const seasonalData = generateSeasonalData();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="di-tooltip">
          <p className="di-tooltip-date">{data.event}</p>
          <p style={{ color: "#10b981" }}>Waste: {data.waste} kg</p>
          <p style={{ color: "#94a3b8" }}>Baseline: {data.baseline} kg</p>
          <p style={{ color: "#fbbf24" }}>+{Math.round(((data.waste / data.baseline - 1) * 100))}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="di-chart-card">
      <div className="di-chart-header">
        <div>
          <h3 className="di-chart-title">Seasonal Impact Analysis</h3>
          <p className="di-chart-subtitle">
            Sri Lankan events correlation with waste spikes
          </p>
        </div>
        <div className="di-header-icon" style={{ color: "#8b5cf6" }}>
          <Calendar size={18} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={seasonalData}
          margin={{ top: 20, right: 30, left: 0, bottom: 80 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            stroke="#94a3b8"
            style={{ fontSize: "11px" }}
          />
          <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            contentStyle={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid rgba(51,65,85,0.5)",
              borderRadius: "6px",
            }}
          />
          <Bar
            dataKey="waste"
            fill="url(#barGradient)"
            stroke="#06b6d4"
            strokeWidth={1}
            name="Total Waste"
          />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Average Baseline"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="di-event-legend">
        <div className="di-event-item">
          <span className="di-event-badge">📅</span>
          <span>Sinhala/Tamil New Year (Apr 13-14)</span>
        </div>
        <div className="di-event-item">
          <span className="di-event-badge">🕯️</span>
          <span>Poya Days (Monthly observances)</span>
        </div>
        <div className="di-event-item">
          <span className="di-event-badge">🎓</span>
          <span>School Vacations (3 months/year)</span>
        </div>
        <div className="di-event-item">
          <span className="di-event-badge">🏛️</span>
          <span>Temple Festivals (Variable dates)</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Download Report Function (PDF) ──────────────────────────────────── */
function downloadReport(locationId, selectedDate) {
  const selectedLocation = LOCATIONS.find(l => l.id === locationId);
  const composition = generateLocationWasteComposition(locationId, selectedDate);
  const trendData = generateTrendData(selectedDate, locationId);
  
  // Create PDF
  const pdf = new jsPDF();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let yPosition = 20;
  
  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("VisionWaste Analytics Report", 20, yPosition);
  yPosition += 10;
  
  // Location info
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(`Location: ${selectedLocation.name}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Region: ${selectedLocation.region}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Selected Date: ${selectedDate}`, 20, yPosition);
  yPosition += 12;
  
  // Waste Composition Section
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Waste Category Distribution", 20, yPosition);
  yPosition += 8;
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const totalWaste = composition.reduce((sum, cat) => sum + cat.value, 0);
  
  composition.forEach(cat => {
    const percentage = cat.value + "%";
    pdf.text(`${cat.name}: ${percentage}`, 25, yPosition);
    yPosition += 6;
  });
  
  yPosition += 4;
  
  // Trend Data Section
  if (yPosition > pageHeight - 50) {
    pdf.addPage();
    yPosition = 20;
  }
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Waste Trend (14-day forecast)", 20, yPosition);
  yPosition += 8;
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  
  trendData.forEach(item => {
    const histValue = item.historical || "N/A";
    const predValue = item.predicted || "N/A";
    const value = item.historical ? `${histValue} kg (Historical)` : `${predValue} kg (Predicted)`;
    pdf.text(`${item.date}: ${value}`, 25, yPosition);
    yPosition += 5;
    
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  });
  
  // Save PDF
  const fileName = `waste-analytics-${selectedLocation.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}

/* ─── Location Status Indicator ────────────────────────────────────────── */
function getLocationStatus(baseLevel) {
  if (baseLevel >= 80) return { status: "ALERT", color: "#ef4444", icon: "🔴" };
  if (baseLevel >= 60) return { status: "WATCH", color: "#f97316", icon: "🟠" };
  return { status: "NORMAL", color: "#22c55e", icon: "🟢" };
}

/* ─── Location Selector Component ──────────────────────────────────────── */
function LocationSelector({ activeLocation, onLocationChange }) {
  return (
    <div className="di-location-selector">
      <div className="di-location-header">
        <MapPin size={14} style={{ color: "#67e8f9" }} />
        <h4 className="di-location-title">Monitoring Sites</h4>
      </div>
      <div className="di-location-list">
        {LOCATIONS.map((loc) => {
          const statusInfo = getLocationStatus(loc.baseLevel);
          const isActive = activeLocation === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => onLocationChange(loc.id)}
              className={`di-location-item ${isActive ? "active" : ""}`}
            >
              <div className="di-location-indicator" style={{ background: statusInfo.color }} />
              <div className="di-location-content">
                <div className="di-location-name">{loc.name}</div>
                <div className="di-location-region">{loc.region}</div>
              </div>
              <div className="di-location-badge">{statusInfo.icon}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default function DashboardInsights({ selectedDate }) {
  const [activeLocation, setActiveLocation] = useState("colombo-fort");

  return (
    <div className="di-root">
      <div className="di-header-section">
        <div className="di-section-title">
          <Zap size={20} style={{ color: "#fbbf24" }} />
          <h2>Advanced Insights</h2>
        </div>
        <button 
          className="di-download-btn" 
          onClick={() => downloadReport(activeLocation, selectedDate || new Date().toISOString().slice(0, 10))}
        >
          <FileDown size={14} />
          Download Report
        </button>
      </div>

      <div className="di-main-layout">
        {/* Location Selector Sidebar */}
        <div className="di-sidebar">
          <LocationSelector activeLocation={activeLocation} onLocationChange={setActiveLocation} />
        </div>

        {/* Charts Section */}
        <div className="di-charts-section">
          <div className="di-charts-grid">
            <div className="di-chart-wrapper">
              <WasteCategoryChart locationId={activeLocation} selectedDate={selectedDate} />
            </div>
            <div className="di-chart-wrapper">
              <WasteTrendChart selectedDate={selectedDate} locationId={activeLocation} />
            </div>
            <div className="di-chart-wrapper di-full-width">
              <SeasonalImpactChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
