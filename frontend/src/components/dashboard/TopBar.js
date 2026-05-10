import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  CloudSun,
  Droplets,
  Bell,
  Menu,
  ChevronDown,
  Thermometer,
  LogOut,
  User as UserIcon,
  Building2,
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
  const logout = auth?.logout;
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    if (logout) logout();
    navigate("/login", { replace: true });
  }

  const displayName =
    user?.adminName ||
    user?.name ||
    (user?.email ? user.email.split("@")[0] : "Admin");
  const initials = (displayName || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("") || "A";
  const subtitle =
    user?.municipalCouncil ||
    (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Administrator");

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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 hover:bg-slate-100 transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="leading-tight pr-1 text-left">
              <div className="text-sm font-semibold text-ink-900 max-w-[10rem] truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-ink-400 max-w-[10rem] truncate">
                {subtitle}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-ink-400 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-40"
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-ink-900 truncate">
                  {displayName}
                </div>
                {user?.email ? (
                  <div className="text-xs text-ink-500 truncate">{user.email}</div>
                ) : null}
              </div>

              {(user?.municipalCouncil || user?.coveredArea || user?.role) ? (
                <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                  {user?.municipalCouncil ? (
                    <ProfileRow icon={Building2} label="Council" value={user.municipalCouncil} />
                  ) : null}
                  {user?.coveredArea ? (
                    <ProfileRow icon={UserIcon} label="Area" value={user.coveredArea} />
                  ) : null}
                  {user?.role ? (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 uppercase tracking-wider">
                        {user.role}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProfileRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-ink-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-400">
          {label}
        </div>
        <div className="text-ink-700 truncate">{value}</div>
      </div>
    </div>
  );
}
