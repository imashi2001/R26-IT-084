import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
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
  Volume2,
  Leaf,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";
import useAlertBadgeCount from "../../hooks/useAlertBadgeCount";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/live-monitoring", icon: Activity, label: "Live Monitoring" },
  { to: "/hygienic-risk", icon: ShieldAlert, label: "Risk Dashboard" },
  { to: "/bin-level-detector", icon: Trash2, label: "Bin Level Detector" },
  { to: "/map", icon: MapIcon, label: "Map View" },
  { to: "/bins", icon: Database, label: "Bin Status" },
  { to: "/animals", icon: PawPrint, label: "Animal Detection" },
  { to: "/litter-severity", icon: ScanSearch, label: "Litter Severity" },
  { to: "/forecast", icon: TrendingUp, label: "Forecasting" },
  { to: "/alerts", icon: Bell, label: "Alerts & Notifications", badge: true },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/history", icon: History, label: "History" },
  { to: "/mobile-report", icon: Smartphone, label: "Mobile Reports" },
  { to: "/speaker", icon: Volume2, label: "Speaker Check" },
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
            detail: dbOk ? "Models + DB online" : "Models online",
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

function PromoFooter() {
  return (
    <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-brand-500/25 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-slate-950">
      <div className="relative h-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-brand-500/10" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/20">
            <Trash2 className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <div className="text-xs font-bold leading-tight text-white">
              Cleaner City,
            </div>
            <div className="text-xs font-bold leading-tight text-brand-400">
              Better Tomorrow
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusFooter() {
  const { status, label, detail } = useSystemHealth();

  const styles = {
    loading: {
      wrap: "border-slate-700/60 bg-slate-800/50",
      fg: "text-slate-400",
      dot: "bg-slate-500",
    },
    ok: {
      wrap: "border-brand-500/30 bg-brand-500/10 shadow-glow-brand",
      fg: "text-brand-400",
      dot: "bg-brand-500",
    },
    warn: {
      wrap: "border-amber-500/30 bg-amber-500/10",
      fg: "text-amber-400",
      dot: "bg-amber-500",
    },
    error: {
      wrap: "border-red-500/30 bg-red-500/10",
      fg: "text-red-400",
      dot: "bg-red-500",
    },
  }[status];

  const pulse = status === "ok" ? "animate-pulse" : "";

  return (
    <div className={`mx-3 mb-4 rounded-xl border p-3 ${styles.wrap}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${styles.dot} opacity-50 ${pulse}`}
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${styles.dot}`}
          />
        </span>
        {status === "ok" ? (
          <CircleCheck className={`h-4 w-4 ${styles.fg}`} />
        ) : (
          <CircleAlert className={`h-4 w-4 ${styles.fg}`} />
        )}
        <div className={`text-sm font-semibold ${styles.fg}`}>System Status</div>
      </div>
      <div className={`mt-1 text-xs font-medium ${styles.fg}`}>{label}</div>
      {detail ? (
        <div className="text-[11px] text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

export default function Sidebar() {
  const alertCount = useAlertBadgeCount();

  return (
    <aside className="relative z-10 flex h-screen w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow-brand">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-base font-bold leading-tight text-white">
            VisionWaste
          </div>
          <div className="text-[11px] leading-tight text-slate-500">
            Smart Waste Monitoring
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "border border-brand-500/35 bg-brand-500/15 text-brand-400 shadow-glow-brand"
                      : "border border-transparent text-slate-400 hover:border-slate-700/50 hover:bg-slate-800/50 hover:text-slate-200",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {badge && alertCount > 0 ? (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-glow-red">
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <PromoFooter />
      <StatusFooter />
    </aside>
  );
}
