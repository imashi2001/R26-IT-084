"use client";
import { useEffect, useState } from "react";
import { NavLink } from "@/lib/react-router-compat";
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Trash2,
  Map as MapIcon,
  Database,
  PawPrint,
  ScanSearch,
  TrendingUp,
  Bell,
  FileText,
  History,
  Smartphone,
  Settings,
  Leaf,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";

/*
 * Sidebar for the new system-wide dashboard.
 *
 * - Order matches the locked spec (Scatter Detection removed; Bin Fill Level
 *   and Mobile Reports added).
 * - Each nav item has a route. Routes that don't exist yet (`/live-monitoring`,
 *   `/bin-fill`, `/animals`, `/forecast`, `/alerts`, `/reports`, `/history`)
 *   will be added as stubs in PR 6 — until then NavLink will still render but
 *   the click target is a 404 inside the SPA. This keeps the sidebar visually
 *   complete from PR 2 forward.
 * - System Status footer pings GET /health every 30s and surfaces the worst
 *   service state.
 */

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/live-monitoring", icon: Activity, label: "Live Monitoring" },
  { to: "/test", icon: Activity, label: "test" },
  { to: "/hygienic-risk", icon: ShieldAlert, label: "Risk Dashboard" },
  { to: "/bin-level-detector", icon: Trash2, label: "Bin Level Detector" },
  { to: "/map", icon: MapIcon, label: "Map View" },
  { to: "/bins", icon: Database, label: "Bin Status" },
  { to: "/animals", icon: PawPrint, label: "Animal Detection" },
  { to: "/litter-severity", icon: ScanSearch, label: "Litter Severity" },
  { to: "/forecast", icon: TrendingUp, label: "Forecasting" },
  { to: "/alerts", icon: Bell, label: "Alerts & Notifications" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/history", icon: History, label: "History" },
  { to: "/mobile-report", icon: Smartphone, label: "Mobile Reports" },
  { to: "/admin", icon: Settings, label: "Settings" },
];

function useSystemHealth(intervalMs = 30_000) {
  const [state, setState] = useState({
    status: "loading",
    label: "Checking…",
    detail: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const { data } = await axios.get(apiUrl("/health"), { timeout: 5000 });
        if (cancelled) return;

        const models = data?.models || {};
        const modelStates = Object.values(models);
        const allModelsOk = modelStates.length > 0 && modelStates.every((m) => m.ok);
        const anyModelDown = modelStates.some((m) => !m.ok);
        const dbOk = Boolean(data?.database?.enabled && data?.database?.ok);

        if (allModelsOk && (dbOk || data?.database?.enabled === false)) {
          setState({
            status: "ok",
            label: "All systems operational",
            detail: dbOk ? "Models + DB online" : "Models online (DB off)",
          });
        } else if (anyModelDown) {
          const down = Object.entries(models)
            .filter(([, m]) => !m.ok)
            .map(([n]) => n)
            .join(", ");
          setState({
            status: "warn",
            label: "Service degraded",
            detail: `${down} unreachable`,
          });
        } else {
          setState({
            status: "warn",
            label: "Partial service",
            detail: "Some checks failed",
          });
        }
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          label: "Backend unreachable",
          detail: e.message || "ping failed",
        });
      }
    }

    ping();
    const t = setInterval(ping, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [intervalMs]);

  return state;
}

function StatusFooter() {
  const { status, label, detail } = useSystemHealth();

  const styles = {
    loading: { bg: "bg-ink-800", dot: "bg-ink-400", icon: CircleAlert, fg: "text-ink-300" },
    ok: { bg: "bg-brand-50", dot: "bg-brand-500", icon: CircleCheck, fg: "text-brand-700" },
    warn: { bg: "bg-amber-50", dot: "bg-amber-500", icon: CircleAlert, fg: "text-amber-700" },
    error: { bg: "bg-red-50", dot: "bg-red-500", icon: CircleAlert, fg: "text-red-700" },
  }[status];

  const Icon = styles.icon;
  const pulse = status === "ok" ? "animate-pulse" : "";

  return (
    <div className={`mx-3 mb-4 rounded-lg p-3 ${styles.bg}`}>
      <div className="flex items-center gap-2">
        <span className={`relative flex h-2.5 w-2.5`}>
          <span className={`absolute inline-flex h-full w-full rounded-full ${styles.dot} opacity-60 ${pulse}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${styles.dot}`} />
        </span>
        <Icon className={`h-4 w-4 ${styles.fg}`} />
        <div className={`text-sm font-semibold ${styles.fg}`}>System Status</div>
      </div>
      <div className={`mt-1 text-xs font-medium ${styles.fg}`}>{label}</div>
      {detail ? <div className="text-[11px] text-ink-500">{detail}</div> : null}
      <div className="mt-1 text-[10px] text-ink-400">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-base font-bold leading-tight text-ink-900">VisionWaste</div>
          <div className="text-[11px] leading-tight text-ink-500">Smart Waste Monitoring</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-500 hover:bg-slate-50 hover:text-ink-900",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <StatusFooter />
    </aside>
  );
}
