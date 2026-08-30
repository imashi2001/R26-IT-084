import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { CHART } from "../components/dashboard/dashboardTheme";
import {
  btnSecondary,
  selectClass,
  inputClass,
  labelClass,
  riskBadgeClass,
  bannerTone,
  chipClass,
  chipActiveClass,
} from "../components/dashboard/dashboardUi";
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
                Set <code className="rounded bg-amber-500/20 px-1 text-amber-200">DATABASE_URL</code>{" "}
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Risk Dashboard
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-slate-400">
          Hygienic risk forecast, capture history, and rule-based explanations.
          For per-capture details and image analysis, use{" "}
          <Link
            to="/bin-level-detector"
            className="font-semibold text-brand-400 hover:text-brand-300"
          >
            Bin Level Detector
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2">
          <span className={labelClass}>Bin</span>
          <select
            value={binId}
            onChange={(e) => onBinChange(e.target.value)}
            className={`${selectClass} !mt-0 w-auto min-w-[10rem]`}
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
          className={btnSecondary}
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
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone(tone)}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
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
          <span className="text-[11px] text-slate-400">
            {timestamp ? relativeFromNow(timestamp) : "—"}
          </span>
        }
      />

      <Card.Body>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading latest…
          </div>
        ) : empty ? (
          <div className="flex flex-col items-start gap-2 text-sm text-slate-400">
            <div className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-xs font-semibold text-slate-300">
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
                className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold tracking-wider ${riskBadgeClass(level)}`}
              >
                {level}
              </span>
              <div className="text-3xl font-bold tabular-nums text-slate-100">
                {score}
                <span className="text-sm font-medium text-slate-400">/100</span>
              </div>
        </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${tone?.barBg || "bg-brand-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {message}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
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
          className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:text-brand-300"
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
    <div className="rounded-md border border-slate-700/50 bg-slate-950/40 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
                </div>
      <div className="text-xs font-semibold text-slate-100">{value}</div>
                </div>
  );
}

/* ============================ Forecast trend chart ============================ */

function ForecastChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-100">{p.time}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">
        Predicted level:{" "}
        <span
          className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-bold ${riskBadgeClass(p.level)}`}
        >
          {p.level || "—"}
        </span>
      </div>
      <div className="text-[11px] text-slate-400">
        Score: <span className="font-semibold text-slate-100">{p.score}</span>
      </div>
      <div className="text-[11px] text-slate-400">
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
            <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Stub feed
            </span>
          ) : (
            <span className="rounded-md border border-brand-500/30 bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400">
              Live
            </span>
          )
        }
      />

      <Card.Body className="min-h-[260px]">
        {busy && data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center gap-2 text-xs text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading forecast…
          </div>
        ) : empty ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
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
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<ForecastChartTooltip />} cursor={{ stroke: CHART.grid }} />
                <ReferenceLine
                  y={40}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: "MEDIUM", fontSize: 9, fill: "#fbbf24", position: "right" }}
                />
                <ReferenceLine
                  y={70}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: "HIGH", fontSize: 9, fill: "#f87171", position: "right" }}
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
              <div className="flex max-w-[60%] items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="text-slate-300">{summary.recommendation}</span>
              </div>
            ) : (
              <span className="text-slate-400">No recommendation yet.</span>
            )}
            {thresholds ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">Thresholds:</span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-400">
                  ≥ {thresholds.HIGH_TEMP_C}°C
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-400">
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
          <div className="flex items-center gap-2 text-xs text-slate-400">
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
        <span className="text-[11px] text-slate-400">{data.length} slots</span>
      } />
      <Card.Body>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="flex gap-2 min-w-max">
            {data.map((s, i) => {
              const color = SLOT_COLOR[s.level] || "#94a3b8";
              return (
                <div
                  key={`${s.rawTs}-${i}`}
                  className="w-[88px] shrink-0 rounded-lg border border-slate-700/50 bg-slate-950/40 p-2 text-center"
                  style={{ borderColor: `${color}55`, boxShadow: `inset 3px 0 0 ${color}` }}
                  title={`${s.level} · ${Math.round(s.temp)}°C · ${Math.round(s.hum)}% RH`}
                >
                  <div className="text-[10px] font-semibold text-slate-400">
                    {s.time}
                  </div>
                  <div
                    className="mt-1 text-[11px] font-bold tracking-wider"
                    style={{ color }}
                  >
                      {s.level}
                    </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {Math.round(s.temp)}°C
                  </div>
                  <div className="text-[10px] text-slate-500">
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
      tone: "border-brand-500/30 bg-brand-500/10 text-brand-300",
      desc: "Below medium thresholds. No animals, no organic spike, mild weather.",
    },
    {
      level: "MEDIUM",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      desc: `Hot (≥ ${thresholds.HIGH_TEMP_C}°C) OR humid (≥ ${thresholds.HIGH_HUMIDITY_PCT}% RH) — accelerated rotting.`,
    },
    {
      level: "HIGH",
      tone: "border-red-500/30 bg-red-500/15 text-red-400",
      desc: "Animals detected, organic waste in heat, or compounding hot + humid conditions.",
    },
    {
      level: "CRITICAL",
      tone: "border-red-500/40 bg-red-500/20 text-red-300",
      desc: "Reserved for mixed-waste / multiple compounding factors. Engine does not emit yet.",
    },
  ];

  return (
    <Card>
      <Card.Header
        icon={Info}
        title="Rules & thresholds"
        accent="text-slate-400"
        right={
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
            <span className="text-slate-400">HIGH_TEMP_C</span>
            <code className="rounded bg-slate-800 px-1 font-semibold text-slate-100">
              {thresholds.HIGH_TEMP_C}
            </code>
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3 w-3 text-sky-500" />
            <span className="text-slate-400">HIGH_HUMIDITY_PCT</span>
            <code className="rounded bg-slate-800 px-1 font-semibold text-slate-100">
              {thresholds.HIGH_HUMIDITY_PCT}
            </code>
          </span>
          <span className="text-slate-500">
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
        accent="text-slate-400"
        right={
          <span className="text-[11px] text-slate-400">
            {captures.length} of {totalCount}
          </span>
        }
      />

      <Card.Body>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by waste, case, or bin id…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className={`${inputClass} !mt-0 pl-9`}
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterLevel(f.key)}
                className={
                  filterLevel === f.key ? chipActiveClass : chipClass
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dbDisabled ? (
          <div className={`rounded-lg border px-4 py-6 text-center text-xs ${bannerTone("amber")}`}>
            Capture history requires <code>DATABASE_URL</code> on the backend.
          </div>
        ) : error ? (
          <div className={`rounded-lg border px-4 py-3 text-xs ${bannerTone("red")}`}>
            {error}
          </div>
        ) : loading && captures.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        ) : captures.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700/50 bg-slate-950/30 px-4 py-6 text-center text-xs text-slate-400">
            No captures match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-900/60">
                <tr className="text-left text-slate-400">
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
              <tbody className="divide-y divide-slate-700/40">
                {captures.map((c, i) => (
                  <tr
                    key={`${c.id || c.captured_at}-${i}`}
                    className="transition hover:bg-slate-900/40"
                  >
                    <Td className="whitespace-nowrap text-slate-400">
                      {formatTs(c.captured_at)}
                    </Td>
                    <Td>
                        <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${riskBadgeClass(c.risk_level)}`}
                      >
                        {c.risk_level || "—"}
                      </span>
                    </Td>
                    <Td className="text-slate-300">{c.risk_case || "—"}</Td>
                    <Td className="text-slate-300">{c.waste_label || "—"}</Td>
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
                          className="inline-flex items-center gap-0.5 text-brand-400 hover:text-brand-300"
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
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Activity className="h-3 w-3" />
          History reads from <code className="rounded bg-slate-800 px-1">/captures</code>{" "}
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
