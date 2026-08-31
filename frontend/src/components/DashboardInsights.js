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
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { FileDown, TrendingUp, Zap, MapPin } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./DashboardInsights.css";

/* ─── Location Data ────────────────────────────────────────────────────── */
const LOCATIONS = [
  { id: "moratuwa-mc", name: "Moratuwa M.C.", region: "Moratuwa", baseLevel: 45 },
  { id: "boralesgamuwa-uc", name: "Boralesgamuwa U.C.", region: "Boralesgamuwa", baseLevel: 25 },
  { id: "kesbewa-uc", name: "Kesbewa U.C.", region: "Kesbewa", baseLevel: 50 },
  { id: "dehiwala-mtlavinia", name: "Dehiwala - Mount Lavinia M.C.", region: "Dehiwala", baseLevel: 80 },
  { id: "kotte-mc", name: "Sri Jayawardenepura Kotte M.C.", region: "Kotte", baseLevel: 20 },
  { id: "maharagama-uc", name: "Maharagama U.C.", region: "Maharagama", baseLevel: 60 },
  { id: "homagama-ps", name: "Homagama P.S.", region: "Homagama", baseLevel: 30 },
  { id: "kdu-campus", name: "Kothalawala Defence University", region: "Kdu", baseLevel: 5 }
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

function getCategoryColor(name) {
  const colors = {
    "Unburnable": "#94a3b8",
    "SOW": "#10b981",
    "Burnable": "#ef4444",
    "Bulky Waste": "#f59e0b",
    "Industrial Waste": "#8b5cf6",
    "Slaughter House Waste": "#ec4899",
    "Sanitary Waste": "#e11d48",
    "C & D": "#06b6d4"
  };
  return colors[name] || "#64748b";
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
function getCompositionForDate(locationId, dateStr, locationsData, selectedDate) {
  const isSelectedDate = dateStr === selectedDate || (selectedDate && dateStr === getDateLabel(selectedDate));
  
  if (isSelectedDate && locationsData) {
    const activeLoc = locationsData.find(l => l.id === locationId);
    if (activeLoc && activeLoc.composition) {
      return Object.entries(activeLoc.composition).map(([name, value]) => ({
        name,
        value,
        rawKg: value
      }));
    }
  }

  // Fallback to deterministic composition based on dateStr and locationId using seeded random
  const seed = String(dateStr).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + String(locationId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const categories = [
    "Unburnable", "SOW", "Burnable", "Bulky Waste", "Industrial Waste", "Slaughter House Waste", "Sanitary Waste", "C & D"
  ];

  let rawProportions = categories.map(() => 5 + rand() * 45);
  const sum = rawProportions.reduce((a, b) => a + b, 0);
  
  const totalWaste = Math.round((20 + rand() * 40) * 10) / 10;

  return categories.map((name, idx) => {
    const pct = Math.round((rawProportions[idx] / sum) * 100);
    const rawKg = Math.round(((pct / 100) * totalWaste) * 10) / 10;
    return {
      name,
      value: pct,
      rawKg
    };
  });
}

function WasteCategoryChart({ locationId, selectedDate, locationsData, hoveredDate }) {
  const displayDate = hoveredDate || selectedDate;
  const categoryData = getCompositionForDate(locationId, displayDate, locationsData, selectedDate);
  const totalRawKg = Math.round(categoryData.reduce((sum, cat) => sum + (cat.rawKg || 0), 0) * 10) / 10;

  const chartData = categoryData.map(cat => ({
    ...cat,
    fill: getCategoryColor(cat.name)
  }));

  return (
    <div className="di-chart-card">
      <div className="di-chart-header">
        <div>
          <h3 className="di-chart-title">
            Waste Category Distribution {hoveredDate ? `(${getDateLabel(hoveredDate)})` : ""}
          </h3>
          <p className="di-chart-subtitle">
            {hoveredDate ? "Hovered date composition breakdown" : "Composition breakdown"}
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
                return rawKg !== undefined ? [`${value}% (${rawKg} kg)`, name] : [`${value}%`, name];
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
          <div className="di-total-label">{hoveredDate ? "Hovered Waste" : "Total Forecasted"}</div>
          <div className="di-total-value">{totalRawKg} kg</div>
        </div>
      </div>
 
      <div className="di-legend">
        {chartData.map((cat) => (
          <div key={cat.name} className="di-legend-item">
            <div className="di-legend-color" style={{ background: cat.fill }} />
            <span className="di-legend-name">{cat.name}</span>
            <span className="di-legend-value">
              {cat.value}% {cat.rawKg !== undefined ? ` (${cat.rawKg} kg)` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 2. Predictive Waste Trend (Dual-line Chart) ────────────────────────── */
function WasteTrendChart({ selectedDate, locationId, onHover, onHoverLeave }) {
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
        <LineChart 
          data={trendData} 
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          onMouseMove={(e) => {
            if (e.activePayload && e.activePayload.length > 0) {
              onHover(e.activePayload[0].payload);
            }
          }}
          onMouseLeave={onHoverLeave}
        >
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


/* ─── Download Report Function (PDF) ──────────────────────────────────── */
function downloadReport(locationId, selectedDate, locationsData) {
  const selectedLocation = LOCATIONS.find(l => l.id === locationId);
  const activeLoc = locationsData?.find(l => l.id === locationId);
  
  let composition;
  if (activeLoc && activeLoc.composition) {
    composition = Object.entries(activeLoc.composition).map(([name, value]) => ({
      name,
      value: value + " kg"
    }));
  } else {
    composition = [
      { name: "Unburnable", value: "10 kg" },
      { name: "SOW", value: "45 kg" },
      { name: "Burnable", value: "15 kg" },
      { name: "Bulky Waste", value: "5 kg" },
      { name: "Industrial Waste", value: "10 kg" },
      { name: "Slaughter House Waste", value: "5 kg" },
      { name: "Sanitary Waste", value: "5 kg" },
      { name: "C & D", value: "5 kg" },
    ];
  }
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
  
  composition.forEach(cat => {
    pdf.text(`${cat.name}: ${cat.value}`, 25, yPosition);
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
function LocationSelector({ activeLocation, onLocationChange, locationsData }) {
  return (
    <div className="di-location-selector">
      <div className="di-location-header">
        <MapPin size={14} style={{ color: "#67e8f9" }} />
        <h4 className="di-location-title">Monitoring Sites</h4>
      </div>
      <div className="di-location-list">
        {LOCATIONS.map((loc) => {
          const activeLoc = locationsData?.find(l => l.id === loc.id);
          const status = activeLoc ? activeLoc.status : getLocationStatus(loc.baseLevel).status;
          const statusColorVal = activeLoc 
            ? (status === "ALERT" ? "#ef4444" : status === "WATCH" ? "#f97316" : "#22c55e")
            : getLocationStatus(loc.baseLevel).color;
          const statusIcon = activeLoc
            ? (status === "ALERT" ? "🔴" : status === "WATCH" ? "🟠" : "🟢")
            : getLocationStatus(loc.baseLevel).icon;
          const isActive = activeLocation === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => onLocationChange(loc.id)}
              className={`di-location-item ${isActive ? "active" : ""}`}
            >
              <div className="di-location-indicator" style={{ background: statusColorVal }} />
              <div className="di-location-content">
                <div className="di-location-name">{loc.name}</div>
                <div className="di-location-region">{loc.region}</div>
              </div>
              <div className="di-location-badge">{statusIcon}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default function DashboardInsights({ selectedDate, locationsData }) {
  const [activeLocation, setActiveLocation] = useState("moratuwa-mc");
  const [hoveredChartData, setHoveredChartData] = useState(null);

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
                selectedDate={selectedDate} 
                locationsData={locationsData} 
                hoveredDate={hoveredChartData}
              />
            </div>
            <div className="di-chart-wrapper">
              <WasteTrendChart 
                selectedDate={selectedDate} 
                locationId={activeLocation} 
                onHover={(data) => setHoveredChartData(data.fullDate)}
                onHoverLeave={() => setHoveredChartData(null)}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
