import { useEffect, useState } from "react";
import { Trash2, Wifi, Bell, PawPrint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { computeFleetStats, greetingForHour } from "../../utils/dashboardBins";

function QuickStat({ icon: Icon, label, value, accent = "text-brand-400" }) {
  return (
    <div className="flex min-h-[4.5rem] flex-col justify-center rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
        {value}
      </div>
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
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [heroUrl]);

  const hasImage = Boolean(heroUrl) && !imgFailed;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-700/50 shadow-card">
      <div className="relative min-h-[12rem] md:min-h-[14rem] lg:min-h-[16rem]">
        {hasImage ? (
          <img
            key={heroUrl}
            src={heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center md:object-right"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-[#0b131e]" />
        )}

        {/* Text readable on left; image visible on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b131e] via-[#0b131e]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b131e]/85 via-[#0b131e]/20 to-transparent" />

        <div className="relative flex min-h-[12rem] flex-col justify-between gap-6 p-5 md:min-h-[14rem] md:p-6 lg:min-h-[16rem]">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-brand-400">
              {greeting}, {name}!
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
              Let&apos;s make our city cleaner &amp; smarter.
            </h1>
            <p className="mt-2 hidden text-sm leading-relaxed text-slate-300 md:block">
              Real-time fill levels, risk scores, and alerts across your smart
              waste network.
            </p>
            {!hasImage ? (
              <p className="mt-2 text-xs text-slate-500">
                Upload a hero banner in Settings → Dashboard Hero Image.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
      </div>
    </section>
  );
}
