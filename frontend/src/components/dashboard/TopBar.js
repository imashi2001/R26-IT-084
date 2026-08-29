import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  CloudSun,
  Droplets,
  Bell,
  Menu,
  ChevronDown,
  Thermometer,
  TrendingUp,
  ScanSearch,
  LogOut,
  User as UserIcon,
  Building2,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";
import { useAuth } from "../../context/AuthContext";
import useAlertBadgeCount from "../../hooks/useAlertBadgeCount";

function StatChip({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80">
        <Icon className="h-4 w-4 text-brand-400" />
      </div>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-100">{value || "—"}</div>
        {sub ? <div className="text-[10px] text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function useCurrentWeather(intervalMs = 60_000) {
  const [w, setW] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function pollWeather() {
      try {
        const { data } = await axios.get(apiUrl("/weather"), { timeout: 5000 });
        if (cancelled || !data) return;
        setW({
          temp_c: data.temp_c ?? null,
          humidity_pct: data.humidity_pct ?? null,
          condition: data.condition ?? null,
        });
      } catch {
        try {
          const { data: latest } = await axios.get(apiUrl("/latest"), {
            timeout: 5000,
          });
          if (cancelled) return;
          const extras = latest?.extras || {};
          if (
            extras.temp_c != null ||
            extras.humidity_pct != null ||
            extras.weather_condition != null
          ) {
            setW({
              temp_c: extras.temp_c ?? null,
              humidity_pct: extras.humidity_pct ?? null,
              condition: extras.weather_condition ?? null,
            });
          }
        } catch {
          /* keep prior */
        }
      }
    }

    pollWeather();
    const t = setInterval(pollWeather, intervalMs);
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
  const initials =
    (displayName || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join("") || "A";
  const subtitle =
    user?.municipalCouncil ||
    (user?.role
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
      : "Administrator");

  const weather = useCurrentWeather();
  const alertCount = useAlertBadgeCount();

  const dateText = now.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString([], { hour12: true });

  const tempText = weather?.temp_c != null ? `${weather.temp_c}°C` : "—";
  const humText =
    weather?.humidity_pct != null
      ? `${Math.round(weather.humidity_pct)}%`
      : "—";
  const condText = weather?.condition || "—";

  return (
    <header className="relative z-20 flex min-h-[4rem] flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 py-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <StatChip icon={Calendar} label="Today" value={dateText} />
        <StatChip icon={Clock} label="Time" value={timeText} />
        <StatChip icon={Thermometer} label="Temp" value={tempText} />
        <StatChip icon={Droplets} label="Humidity" value={humText} />
        <StatChip icon={CloudSun} label="Weather" value={condText} sub="Colombo" />
      </div>

      <div className="flex items-center gap-2 pl-2">
        <Link
          to="/litter-severity"
          className="hidden items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white md:inline-flex"
        >
          <ScanSearch className="h-4 w-4 shrink-0" />
          Litter
        </Link>
        <Link
          to="/forecast"
          className="hidden items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 sm:inline-flex"
        >
          <TrendingUp className="h-4 w-4 shrink-0" />
          Tourism forecast
        </Link>

        <Link
          to="/alerts"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/60 text-slate-400 hover:text-slate-200"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          ) : null}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-2 py-1.5 transition hover:border-slate-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white shadow-glow-brand">
              {initials}
            </div>
            <div className="hidden leading-tight pr-1 text-left sm:block">
              <div className="max-w-[10rem] truncate text-sm font-semibold text-slate-100">
                {displayName}
              </div>
              <div className="max-w-[10rem] truncate text-[11px] text-slate-500">
                {subtitle}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-card"
            >
              <div className="border-b border-slate-800 px-4 py-3">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {displayName}
                </div>
                {user?.email ? (
                  <div className="truncate text-xs text-slate-500">
                    {user.email}
                  </div>
                ) : null}
              </div>

              {(user?.municipalCouncil || user?.coveredArea || user?.role) && (
                <div className="space-y-2 border-b border-slate-800 px-4 py-3">
                  {user?.municipalCouncil ? (
                    <ProfileRow
                      icon={Building2}
                      label="Council"
                      value={user.municipalCouncil}
                    />
                  ) : null}
                  {user?.coveredArea ? (
                    <ProfileRow
                      icon={UserIcon}
                      label="Area"
                      value={user.coveredArea}
                    />
                  ) : null}
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
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
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="truncate text-slate-300">{value}</div>
      </div>
    </div>
  );
}
