"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/react-router-compat";
import axios from "axios";
import {
  FileText,
  RefreshCw,
  Database,
  AlertTriangle,
  ChevronRight,
  Download,
  Calendar,
  Filter,
  ShieldAlert,
  PawPrint,
  Trash2,
  Thermometer,
  Droplets,
  Activity,
  TrendingUp,
  Bell,
  Image as ImageIcon,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import { useAuth } from "../context/AuthContext";
import { apiUrl, fetchBins } from "../utils/apiBase";

/*
 * /reports — Aggregated reports + CSV export.
 *
 * Pulls captures from `GET /captures?since=…&until=…&device_id=…&limit=500`
 * and (for admins) alerts from `GET /alerts?limit=200`. Everything is
 * aggregated client-side so the page works against the same endpoints
 * already exposed by the Express backend — no separate reporting API.
 *
 * Sections:
 *   1. Header + filters (date range presets, custom range, bin filter,
 *      refresh, CSV export buttons).
 *   2. KPI chips (captures, HIGH+ events, animal sightings, overflow
 *      events, avg temp, avg humidity).
 *   3. Charts (recharts): daily captures stacked by risk level, risk
 *      distribution donut, fill tier distribution bar.
 *   4. Top bins table (most active by HIGH+ events / animals).
 *   5. Recent capture log table (scoped by current filters).
 */

const RISK_COLORS = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#b91c1c",
  UNKNOWN: "#94a3b8",
};

const FILL_COLORS = {
  EMPTY: "#22c55e",
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  OVERFLOW: "#b91c1c",
  UNKNOWN: "#94a3b8",
};

const RANGE_PRESETS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "14d", label: "Last 14 days", days: 14 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "custom", label: "Custom", days: null },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateInputValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows, headers) {
  const head = headers.map((h) => csvEscape(h.label)).join(",");
  const body = rows
    .map((r) =>
      headers
        .map((h) => csvEscape(typeof h.get === "function" ? h.get(r) : r[h.key]))
        .join(",")
    )
    .join("\n");
  return `${head}\n${body}`;
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fillTierFor(c) {
  const lvl = String(c.fill_level || "").toUpperCase();
  if (lvl === "OVERFLOW" || lvl === "OVERFLOWING") return "OVERFLOW";
  if (lvl === "HIGH" || lvl === "FULL") return "HIGH";
  if (lvl === "MEDIUM" || lvl === "HALF") return "MEDIUM";
  if (lvl === "LOW" || lvl === "EMPTY") return lvl === "EMPTY" ? "EMPTY" : "LOW";
  const pct = Number(c.fill_percentage);
  if (Number.isFinite(pct)) {
    if (pct >= 85) return "OVERFLOW";
    if (pct >= 60) return "HIGH";
    if (pct >= 30) return "MEDIUM";
    return "LOW";
  }
  return "UNKNOWN";
}

function riskLevelFor(c) {
  const r = String(c.risk_level || "").toUpperCase();
  if (r === "LOW" || r === "MEDIUM" || r === "HIGH" || r === "CRITICAL") return r;
  return "UNKNOWN";
}

function isOverflowCapture(c) {
  const tier = fillTierFor(c);
  return tier === "OVERFLOW";
}

export default function ReportsPage() {
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === "admin";

  const [presetId, setPresetId] = useState("30d");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [customStart, setCustomStart] = useState(
    toDateInputValue(new Date(Date.now() - 30 * DAY_MS))
  );
  const [customEnd, setCustomEnd] = useState(toDateInputValue(today));

  const [binFilter, setBinFilter] = useState("all");
  const [bins, setBins] = useState([]);

  const [captures, setCaptures] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBins()
      .then(({ bins }) => {
        if (!cancelled) setBins(bins || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const range = useMemo(() => {
    if (presetId === "custom") {
      const s = customStart ? startOfDay(new Date(customStart)) : null;
      const e = customEnd ? endOfDay(new Date(customEnd)) : null;
      return { since: s, until: e };
    }
    const preset = RANGE_PRESETS.find((p) => p.id === presetId) || RANGE_PRESETS[2];
    const since = startOfDay(new Date(Date.now() - preset.days * DAY_MS));
    const until = endOfDay(new Date());
    return { since, until };
  }, [presetId, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    const s = range.since ? toDateInputValue(range.since) : "—";
    const e = range.until ? toDateInputValue(range.until) : "—";
    return `${s} → ${e}`;
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbDisabled(false);
    try {
      const params = {
        limit: 500,
      };
      if (range.since) params.since = range.since.toISOString();
      if (range.until) params.until = range.until.toISOString();
      if (binFilter !== "all") params.device_id = binFilter;

      const { data } = await axios.get(apiUrl("/captures"), {
        params,
        timeout: 20_000,
      });
      const list = Array.isArray(data?.captures) ? data.captures : [];
      list.sort(
        (a, b) =>
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      );
      setCaptures(list);

      if (isAdmin) {
        try {
          const res = await authFetch("/alerts?limit=200", { method: "GET" });
          if (res.ok) {
            const body = await res.json().catch(() => ({}));
            const items = Array.isArray(body.alerts) ? body.alerts : [];
            const since = range.since ? range.since.getTime() : 0;
            const until = range.until ? range.until.getTime() : Infinity;
            const scoped = items.filter((a) => {
              const t = new Date(a.created_at).getTime();
              if (!Number.isFinite(t)) return false;
              if (t < since || t > until) return false;
              if (binFilter !== "all") {
                return String(a.device_id) === String(binFilter);
              }
              return true;
            });
            setAlerts(scoped);
          } else if (res.status === 503) {
            setAlerts([]);
          }
        } catch {
          setAlerts([]);
        }
      } else {
        setAlerts([]);
      }
    } catch (e) {
      if (e?.response?.status === 503) {
        setDbDisabled(true);
        setCaptures([]);
        setAlerts([]);
      } else {
        setError(e?.message || "Failed to load reports data.");
        setCaptures([]);
      }
    } finally {
      setLoading(false);
    }
  }, [range, binFilter, isAdmin, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const binsById = useMemo(() => {
    const m = new Map();
    for (const b of bins) m.set(String(b.id), b);
    return m;
  }, [bins]);

  const stats = useMemo(() => {
    let highPlus = 0;
    let animals = 0;
    let overflow = 0;
    let tempSum = 0;
    let tempN = 0;
    let humSum = 0;
    let humN = 0;
    const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, UNKNOWN: 0 };
    const fillDist = {
      EMPTY: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      OVERFLOW: 0,
      UNKNOWN: 0,
    };

    for (const c of captures) {
      const r = riskLevelFor(c);
      riskDist[r] = (riskDist[r] || 0) + 1;
      if (r === "HIGH" || r === "CRITICAL") highPlus += 1;
      const a = Number(c.animal_count) || 0;
      if (a > 0) animals += a;
      if (isOverflowCapture(c)) overflow += 1;
      const tier = fillTierFor(c);
      fillDist[tier] = (fillDist[tier] || 0) + 1;
      const t = Number(c.temp_c);
      if (Number.isFinite(t)) {
        tempSum += t;
        tempN += 1;
      }
      const h = Number(c.humidity_pct);
      if (Number.isFinite(h)) {
        humSum += h;
        humN += 1;
      }
    }

    return {
      total: captures.length,
      highPlus,
      animals,
      overflow,
      avgTemp: tempN ? tempSum / tempN : null,
      avgHum: humN ? humSum / humN : null,
      riskDist,
      fillDist,
    };
  }, [captures]);

  const daily = useMemo(() => {
    const byDay = new Map();
    for (const c of captures) {
      const d = startOfDay(new Date(c.captured_at));
      const key = toDateInputValue(d);
      if (!byDay.has(key)) {
        byDay.set(key, {
          date: key,
          LOW: 0,
          MEDIUM: 0,
          HIGH: 0,
          CRITICAL: 0,
          UNKNOWN: 0,
        });
      }
      const row = byDay.get(key);
      row[riskLevelFor(c)] += 1;
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
  }, [captures]);

  const topBins = useMemo(() => {
    const byBin = new Map();
    for (const c of captures) {
      const id = c.device_id ?? "unbound";
      if (!byBin.has(id)) {
        byBin.set(id, {
          deviceId: id,
          total: 0,
          highPlus: 0,
          animals: 0,
          overflow: 0,
          lastAt: null,
        });
      }
      const row = byBin.get(id);
      row.total += 1;
      const r = riskLevelFor(c);
      if (r === "HIGH" || r === "CRITICAL") row.highPlus += 1;
      row.animals += Number(c.animal_count) || 0;
      if (isOverflowCapture(c)) row.overflow += 1;
      const t = new Date(c.captured_at).getTime();
      if (!row.lastAt || t > row.lastAt) row.lastAt = t;
    }
    return Array.from(byBin.values()).sort((a, b) => {
      if (b.highPlus !== a.highPlus) return b.highPlus - a.highPlus;
      if (b.overflow !== a.overflow) return b.overflow - a.overflow;
      return b.total - a.total;
    });
  }, [captures]);

  const riskPie = useMemo(
    () =>
      ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]
        .map((k) => ({ name: k, value: stats.riskDist[k] || 0 }))
        .filter((d) => d.value > 0),
    [stats]
  );

  const fillBar = useMemo(
    () =>
      ["EMPTY", "LOW", "MEDIUM", "HIGH", "OVERFLOW", "UNKNOWN"]
        .map((k) => ({ name: k, value: stats.fillDist[k] || 0 }))
        .filter((d) => d.value > 0),
    [stats]
  );

  const exportCapturesCsv = () => {
    if (!captures.length) return;
    const headers = [
      { key: "id", label: "id" },
      { key: "captured_at", label: "captured_at" },
      {
        label: "bin_name",
        get: (r) => binsById.get(String(r.device_id))?.name || "",
      },
      { key: "device_id", label: "device_id" },
      { key: "esp32_id", label: "esp32_id" },
      { key: "risk_level", label: "risk_level" },
      { key: "risk_case", label: "risk_case" },
      { key: "waste_label", label: "waste_label" },
      { key: "waste_confidence", label: "waste_confidence" },
      { key: "animal_count", label: "animal_count" },
      { key: "fill_level", label: "fill_level" },
      { key: "fill_percentage", label: "fill_percentage" },
      { key: "temp_c", label: "temp_c" },
      { key: "humidity_pct", label: "humidity_pct" },
      { key: "weather_condition", label: "weather_condition" },
      { key: "rotting_hours", label: "rotting_hours" },
      { key: "source_type", label: "source_type" },
    ];
    const csv = rowsToCsv(captures, headers);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadCsv(`captures-${stamp}.csv`, csv);
  };

  const exportAlertsCsv = () => {
    if (!alerts.length) return;
    const headers = [
      { key: "id", label: "id" },
      { key: "created_at", label: "created_at" },
      { key: "alert_type", label: "alert_type" },
      { key: "severity", label: "severity" },
      { key: "status", label: "status" },
      { key: "title", label: "title" },
      { key: "summary", label: "summary" },
      { key: "device_id", label: "device_id" },
      {
        label: "bin_name",
        get: (r) => r.device?.name || binsById.get(String(r.device_id))?.name || "",
      },
      { key: "capture_id", label: "capture_id" },
      { key: "admin_note", label: "admin_note" },
    ];
    const csv = rowsToCsv(alerts, headers);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadCsv(`alerts-${stamp}.csv`, csv);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              Reports
            </h1>
            <p className="mt-0.5 max-w-3xl text-sm text-ink-500">
              Aggregated view of every capture and alert in the selected
              window. Use the filters below to scope the report by date range
              and bin, then export to CSV for council records or post-shift
              audits.
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Range: <span className="font-mono">{rangeLabel}</span>
              {binFilter !== "all" ? (
                <>
                  {" · "}
                  Bin{" "}
                  <span className="font-semibold text-ink-700">
                    {binsById.get(String(binFilter))?.name || `#${binFilter}`}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={exportCapturesCsv}
              disabled={!captures.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export captures
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={exportAlertsCsv}
                disabled={!alerts.length}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export alerts
              </button>
            ) : null}
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Dashboard
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {dbDisabled ? (
          <Banner
            icon={Database}
            title="Database not configured"
            body="Reports need the captures table. Set DATABASE_URL on the backend and run with DB_SYNC=true (or DB_SYNC_ALTER=true) once so the schema is created."
          />
        ) : null}

        {error ? (
          <Banner
            icon={AlertTriangle}
            title="Request error"
            body={error}
            tone="red"
          />
        ) : null}

        <Card>
          <Card.Header icon={Filter} title="Filters" />
          <Card.Body className="!mt-2 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Date range
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      presetId === p.id
                        ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-ink-600 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {presetId === "custom" ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      From
                    </span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      To
                    </span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  Bin
                </span>
                <select
                  value={binFilter}
                  onChange={(e) => setBinFilter(e.target.value)}
                  className="mt-1 min-w-[14rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">All bins</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || `Bin #${b.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-ink-600">
                <Calendar className="h-3.5 w-3.5" />
                <span>{captures.length} captures in window</span>
              </div>
            </div>
          </Card.Body>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            icon={FileText}
            label="Captures"
            value={stats.total}
            tone="slate"
          />
          <Kpi
            icon={ShieldAlert}
            label="HIGH+ events"
            value={stats.highPlus}
            tone="red"
          />
          <Kpi
            icon={PawPrint}
            label="Animal sightings"
            value={stats.animals}
            tone="amber"
          />
          <Kpi
            icon={Trash2}
            label="Overflow events"
            value={stats.overflow}
            tone="red"
          />
          <Kpi
            icon={Thermometer}
            label="Avg temp"
            value={stats.avgTemp != null ? `${stats.avgTemp.toFixed(1)}°C` : "—"}
            tone="brand"
          />
          <Kpi
            icon={Droplets}
            label="Avg humidity"
            value={stats.avgHum != null ? `${Math.round(stats.avgHum)}%` : "—"}
            tone="brand"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <Card.Header
              icon={Activity}
              title="Daily captures by risk level"
              right={
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Stacked
                </span>
              }
            />
            <Card.Body className="!mt-2">
              {daily.length === 0 ? (
                <EmptyChart text="No captures in this window." />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(d) => d?.slice(5) || d}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="LOW"
                        stackId="r"
                        fill={RISK_COLORS.LOW}
                        name="LOW"
                      />
                      <Bar
                        dataKey="MEDIUM"
                        stackId="r"
                        fill={RISK_COLORS.MEDIUM}
                        name="MEDIUM"
                      />
                      <Bar
                        dataKey="HIGH"
                        stackId="r"
                        fill={RISK_COLORS.HIGH}
                        name="HIGH"
                      />
                      <Bar
                        dataKey="CRITICAL"
                        stackId="r"
                        fill={RISK_COLORS.CRITICAL}
                        name="CRITICAL"
                      />
                      <Bar
                        dataKey="UNKNOWN"
                        stackId="r"
                        fill={RISK_COLORS.UNKNOWN}
                        name="UNKNOWN"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header icon={TrendingUp} title="Risk distribution" />
            <Card.Body className="!mt-2">
              {riskPie.length === 0 ? (
                <EmptyChart text="No captures." />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={riskPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {riskPie.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={RISK_COLORS[entry.name] || "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Header icon={Trash2} title="Fill tier distribution" />
          <Card.Body className="!mt-2">
            {fillBar.length === 0 ? (
              <EmptyChart text="No fill data in this window." />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <BarChart data={fillBar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Bar dataKey="value" name="Captures">
                      {fillBar.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={FILL_COLORS[entry.name] || "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            icon={ShieldAlert}
            title="Top bins by activity"
            right={
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Ranked by HIGH+ events
              </span>
            }
          />
          <Card.Body className="!mt-2 overflow-x-auto">
            {topBins.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">
                No bin activity in this window.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-2 py-2">Bin</th>
                    <th className="px-2 py-2 text-right">Captures</th>
                    <th className="px-2 py-2 text-right">HIGH+</th>
                    <th className="px-2 py-2 text-right">Animals</th>
                    <th className="px-2 py-2 text-right">Overflow</th>
                    <th className="px-2 py-2">Last capture</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {topBins.map((row) => {
                    const bin = binsById.get(String(row.deviceId));
                    const name =
                      bin?.name ||
                      (row.deviceId === "unbound"
                        ? "Unbound device"
                        : `Bin #${row.deviceId}`);
                    return (
                      <tr
                        key={row.deviceId}
                        className="border-t border-slate-100 align-middle"
                      >
                        <td className="px-2 py-2 font-semibold text-ink-800">
                          {name}
                          {bin?.esp32_id ? (
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
                              {bin.esp32_id}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-ink-700">
                          {row.total}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              row.highPlus > 0
                                ? "bg-red-50 text-red-700"
                                : "text-ink-400"
                            }`}
                          >
                            {row.highPlus}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              row.animals > 0
                                ? "bg-amber-50 text-amber-700"
                                : "text-ink-400"
                            }`}
                          >
                            {row.animals}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              row.overflow > 0
                                ? "bg-red-50 text-red-700"
                                : "text-ink-400"
                            }`}
                          >
                            {row.overflow}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-ink-500">
                          {row.lastAt
                            ? formatTs(new Date(row.lastAt).toISOString())
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {row.deviceId !== "unbound" ? (
                            <Link
                              to={`/bins/${row.deviceId}`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                            >
                              Open
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            icon={FileText}
            title="Capture log"
            right={
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {captures.length} rows · scoped by filters
              </span>
            }
          />
          <Card.Body className="!mt-2 overflow-x-auto">
            {captures.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">
                No captures match the current filters.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-2 py-2">When</th>
                    <th className="px-2 py-2">Bin</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Waste</th>
                    <th className="px-2 py-2 text-right">Animals</th>
                    <th className="px-2 py-2">Fill</th>
                    <th className="px-2 py-2 text-right">Temp</th>
                    <th className="px-2 py-2 text-right">Humidity</th>
                    <th className="px-2 py-2">Image</th>
                  </tr>
                </thead>
                <tbody>
                  {captures.slice(0, 100).map((c) => {
                    const bin = binsById.get(String(c.device_id));
                    const r = riskLevelFor(c);
                    const tier = fillTierFor(c);
                    return (
                      <tr
                        key={c.id}
                        className="border-t border-slate-100 align-middle"
                      >
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-600">
                          {formatTs(c.captured_at)}
                        </td>
                        <td className="px-2 py-2 text-ink-800">
                          {bin?.name || `Bin #${c.device_id ?? "—"}`}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${RISK_COLORS[r]}1f`,
                              color: RISK_COLORS[r],
                            }}
                          >
                            {r}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-ink-700">
                          {c.waste_label || "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-ink-700">
                          {c.animal_count ?? 0}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${FILL_COLORS[tier]}1f`,
                              color: FILL_COLORS[tier],
                            }}
                          >
                            {tier}
                            {Number.isFinite(Number(c.fill_percentage))
                              ? ` · ${Math.round(Number(c.fill_percentage))}%`
                              : ""}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-ink-700">
                          {Number.isFinite(Number(c.temp_c))
                            ? `${Number(c.temp_c).toFixed(1)}°C`
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-ink-700">
                          {Number.isFinite(Number(c.humidity_pct))
                            ? `${Math.round(Number(c.humidity_pct))}%`
                            : "—"}
                        </td>
                        <td className="px-2 py-2">
                          {c.has_image ? (
                            <a
                              href={apiUrl(`/captures/${c.id}/image`)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-600"
                            >
                              <ImageIcon className="h-3 w-3" />
                              View
                            </a>
                          ) : (
                            <span className="text-[11px] text-ink-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {captures.length > 100 ? (
              <p className="mt-2 text-xs text-ink-400">
                Showing 100 of {captures.length} rows · export CSV to see the
                full window.
              </p>
            ) : null}
          </Card.Body>
        </Card>

        {isAdmin ? (
          <Card>
            <Card.Header
              icon={Bell}
              title="Alerts summary in window"
              right={
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {alerts.length} alerts
                </span>
              }
            />
            <Card.Body className="!mt-2">
              {alerts.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">
                  No alerts in this window. (Alerts are generated automatically
                  when high-risk captures arrive.)
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    "open",
                    "acknowledged",
                    "actioned",
                    "rejected",
                    "dismissed",
                  ].map((st) => {
                    const n = alerts.filter((a) => a.status === st).length;
                    return (
                      <div
                        key={st}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          {st}
                        </div>
                        <div className="text-xl font-bold tabular-nums text-ink-800">
                          {n}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/alerts"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                >
                  Open Alerts page
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card.Body>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: "border-slate-200 bg-white text-ink-700",
    brand: "border-brand-200 bg-brand-50 text-brand-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
        tones[tone] || tones.slate
      }`}
    >
      <div className="rounded-lg bg-white/70 p-2">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </div>
        <div className="truncate text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function Banner({ icon: Icon, title, body, tone = "amber" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-ink-400">
      {text}
    </div>
  );
}
