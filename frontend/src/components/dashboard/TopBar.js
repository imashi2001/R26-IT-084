import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Cloud,
  CloudSun,
  Droplets,
  Bell,
  Menu,
  ChevronDown,
  Thermometer,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";
import { useAuth } from "../../context/AuthContext";

/*
 * Top bar for the system dashboard.
 *
 * - Date + time tick every second (cheap; only re-renders header).
 * - Weather chips pull from GET /latest's `extras.temp_c / humidity_pct /
 *   weather_condition`. If the backend has no captures yet (or DB is off),
 *   we show "—" rather than crashing.
 * - Bell badge reserved for PR 5 (Recent Alerts feed); shows a static "0" now.
 * - Profile shows AuthContext.user (or "Guest") so admins see their email.
 */

function StatChip({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-ink-500" />
      </div>
      <div className="leading-tight">
        <div className="text-[11px] font-medium text-ink-400">{label}</div>
        <div className="text-sm font-semibold text-ink-900">{value || "—"}</div>
        {sub ? <div className="text-[10px] text-ink-400">{sub}</div> : null}
      </div>
    </div>
  );
}

function useLatestWeather(intervalMs = 60_000) {
  const [w, setW] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const { data } = await axios.get(apiUrl("/latest"), { timeout: 5000 });
        if (cancelled) return;
        const extras = data?.extras || data?.latest?.extras || data || {};
        if (
          extras &&
          (extras.temp_c != null ||
            extras.humidity_pct != null ||
            extras.weather_condition != null)
        ) {
          setW({
            temp_c: extras.temp_c ?? null,
            humidity_pct: extras.humidity_pct ?? null,
            condition: extras.weather_condition ?? null,
          });
        }
      } catch {
        /* keep prior value; sidebar shows the actual outage */
      }
    }

    poll();
    const t = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [intervalMs]);

  return w;
}

export default function TopBar({ onToggleSidebar }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const auth = useAuth?.();
  const user = auth?.user || null;

  const weather = useLatestWeather();

  const dateText = now.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString([], { hour12: true });

  const tempText = weather?.temp_c != null ? `${weather.temp_c}°C` : "—";
  const humText =
    weather?.humidity_pct != null ? `${Math.round(weather.humidity_pct)}%` : "—";
  const condText = weather?.condition || "—";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-1 divide-x divide-slate-200">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <StatChip icon={Calendar} label="Today" value={dateText} />
        <StatChip icon={Clock} label="Time" value={timeText} />
        <StatChip icon={Thermometer} label="Temperature" value={tempText} />
        <StatChip icon={Droplets} label="Humidity" value={humText} />
        <StatChip icon={CloudSun} label="Weather" value={condText} />
      </div>

      <div className="flex items-center gap-3 pl-3">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            0
          </span>
        </button>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {(user?.email || "A")[0].toUpperCase()}
          </div>
          <div className="leading-tight pr-1">
            <div className="text-sm font-semibold text-ink-900">
              {user?.email ? user.email.split("@")[0] : "Admin"}
            </div>
            <div className="text-[11px] text-ink-400">
              {user?.role || "Administrator"}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-ink-400" />
        </div>
      </div>
    </header>
  );
}
