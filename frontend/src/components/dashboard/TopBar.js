import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  CloudSun,
  Droplets,
  Bell,
  Menu,
  ChevronDown,
  ChevronRight,
  Thermometer,
  TrendingUp,
  ScanSearch,
  UserRoundX,
  LogOut,
  User as UserIcon,
  Building2,
  MapPin,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";
import { useAuth } from "../../context/AuthContext";
import useAlertBadgeCount from "../../hooks/useAlertBadgeCount";
import { NAV_ITEMS } from "./Sidebar";

const QUICK_LINKS = [
  {
    to: "/littering-event",
    icon: UserRoundX,
    label: "Littering",
    active: "bg-orange-500/15 text-orange-300",
    idle: "hover:text-orange-300",
  },
  {
    to: "/litter-severity",
    icon: ScanSearch,
    label: "LSI",
    active: "bg-sky-500/15 text-sky-300",
    idle: "hover:text-sky-300",
  },
  {
    to: "/forecast",
    icon: TrendingUp,
    label: "Tourism forecast",
    active: "bg-violet-500/15 text-violet-300",
    idle: "hover:text-violet-300",
  },
];

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
          source: data.source ?? null,
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
              source: null,
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

function usePageTitle() {
  const { pathname } = useLocation();
  const match = NAV_ITEMS.filter(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  ).sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label || "Dashboard";
}

function InfoItem({ icon: Icon, children, title, className = "" }) {
  return (
    <div
      className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}
      title={title}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span className="text-[13px] font-medium tabular-nums text-slate-200">
        {children}
      </span>
    </div>
  );
}

function Divider({ className = "" }) {
  return <span className={`h-5 w-px shrink-0 bg-slate-800 ${className}`} aria-hidden />;
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
  const pageTitle = usePageTitle();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeText = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isDemoWeather = String(weather?.source || "").startsWith("stub");
  const tempText = weather?.temp_c != null ? `${Math.round(weather.temp_c)}°C` : "—";
  const humText =
    weather?.humidity_pct != null ? `${Math.round(weather.humidity_pct)}%` : "—";
  const condText = isDemoWeather ? null : weather?.condition || null;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 bg-[#0b131e]/85 px-4 backdrop-blur-xl md:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <div className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 sm:flex">
          <span>VisionWaste</span>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate">{pageTitle}</span>
        </div>
        <h1 className="truncate text-base font-semibold leading-tight text-slate-100">
          {pageTitle}
        </h1>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        <div className="hidden h-10 items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3.5 lg:flex">
          <InfoItem icon={Calendar}>{dateText}</InfoItem>
          <InfoItem icon={Clock}>{timeText}</InfoItem>
          <Divider className="hidden xl:block" />
          <InfoItem
            icon={Thermometer}
            className="hidden xl:flex"
            title={isDemoWeather ? "Simulated weather — set OPENWEATHER_API_KEY for live data" : "Temperature"}
          >
            {tempText}
          </InfoItem>
          <InfoItem icon={Droplets} className="hidden xl:flex" title="Humidity">
            {humText}
          </InfoItem>
          <div
            className="hidden items-center gap-1.5 whitespace-nowrap 2xl:flex"
            title="Weather · Colombo"
          >
            <CloudSun className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            {condText ? (
              <span className="text-[13px] font-medium text-slate-200">{condText}</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-slate-200">
                <MapPin className="h-3 w-3 text-slate-500" />
                Colombo
              </span>
            )}
            {isDemoWeather ? (
              <span
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-400"
                title="Simulated weather — set OPENWEATHER_API_KEY for live data"
              >
                Demo
              </span>
            ) : null}
          </div>
        </div>

        <nav
          className="hidden h-10 items-center gap-0.5 rounded-xl border border-slate-800/80 bg-slate-900/50 p-1 md:flex"
          aria-label="Quick links"
        >
          {QUICK_LINKS.map(({ to, icon: Icon, label, active, idle }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                [
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition",
                  isActive ? active : `text-slate-400 hover:bg-slate-800/70 ${idle}`,
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden whitespace-nowrap min-[1760px]:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <Divider className="hidden md:block" />

        <Link
          to="/alerts"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-100"
          aria-label={alertCount > 0 ? `Notifications (${alertCount})` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0b131e]">
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
            className={`flex h-10 items-center gap-2.5 rounded-xl pl-1 pr-2 transition hover:bg-slate-800/70 ${
              menuOpen ? "bg-slate-800/70" : ""
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white ring-2 ring-brand-500/25">
              {initials}
            </div>
            <div className="hidden text-left leading-tight xl:block">
              <div className="max-w-[10rem] truncate text-[13px] font-semibold text-slate-100">
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
              <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {displayName}
                  </div>
                  {user?.email ? (
                    <div className="truncate text-xs text-slate-500">
                      {user.email}
                    </div>
                  ) : null}
                </div>
              </div>

              {(user?.municipalCouncil || user?.coveredArea) && (
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
