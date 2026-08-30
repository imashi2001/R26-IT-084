import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  History as HistoryIcon,
  RefreshCw,
  Database,
  AlertTriangle,
  ChevronRight,
  Camera,
  Bell,
  PawPrint,
  Trash2,
  ShieldAlert,
  Image as ImageIcon,
  ArrowUpRight,
  Plus,
  Thermometer,
  Droplets,
  Calendar,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import FilterBar, {
  FilterChipGroup,
  FilterSearch,
} from "../components/dashboard/FilterBar";
import ListRow from "../components/dashboard/ListRow";
import EmptyState from "../components/dashboard/EmptyState";
import {
  btnGhost,
  btnSecondary,
  inputClass,
  selectClass,
  labelClass,
  chipClass,
  chipActiveClass,
  bannerTone,
  summaryTone,
} from "../components/dashboard/dashboardUi";
import { useAuth } from "../context/AuthContext";
import { apiUrl, fetchBins } from "../utils/apiBase";

/*
 * /history — Unified event timeline (dashboard shell).
 *
 * Stores and visualises every operational event in the system, so admins can
 * audit "what happened on this bin" without leaving the dashboard.
 *
 * Stored events come from the existing endpoints:
 *   - GET /captures?since&until&device_id  → every image capture, its
 *     waste/animal/fill prediction, weather context, and the rule-based
 *     risk_level the engine assigned.
 *   - GET /alerts (auth required)         → operational alert lifecycle
 *     records (open / acknowledged / actioned / rejected / dismissed) +
 *     admin notes.
 *
 * Events are merged client-side into a single chronological timeline
 * grouped by calendar day. Each capture row may also surface secondary
 * derived events when applicable (animal sighting, overflow). The page
 * supports date range, bin, event-type and risk filters plus free-text
 * search across waste labels and alert titles/summaries.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_PRESETS = [
  { id: "24h", label: "Last 24h", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "custom", label: "Custom", days: null },
];

const TYPE_FILTERS = [
  { id: "all", label: "All", icon: HistoryIcon },
  { id: "capture", label: "Captures", icon: Camera },
  { id: "alert", label: "Alerts", icon: Bell },
  { id: "animal", label: "Animal sightings", icon: PawPrint },
  { id: "overflow", label: "Overflow", icon: Trash2 },
  { id: "risk_high", label: "HIGH+ risk", icon: ShieldAlert },
];

const RISK_FILTERS = [
  { id: "all", label: "All risks" },
  { id: "LOW", label: "LOW" },
  { id: "MEDIUM", label: "MEDIUM" },
  { id: "HIGH", label: "HIGH" },
  { id: "CRITICAL", label: "CRITICAL" },
];

const RISK_COLOR = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#b91c1c",
  UNKNOWN: "#94a3b8",
};

const ALERT_SEVERITY_TONE = {
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  info: "bg-slate-900/40 text-slate-300 border-slate-700/50",
};

const ALERT_STATUS_TONE = {
  open: "bg-red-500/10 text-red-300 border-red-500/30",
  acknowledged: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  actioned: "bg-brand-500/10 text-brand-300 border-brand-500/30",
  rejected: "bg-slate-900/40 text-slate-400 border-slate-700/50",
  dismissed: "bg-slate-950/40 text-slate-500 border-slate-700/50",
};

const ALERT_TYPE_LABEL = {
  risk_critical: "Critical risk",
  risk_high: "High risk",
  buzzer: "Deterrence / buzzer",
  overflow: "Bin overflow",
  animal: "Animal activity",
};

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

function toDateInputValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKey(d) {
  return toDateInputValue(startOfDay(d));
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDay(key) {
  if (!key) return "";
  try {
    const d = new Date(`${key}T00:00:00`);
    const today = startOfDay(new Date());
    const yest = startOfDay(new Date(Date.now() - DAY_MS));
    if (dayKey(d) === dayKey(today)) return "Today";
    if (dayKey(d) === dayKey(yest)) return "Yesterday";
    return d.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return key;
  }
}

function riskLevelFor(c) {
  const r = String(c.risk_level || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(r)) return r;
  return "UNKNOWN";
}

function fillTierFor(c) {
  const lvl = String(c.fill_level || "").toUpperCase();
  if (lvl === "OVERFLOW" || lvl === "OVERFLOWING") return "OVERFLOW";
  if (lvl === "HIGH" || lvl === "FULL") return "HIGH";
  if (lvl === "MEDIUM" || lvl === "HALF") return "MEDIUM";
  if (lvl === "LOW") return "LOW";
  if (lvl === "EMPTY") return "EMPTY";
  const pct = Number(c.fill_percentage);
  if (Number.isFinite(pct)) {
    if (pct >= 85) return "OVERFLOW";
    if (pct >= 60) return "HIGH";
    if (pct >= 30) return "MEDIUM";
    return "LOW";
  }
  return "UNKNOWN";
}

export default function HistoryPage() {
  const { user, authFetch } = useAuth();

  const [presetId, setPresetId] = useState("7d");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [customStart, setCustomStart] = useState(
    toDateInputValue(new Date(Date.now() - 7 * DAY_MS))
  );
  const [customEnd, setCustomEnd] = useState(toDateInputValue(today));

  const [binFilter, setBinFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [bins, setBins] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);
  const [pageSize, setPageSize] = useState(150);

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
    const preset =
      RANGE_PRESETS.find((p) => p.id === presetId) || RANGE_PRESETS[1];
    const since = startOfDay(new Date(Date.now() - preset.days * DAY_MS));
    const until = endOfDay(new Date());
    return { since, until };
  }, [presetId, customStart, customEnd]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbDisabled(false);
    try {
      const params = { limit: pageSize };
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
          new Date(b.captured_at).getTime() -
          new Date(a.captured_at).getTime()
      );
      setCaptures(list);

      if (user) {
        try {
          const res = await authFetch("/alerts?limit=200", { method: "GET" });
          if (res.ok) {
            const body = await res.json().catch(() => ({}));
            const items = Array.isArray(body.alerts) ? body.alerts : [];
            const sinceMs = range.since ? range.since.getTime() : 0;
            const untilMs = range.until ? range.until.getTime() : Infinity;
            const scoped = items.filter((a) => {
              const refIso =
                a.updated_at || a.created_at || a.capture?.captured_at;
              const t = refIso ? new Date(refIso).getTime() : NaN;
              if (!Number.isFinite(t)) return false;
              if (t < sinceMs || t > untilMs) return false;
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
        setError(e?.message || "Failed to load history.");
        setCaptures([]);
      }
    } finally {
      setLoading(false);
    }
  }, [range, binFilter, pageSize, user, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const binsById = useMemo(() => {
    const m = new Map();
    for (const b of bins) m.set(String(b.id), b);
    return m;
  }, [bins]);

  const events = useMemo(() => {
    const all = [];

    for (const c of captures) {
      const r = riskLevelFor(c);
      const tier = fillTierFor(c);
      const animals = Number(c.animal_count) || 0;
      const bin = binsById.get(String(c.device_id));
      const evt = {
        kind: "capture",
        id: `c-${c.id}`,
        at: c.captured_at,
        deviceId: c.device_id,
        binName: bin?.name || `Bin #${c.device_id ?? "—"}`,
        risk: r,
        fillTier: tier,
        animals,
        capture: c,
        flags: {
          highPlus: r === "HIGH" || r === "CRITICAL",
          overflow: tier === "OVERFLOW",
          animal: animals > 0,
        },
        searchHaystack: [
          c.waste_label,
          c.risk_case,
          c.weather_condition,
          bin?.name,
          bin?.esp32_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
      all.push(evt);
    }

    for (const a of alerts) {
      const bin =
        a.device || (a.device_id ? binsById.get(String(a.device_id)) : null);
      const at = a.updated_at || a.created_at;
      all.push({
        kind: "alert",
        id: `a-${a.id}`,
        at,
        deviceId: a.device_id,
        binName: bin?.name || `Bin #${a.device_id ?? "—"}`,
        alert: a,
        flags: {
          highPlus: a.severity === "critical",
          overflow: a.alert_type === "overflow",
          animal: a.alert_type === "animal" || a.alert_type === "buzzer",
        },
        searchHaystack: [
          a.title,
          a.summary,
          ALERT_TYPE_LABEL[a.alert_type],
          a.admin_note,
          bin?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }

    all.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    return all;
  }, [captures, alerts, binsById]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== "all") {
        if (typeFilter === "capture" && e.kind !== "capture") return false;
        if (typeFilter === "alert" && e.kind !== "alert") return false;
        if (typeFilter === "animal" && !e.flags.animal) return false;
        if (typeFilter === "overflow" && !e.flags.overflow) return false;
        if (typeFilter === "risk_high" && !e.flags.highPlus) return false;
      }
      if (riskFilter !== "all") {
        const r =
          e.kind === "capture"
            ? e.risk
            : (e.alert?.capture?.risk_level || "").toUpperCase();
        if (r !== riskFilter) return false;
      }
      if (q && !e.searchHaystack.includes(q)) return false;
      return true;
    });
  }, [events, typeFilter, riskFilter, search]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredEvents) {
      const k = dayKey(new Date(e.at));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return Array.from(map.entries());
  }, [filteredEvents]);

  const counts = useMemo(() => {
    let cap = 0;
    let alt = 0;
    let ani = 0;
    let ovf = 0;
    let high = 0;
    for (const e of events) {
      if (e.kind === "capture") cap += 1;
      if (e.kind === "alert") alt += 1;
      if (e.flags.animal) ani += 1;
      if (e.flags.overflow) ovf += 1;
      if (e.flags.highPlus) high += 1;
    }
    return { cap, alt, ani, ovf, high, total: events.length };
  }, [events]);

  const rangeLabel = useMemo(() => {
    const s = range.since ? toDateInputValue(range.since) : "—";
    const e = range.until ? toDateInputValue(range.until) : "—";
    return `${s} → ${e}`;
  }, [range]);

  const canLoadMore = captures.length >= pageSize;

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="History"
          subtitle="Full audit timeline of every capture and alert lifecycle event in the selected window. Use the filters to scope by bin, event type, risk level, or free-text search; rows link out to the bin detail and Alerts pages for follow-up."
          actions={
            <>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className={btnSecondary}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Loading…" : "Refresh"}
              </button>
              <Link to="/reports" className={btnGhost}>
                Reports
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          }
        >
          <p className="mt-1 text-xs text-slate-500">
            Range: <span className="font-mono">{rangeLabel}</span>
            {binFilter !== "all" ? (
              <>
                {" · "}
                Bin{" "}
                <span className="font-semibold text-slate-300">
                  {binsById.get(String(binFilter))?.name || `#${binFilter}`}
                </span>
              </>
            ) : null}
          </p>
        </PageHeader>

        {dbDisabled ? (
          <Banner
            icon={Database}
            title="Database not configured"
            body="History needs the captures and alerts tables. Set DATABASE_URL on the backend and run with DB_SYNC=true (or DB_SYNC_ALTER=true) once so the schema is created."
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Chip icon={HistoryIcon} label="Events" value={counts.total} />
          <Chip icon={Camera} label="Captures" value={counts.cap} />
          <Chip icon={Bell} label="Alerts" value={counts.alt} tone="amber" />
          <Chip icon={PawPrint} label="Animals" value={counts.ani} tone="amber" />
          <Chip icon={Trash2} label="Overflow" value={counts.ovf} tone="red" />
          <Chip
            icon={ShieldAlert}
            label="HIGH+"
            value={counts.high}
            tone="red"
          />
        </div>

        <FilterBar className="flex-col items-stretch gap-4">
          <FilterChipGroup label="Date range">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={
                  presetId === p.id ? chipActiveClass : chipClass
                }
              >
                {p.label}
              </button>
            ))}
          </FilterChipGroup>
          {presetId === "custom" ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col">
                <span className={labelClass}>From</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col">
                <span className={labelClass}>To</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              <span className={labelClass}>Bin</span>
              <select
                value={binFilter}
                onChange={(e) => setBinFilter(e.target.value)}
                className={`${selectClass} min-w-[14rem]`}
              >
                <option value="all">All bins</option>
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || `Bin #${b.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col">
              <span className={labelClass}>Risk level</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className={selectClass}
              >
                {RISK_FILTERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <FilterSearch
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="waste label, alert title, esp32_id…"
            />

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {filteredEvents.length} of {events.length} events
              </span>
            </div>
          </div>

          <FilterChipGroup label="Event type">
            {TYPE_FILTERS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`inline-flex items-center gap-1.5 ${
                    typeFilter === t.id ? chipActiveClass : chipClass
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </FilterChipGroup>
        </FilterBar>

        {loading && events.length === 0 ? (
          <TimelineSkeleton />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No events"
            message="No captures or alerts match the current filters. Widen the date range or clear the search to see more."
          />
        ) : (
          <div className="space-y-6">
            {byDay.map(([dKey, evs]) => (
              <DayGroup
                key={dKey}
                dayKey={dKey}
                events={evs}
                binsById={binsById}
              />
            ))}

            {canLoadMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setPageSize((s) => Math.min(s + 150, 500))}
                  disabled={loading}
                  className={btnSecondary}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {loading ? "Loading…" : `Load more (currently ${pageSize})`}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </PageShell>
    </DashboardLayout>
  );
}

function DayGroup({ dayKey: dKey, events, binsById }) {
  return (
    <section>
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-slate-950/90 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">
            {formatDay(dKey)}
            <span className="ml-2 text-xs font-medium text-slate-500">
              {dKey}
            </span>
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <ol className="relative space-y-3 border-l border-slate-700/50 pl-5">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[9px] top-3 h-3.5 w-3.5 rounded-full ring-4 ring-slate-950"
              style={{ backgroundColor: nodeColor(e) }}
            />
            {e.kind === "capture" ? (
              <CaptureRow event={e} binsById={binsById} />
            ) : (
              <AlertRow event={e} />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function nodeColor(e) {
  if (e.kind === "alert") {
    if (e.alert?.severity === "critical") return RISK_COLOR.HIGH;
    if (e.alert?.severity === "warning") return RISK_COLOR.MEDIUM;
    return RISK_COLOR.UNKNOWN;
  }
  return RISK_COLOR[e.risk] || RISK_COLOR.UNKNOWN;
}

function CaptureRow({ event: e, binsById }) {
  const c = e.capture;
  const bin = binsById.get(String(c.device_id));
  const r = e.risk;
  const tier = e.fillTier;

  const flags = [];
  if (e.flags.highPlus) flags.push({ label: r, tone: "red" });
  if (e.flags.overflow) flags.push({ label: "OVERFLOW", tone: "red" });
  if (e.flags.animal)
    flags.push({ label: `${e.animals} animal${e.animals === 1 ? "" : "s"}`, tone: "amber" });

  return (
    <ListRow className="!min-h-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 bg-slate-900/40 px-2 py-0.5 font-semibold text-slate-300">
              <Camera className="h-3 w-3" />
              Capture #{c.id}
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: `${RISK_COLOR[r]}1f`,
                color: RISK_COLOR[r],
              }}
            >
              Risk {r}
            </span>
            {flags.map((f, idx) => (
              <Pill key={idx} label={f.label} tone={f.tone} />
            ))}
            <span className="text-slate-500">{formatTime(c.captured_at)}</span>
          </div>

          <div className="text-sm font-semibold text-slate-100">
            {bin ? (
              <Link
                to={`/bins/${bin.id}`}
                className="text-slate-100 hover:text-brand-400"
              >
                {bin.name}
              </Link>
            ) : (
              <span>Bin #{c.device_id ?? "—"}</span>
            )}
            {bin?.esp32_id ? (
              <span className="ml-2 rounded bg-slate-900/40 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                {bin.esp32_id}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {c.waste_label ? (
              <span>
                Waste:{" "}
                <span className="font-semibold text-slate-200">
                  {c.waste_label}
                </span>
                {Number.isFinite(Number(c.waste_confidence))
                  ? ` · ${Math.round(Number(c.waste_confidence) * 100)}%`
                  : ""}
              </span>
            ) : null}
            <span>
              Fill:{" "}
              <span className="font-semibold text-slate-200">{tier}</span>
              {Number.isFinite(Number(c.fill_percentage))
                ? ` · ${Math.round(Number(c.fill_percentage))}%`
                : ""}
            </span>
            {Number.isFinite(Number(c.temp_c)) ? (
              <span className="inline-flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-slate-500" />
                {Number(c.temp_c).toFixed(1)}°C
              </span>
            ) : null}
            {Number.isFinite(Number(c.humidity_pct)) ? (
              <span className="inline-flex items-center gap-1">
                <Droplets className="h-3 w-3 text-slate-500" />
                {Math.round(Number(c.humidity_pct))}%
              </span>
            ) : null}
            {c.weather_condition ? (
              <span className="text-slate-500">{c.weather_condition}</span>
            ) : null}
            {c.risk_case ? (
              <span className="text-slate-500">Case {c.risk_case}</span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center gap-3 lg:w-48 lg:flex-col lg:items-stretch lg:justify-center">
          {c.has_image ? (
            <a
              href={apiUrl(`/captures/${c.id}/image`)}
              target="_blank"
              rel="noreferrer"
              className="block flex-1 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/40 lg:flex-none"
            >
              <img
                src={apiUrl(`/captures/${c.id}/image`)}
                alt=""
                loading="lazy"
                className="h-20 w-full object-cover lg:h-24"
              />
            </a>
          ) : (
            <div className="flex h-20 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/50 bg-slate-950/40 text-slate-600 lg:h-24 lg:flex-none">
              <ImageIcon className="h-7 w-7" />
            </div>
          )}
          {bin ? (
            <Link
              to={`/bins/${bin.id}`}
              className={btnGhost}
            >
              Bin detail
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </ListRow>
  );
}

function AlertRow({ event: e }) {
  const a = e.alert;
  const typeLabel =
    ALERT_TYPE_LABEL[a.alert_type] ||
    a.alert_type?.replace(/_/g, " ") ||
    "Alert";
  const sevTone = ALERT_SEVERITY_TONE[a.severity] || ALERT_SEVERITY_TONE.info;
  const stTone = ALERT_STATUS_TONE[a.status] || ALERT_STATUS_TONE.open;

  return (
    <ListRow className="!min-h-0">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 bg-slate-900/40 px-2 py-0.5 font-semibold text-slate-300">
            <Bell className="h-3 w-3" />
            Alert #{a.id}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${sevTone}`}
          >
            {a.severity}
          </span>
          <span className="rounded-full border border-slate-700/50 bg-slate-950/40 px-2 py-0.5 font-semibold text-slate-300">
            {typeLabel}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 font-semibold capitalize ${stTone}`}
          >
            {a.status}
          </span>
          <span className="text-slate-500">{formatTime(e.at)}</span>
        </div>

        <h3 className="text-sm font-semibold text-slate-100">{a.title}</h3>
        {a.summary ? (
          <p className="text-xs text-slate-400">{a.summary}</p>
        ) : null}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {a.device ? (
            <span>
              Bin:{" "}
              <Link
                to={`/bins/${a.device.id}`}
                className="font-semibold text-brand-400 hover:text-brand-300"
              >
                {a.device.name}
              </Link>
            </span>
          ) : null}
          {a.capture_id ? (
            <span>Capture #{a.capture_id}</span>
          ) : null}
          {a.admin_note ? (
            <span className="rounded bg-slate-900/40 px-1.5 py-0.5 text-slate-400">
              Note: {a.admin_note}
            </span>
          ) : null}
        </div>

        <div>
          <Link
            to="/alerts"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300"
          >
            Open in Alerts
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </ListRow>
  );
}

function Pill({ label, tone = "slate" }) {
  const tones = {
    slate: "border-slate-700/50 bg-slate-900/40 text-slate-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    brand: "border-brand-500/30 bg-brand-500/10 text-brand-300",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        tones[tone] || tones.slate
      }`}
    >
      {label}
    </span>
  );
}

function Chip({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: summaryTone("default"),
    amber: summaryTone("amber"),
    red: summaryTone("risk"),
    brand: summaryTone("brand"),
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
        tones[tone] || tones.slate
      }`}
    >
      <div className="rounded-lg bg-slate-900/60 p-2">
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
  const toneKey = tone === "red" ? "error" : "warn";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone(toneKey)}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-700/50 bg-slate-950/40 p-4"
        >
          <div className="h-3 w-1/4 rounded bg-slate-700" />
          <div className="mt-2 h-4 w-1/3 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
