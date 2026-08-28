import { useState } from "react";
import { Trash2, Wifi, Bell, PawPrint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DEFAULT_HERO_PATH } from "../../hooks/useDashboardSettings";
import { computeFleetStats, greetingForHour } from "../../utils/dashboardBins";

function QuickStat({ icon: Icon, label, value, accent = "text-brand-400" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function DashboardHero({
  devices,
  alertCount,
  animalsToday,
  heroUrl,
}) {
  const auth = useAuth?.();
  const user = auth?.user;
  const name =
    user?.adminName ||
    user?.name ||
    (user?.email ? user.email.split("@")[0] : "Admin");

  const stats = computeFleetStats(devices);
  const greeting = greetingForHour();
  const src = heroUrl || DEFAULT_HERO_PATH;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section className="relative mb-5 min-h-[220px] overflow-hidden rounded-2xl border border-slate-700/60 shadow-card md:min-h-[260px]">
      {!imgFailed ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-[#0b131e]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b131e]/95 via-[#0b131e]/75 to-[#0b131e]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b131e]/80 via-transparent to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-5 md:p-6 lg:min-h-[260px]">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-400">
            {greeting}, {name}!
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[2rem]">
            Let&apos;s make our city cleaner &amp; smarter.
          </h1>
          <p className="mt-2 hidden max-w-lg text-sm text-slate-300 sm:block">
            Monitor fill levels, hygiene risk, animals, and alerts across your
            smart waste network in real time.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
          <QuickStat
            icon={Trash2}
            label="Active Bins"
            value={stats.active || stats.total || "—"}
          />
          <QuickStat
            icon={Wifi}
            label="Online"
            value={stats.online}
            accent="text-sky-400"
          />
          <QuickStat
            icon={Bell}
            label="Alerts"
            value={alertCount}
            accent="text-amber-400"
          />
          <QuickStat
            icon={PawPrint}
            label="Animals Detected"
            value={animalsToday}
            accent="text-violet-400"
          />
        </div>
      </div>

      <div className="pointer-events-none absolute -right-4 bottom-0 hidden h-full w-2/5 bg-gradient-to-l from-brand-500/10 to-transparent lg:block" />
    </section>
  );
}
