"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/react-router-compat";
import {
  ShieldAlert,
  TrendingUp,
  RefreshCw,
  Database,
  AlertCircle,
  Search,
  Activity,
  Clock,
  CalendarClock,
  Thermometer,
  Droplets,
  Info,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import useSystemSnapshot from "../hooks/useSystemSnapshot";
import useCaptureHistory from "../hooks/useCaptureHistory";
import { fetchBins, fetchForecast } from "../utils/apiBase";
import computeRiskScore, { RISK_TONE } from "../utils/riskScore";

/*
 * /hygienic-risk — redesigned.
 *
 * Scope is intentionally narrowed compared to the legacy page. Things that
 * the new system dashboard already covers (per-capture cards, file upload,
 * YOLO annotated images, latest weather strip) are removed; this page now
 * focuses on the FORECAST + HISTORY + RULE-ENGINE EXPLAINABILITY value
 * that no other page provides.
 *
 * Sections:
 *   1. Current risk hero (uses /latest via useSystemSnapshot)
 *   2. 24h risk forecast (recharts area chart, /forecast)
 *   3. Hourly slot strip (compact summary of every forecast slot)
 *   4. Rules & thresholds explainer (the risk engine constants)
 *   5. Risk history table (search + filter, /captures via useCaptureHistory)
 *
 * The page renders inside DashboardLayout so it inherits the sidebar +
 * topbar chrome (no more LegacyShell NavBar). The only manual interaction
 * left is the Bin selector, which scopes the forecast to a specific bin's
 * coordinates if available.
 */

const SLOT_COLOR = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#b91c1c",
};

const RISK_BADGE = {
  LOW: "bg-brand-50 text-brand-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
  CRITICAL: "bg-red-100 text-red-800",
};

function levelToScore(level) {
  switch (String(level || "").toUpperCase()) {
    case "LOW":
      return 25;
    case "MEDIUM":
      return 55;
    case "HIGH":
      return 80;
    case "CRITICAL":
      return 95;
    default:
      return 0;
  }
}

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeFromNow(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HygienicRiskDashboardPage() {
  const { data: snapshot, loading: snapLoading } = useSystemSnapshot();
  const { captures, loading: histLoading, error: histError, dbDisabled, refresh: refreshHistory } =
    useCaptureHistory();

  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState("");
  const [forecast, setForecast] = useState(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  // Bin list (used purely to scope the forecast).
  useEffect(() => {
    fetchBins()
      .then((d) => setBins(Array.isArray(d?.bins) ? d.bins : []))
      .catch(() => setBins([]));
  }, []);

  const loadForecast = async () => {
    setForecastBusy(true);
    setForecastError(null);
    try {
      const f = await fetchForecast(binId || null, 24);
      setForecast(f);
    } catch (e) {
      setForecastError(e?.message || "Could not load forecast.");
      setForecast(null);
    } finally {
      setForecastBusy(false);
    }
  };

  useEffect(() => {
    loadForecast();
    // re-run when bin scope changes (loadForecast intentionally omitted from deps)
  }, [binId]);

  // ---- Current risk hero data ----
  const liveExtras = snapshot?.extras || null;
  const liveRiskBundle = useMemo(() => computeRiskScore(liveExtras), [liveExtras]);
  const liveLevel = liveExtras?.risk_level || null;
  const liveTone = liveRiskBundle ? RISK_TONE[liveRiskBundle.tone] : null;

  // ---- Forecast chart data ----
  const slots = forecast?.forecast?.slots || [];
  const chartData = useMemo(
    () =>
      slots.map((s) => {
        const d = new Date(s.ts_unix ? s.ts_unix * 1000 : s.ts);
        return {
          time: d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          rawTs: d.getTime(),
          level: s.level,
          score: levelToScore(s.level),
          temp: Number(s.temp_c),
          hum: Number(s.humidity_pct),
        };
      }),
    [slots]
  );

  const forecastSummary = forecast?.forecast?.summary || null;
  const usingStub =
    slots[0]?.source === "stub" || slots[0]?.source === "stub-fallback";

  // ---- History filter state ----
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return captures.filter((c) => {
      if (filterLevel !== "ALL" && c.risk_level !== filterLevel) return false;
      if (!q) return true;
      return (
        String(c.waste_label || "")
          .toLowerCase()
          .includes(q) ||
        String(c.risk_case || "")
          .toLowerCase()
          .includes(q) ||
        String(c.device_id || "").includes(q)
      );
    });
  }, [captures, search, filterLevel]);

  // ---- Rule thresholds (pulled from forecast assumptions when available) ----
  const thresholds = useMemo(() => {
    const assumptions = forecast?.forecast?.assumptions || [];
    const tempLine = assumptions.find((a) =>
      String(a).toUpperCase().includes("HIGH_TEMP_C")
    );
    const humLine = assumptions.find((a) =>
      String(a).toUpperCase().includes("HIGH_HUMIDITY_PCT")
    );
    const tempMatch = tempLine && tempLine.match(/(\d+(\.\d+)?)/);
    const humMatch = humLine && humLine.match(/(\d+(\.\d+)?)/);
    return {
      HIGH_TEMP_C: tempMatch ? Number(tempMatch[1]) : 30,
      HIGH_HUMIDITY_PCT: humMatch ? Number(humMatch[1]) : 70,
      source: tempLine || humLine ? "live" : "default",
    };
  }, [forecast]);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <PageHeader
          binId={binId}
          bins={bins}
          onBinChange={setBinId}
          onRefresh={() => {
            loadForecast();
            refreshHistory();
          }}
          forecastBusy={forecastBusy}
        />

        {dbDisabled ? (
          <Banner
            tone="amber"
            icon={Database}
            title="Database is not configured"
            body={
              <>
                Set <code className="rounded bg-amber-100 px-1">DATABASE_URL</code>{" "}
                on the backend to enable capture history and per-bin forecasts.
                The forecast chart still works — it derives risk straight from
                live weather.
              </>
            }
          />
        ) : null}

        {forecastError ? (
          <Banner
            tone="red"
            icon={AlertCircle}
            title="Forecast unavailable"
            body={forecastError}
          />
        ) : null}

        {/* Row 1: current risk + forecast trend */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <CurrentRiskCard
            loading={snapLoading}
            bundle={liveRiskBundle}
            level={liveLevel}
            extras={liveExtras}
            tone={liveTone}
            timestamp={snapshot?.timestamp || null}
          />

          <div className="lg:col-span-2">
            <ForecastTrendCard
              busy={forecastBusy}
              data={chartData}
              hours={forecast?.hours_ahead || 24}
              summary={forecastSummary}
              usingStub={usingStub}
              thresholds={thresholds}
            />
          </div>
        </section>

        {/* Row 2: hourly slots */}
        <ForecastSlotsCard data={chartData} loading={forecastBusy} />

        {/* Row 3: rules & thresholds explainer */}
        <RulesExplainerCard thresholds={thresholds} />

        {/* Row 4: risk history */}
        <RiskHistoryCard
          loading={histLoading}
          error={histError}
          dbDisabled={dbDisabled}
          captures={filteredHistory}
          totalCount={captures.length}
          search={search}
          onSearch={setSearch}
          filterLevel={filterLevel}
          onFilterLevel={setFilterLevel}
        />
      </div>
    </DashboardLayout>
  );
}

/* ============================ Page header ============================ */

function PageHeader({ binId, bins, onBinChange, onRefresh, forecastBusy }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
          Risk Dashboard
        </h1>
        <p className="text-sm text-ink-500 mt-0.5 max-w-2xl">
          Hygienic risk forecast, capture history, and rule-based explanations.
          For per-capture details and image analysis, use{" "}
          <Link
            to="/bin-level-detector"
            className="font-semibold text-brand-700 hover:text-brand-600"
          >
            Bin Level Detector
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
            Bin
          </span>
          <select
            value={binId}
            onChange={(e) => onBinChange(e.target.value)}
            className="bg-transparent text-sm font-medium text-ink-900 focus:outline-none"
          >
            <option value="">Default location</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>
                #{b.id} · {b.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onRefresh}
          disabled={forecastBusy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${forecastBusy ? "animate-spin" : ""}`}
          />
          {forecastBusy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}

/* ============================ Banner ============================ */

function Banner({ tone, icon: Icon, title, body }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    brand: "border-brand-200 bg-brand-50 text-brand-700",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5">{body}</div>
      </div>
    </div>
  );
}

/* ============================ Current risk hero ============================ */

function CurrentRiskCard({ loading, bundle, level, extras, tone, timestamp }) {
  const empty = !bundle && !loading;
  const score = bundle?.score ?? 0;
  const message =
    extras?.risk_message ||
    (level === "LOW" && "All conditions normal — no immediate hygiene risk.") ||
    (level === "MEDIUM" && "Watchlist conditions detected — monitor closely.") ||
    (level === "HIGH" && "Hygiene risk elevated — schedule collection soon.") ||
    "—";

  return (
    <Card>
      <Card.Header
        icon={ShieldAlert}
        title="Current risk"
        accent={
          level === "HIGH" || level === "CRITICAL"
            ? "text-red-500"
            : level === "MEDIUM"
              ? "text-amber-500"
              : "text-brand-500"
        }
        right={
          <span className="text-[11px] text-ink-400">
            {timestamp ? relativeFromNow(timestamp) : "—"}
          </span>
        }
      />

      <Card.Body>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading latest…
          </div>
        ) : empty ? (
          <div className="flex flex-col items-start gap-2 text-sm text-ink-500">
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
              No captures yet
            </div>
            <p>
              Once a bin sends its first capture, the live risk level will
              appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold tracking-wider ${
                  RISK_BADGE[level] || "bg-slate-100 text-ink-700"
                }`}
              >
                {level}
              </span>
              <div className="text-3xl font-bold text-ink-900 tabular-nums">
                {score}
                <span className="text-sm font-medium text-ink-400">/100</span>
              </div>
            </div>

            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${tone?.barBg || "bg-brand-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-ink-600 leading-relaxed">
              {message}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-ink-500">
              <Stat label="Temp" value={extras?.temp_c != null ? `${extras.temp_c}°C` : "—"} />
              <Stat label="Humidity" value={extras?.humidity_pct != null ? `${Math.round(extras.humidity_pct)}%` : "—"} />
              <Stat label="Animals" value={extras?.animal_count ?? "—"} />
              <Stat label="Rotting" value={extras?.rotting_hours != null ? `${extras.rotting_hours} h` : "—"} />
            </div>
          </>
        )}
      </Card.Body>

      <Card.Footer>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-600 font-semibold"
        >
          See full snapshot on dashboard
          <ChevronRight className="h-3 w-3" />
        </Link>
      </Card.Footer>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="text-xs font-semibold text-ink-900">{value}</div>
    </div>
  );
}

/* ============================ Forecast trend chart ============================ */

function ForecastChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card text-xs">
      <div className="font-semibold text-ink-900">{p.time}</div>
      <div className="text-[11px] text-ink-500 mt-0.5">
        Predicted level:{" "}
        <span
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
            RISK_BADGE[p.level] || "bg-slate-100 text-ink-700"
          }`}
        >
          {p.level || "—"}
        </span>
      </div>
      <div className="text-[11px] text-ink-500">
        Score: <span className="font-semibold text-ink-900">{p.score}</span>
      </div>
      <div className="text-[11px] text-ink-500">
        {Math.round(p.temp)}°C · {Math.round(p.hum)}%
      </div>
    </div>
  );
}

function ForecastTrendCard({ busy, data, hours, summary, usingStub, thresholds }) {
  const empty = !busy && data.length === 0;

  return (
    <Card>
      <Card.Header
        icon={TrendingUp}
        title={`Risk forecast — next ${hours} hours`}
        right={
          usingStub ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 rounded-md px-1.5 py-0.5">
              Stub feed
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded-md px-1.5 py-0.5">
              Live
            </span>
          )
        }
      />

      <Card.Body className="min-h-[260px]">
        {busy && data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center gap-2 text-xs text-ink-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading forecast…
          </div>
        ) : empty ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-ink-500">
            No forecast data available.
          </div>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<ForecastChartTooltip />} cursor={{ stroke: "#cbd5e1" }} />
                <ReferenceLine
                  y={40}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: "MEDIUM", fontSize: 9, fill: "#92400e", position: "right" }}
                />
                <ReferenceLine
                  y={70}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: "HIGH", fontSize: 9, fill: "#991b1b", position: "right" }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#forecastFill)"
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>

      {summary?.recommendation || thresholds ? (
        <Card.Footer>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {summary?.recommendation ? (
              <div className="flex items-start gap-2 max-w-[60%]">
                <Info className="h-3.5 w-3.5 mt-0.5 text-ink-400 shrink-0" />
                <span className="text-ink-600">{summary.recommendation}</span>
              </div>
            ) : (
              <span className="text-ink-400">No recommendation yet.</span>
            )}
            {thresholds ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-ink-400">Thresholds:</span>
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                  ≥ {thresholds.HIGH_TEMP_C}°C
                </span>
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                  ≥ {thresholds.HIGH_HUMIDITY_PCT}% RH
                </span>
              </div>
            ) : null}
          </div>
        </Card.Footer>
      ) : null}
    </Card>
  );
}

/* ============================ Hourly slots strip ============================ */

function ForecastSlotsCard({ data, loading }) {
  if (loading && data.length === 0) {
    return (
      <Card>
        <Card.Header icon={Clock} title="Hourly forecast" />
        <Card.Body>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        </Card.Body>
      </Card>
    );
  }
  if (data.length === 0) return null;

  return (
    <Card>
      <Card.Header icon={Clock} title="Hourly forecast" right={
        <span className="text-[11px] text-ink-400">{data.length} slots</span>
      } />
      <Card.Body>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="flex gap-2 min-w-max">
            {data.map((s, i) => {
              const color = SLOT_COLOR[s.level] || "#94a3b8";
              return (
                <div
                  key={`${s.rawTs}-${i}`}
                  className="w-[88px] shrink-0 rounded-lg border bg-white p-2 text-center"
                  style={{ borderColor: `${color}55`, boxShadow: `inset 3px 0 0 ${color}` }}
                  title={`${s.level} · ${Math.round(s.temp)}°C · ${Math.round(s.hum)}% RH`}
                >
                  <div className="text-[10px] font-semibold text-ink-500">
                    {s.time}
                  </div>
                  <div
                    className="mt-1 text-[11px] font-bold tracking-wider"
                    style={{ color }}
                  >
                    {s.level}
                  </div>
                  <div className="mt-1 text-[10px] text-ink-500">
                    {Math.round(s.temp)}°C
                  </div>
                  <div className="text-[10px] text-ink-400">
                    {Math.round(s.hum)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

/* ============================ Rules explainer ============================ */

function RulesExplainerCard({ thresholds }) {
  const rules = [
    {
      level: "LOW",
      tone: "bg-brand-50 text-brand-700 border-brand-200",
      desc: "Below medium thresholds. No animals, no organic spike, mild weather.",
    },
    {
      level: "MEDIUM",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      desc: `Hot (≥ ${thresholds.HIGH_TEMP_C}°C) OR humid (≥ ${thresholds.HIGH_HUMIDITY_PCT}% RH) — accelerated rotting.`,
    },
    {
      level: "HIGH",
      tone: "bg-red-50 text-red-700 border-red-200",
      desc: "Animals detected, organic waste in heat, or compounding hot + humid conditions.",
    },
    {
      level: "CRITICAL",
      tone: "bg-red-100 text-red-800 border-red-300",
      desc: "Reserved for mixed-waste / multiple compounding factors. Engine does not emit yet.",
    },
  ];

  return (
    <Card>
      <Card.Header
        icon={Info}
        title="Rules & thresholds"
        accent="text-ink-500"
        right={
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Risk engine
          </span>
        }
      />
      <Card.Body>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rules.map((r) => (
            <div
              key={r.level}
              className={`rounded-lg border p-3 ${r.tone}`}
            >
              <div className="text-xs font-bold tracking-wider">
                {r.level}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed">
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </Card.Body>

      <Card.Footer>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Thermometer className="h-3 w-3 text-amber-500" />
            <span className="text-ink-500">HIGH_TEMP_C</span>
            <code className="rounded bg-slate-100 px-1 font-semibold text-ink-900">
              {thresholds.HIGH_TEMP_C}
            </code>
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3 w-3 text-sky-500" />
            <span className="text-ink-500">HIGH_HUMIDITY_PCT</span>
            <code className="rounded bg-slate-100 px-1 font-semibold text-ink-900">
              {thresholds.HIGH_HUMIDITY_PCT}
            </code>
          </span>
          <span className="text-ink-400">
            {thresholds.source === "live"
              ? "(from current /forecast assumptions)"
              : "(default values; configure on backend)"}
          </span>
        </div>
      </Card.Footer>
    </Card>
  );
}

/* ============================ Risk history table ============================ */

function RiskHistoryCard({
  loading,
  error,
  dbDisabled,
  captures,
  totalCount,
  search,
  onSearch,
  filterLevel,
  onFilterLevel,
}) {
  const filters = [
    { key: "ALL", label: "All" },
    { key: "LOW", label: "Low" },
    { key: "MEDIUM", label: "Medium" },
    { key: "HIGH", label: "High" },
    { key: "CRITICAL", label: "Critical" },
  ];

  return (
    <Card>
      <Card.Header
        icon={CalendarClock}
        title="Risk history"
        accent="text-ink-500"
        right={
          <span className="text-[11px] text-ink-400">
            {captures.length} of {totalCount}
          </span>
        }
      />

      <Card.Body>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by waste, case, or bin id…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterLevel(f.key)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  filterLevel === f.key
                    ? "bg-ink-900 text-white"
                    : "bg-slate-100 text-ink-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dbDisabled ? (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-xs text-amber-800">
            Capture history requires <code>DATABASE_URL</code> on the backend.
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        ) : loading && captures.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        ) : captures.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-ink-500">
            No captures match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr className="text-left text-ink-500">
                  <Th>Time</Th>
                  <Th>Risk</Th>
                  <Th>Case</Th>
                  <Th>Waste</Th>
                  <Th>Animals</Th>
                  <Th>Temp</Th>
                  <Th>Hum</Th>
                  <Th>Bin</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {captures.map((c, i) => (
                  <tr
                    key={`${c.id || c.captured_at}-${i}`}
                    className="hover:bg-slate-50 transition"
                  >
                    <Td className="text-ink-500 whitespace-nowrap">
                      {formatTs(c.captured_at)}
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          RISK_BADGE[c.risk_level] ||
                          "bg-slate-100 text-ink-500"
                        }`}
                      >
                        {c.risk_level || "—"}
                      </span>
                    </Td>
                    <Td className="text-ink-700">{c.risk_case || "—"}</Td>
                    <Td className="text-ink-700">{c.waste_label || "—"}</Td>
                    <Td className="tabular-nums">
                      {c.animal_count != null ? c.animal_count : "—"}
                    </Td>
                    <Td className="tabular-nums">
                      {c.temp_c != null ? `${c.temp_c}°C` : "—"}
                    </Td>
                    <Td className="tabular-nums">
                      {c.humidity_pct != null
                        ? `${Math.round(c.humidity_pct)}%`
                        : "—"}
                    </Td>
                    <Td>
                      {c.device_id ? (
                        <Link
                          to={`/bins/${c.device_id}`}
                          className="inline-flex items-center gap-0.5 text-brand-700 hover:text-brand-600"
                        >
                          #{c.device_id}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>

      <Card.Footer>
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          <Activity className="h-3 w-3" />
          History reads from <code className="rounded bg-slate-100 px-1">/captures</code>{" "}
          (capped at 100 rows · refreshed every 2 minutes).
        </div>
      </Card.Footer>
    </Card>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
