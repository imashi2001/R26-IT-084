import { Leaf, Trash2, Wifi, Bell, PawPrint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { computeFleetStats, greetingForHour } from "../../utils/dashboardBins";

function QuickStat({ icon: Icon, label, value, accent = "text-brand-400" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 py-3 backdrop-blur-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/80">
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

export default function DashboardHero({
  devices,
  alertCount,
  animalsToday,
}) {
  const auth = useAuth?.();
  const user = auth?.user;
  const name =
    user?.adminName ||
    user?.name ||
    (user?.email ? user.email.split("@")[0] : "Admin");

  const stats = computeFleetStats(devices);
  const greeting = greetingForHour();

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-brand-950/30 p-5 shadow-card md:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium text-brand-400">
            {greeting}, {name}!
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Let&apos;s make our city cleaner &amp; smarter.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Real-time monitoring across your waste network — fill levels, risk,
            animals, and alerts in one place.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              label="Animals Today"
              value={animalsToday}
              accent="text-violet-400"
            />
          </div>
        </div>

        <div className="relative mx-auto hidden h-36 w-56 shrink-0 lg:block xl:h-44 xl:w-64">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/20 via-emerald-900/30 to-slate-950/80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow-brand">
              <Trash2 className="h-10 w-10 text-white" />
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-brand-400">
              <Leaf className="h-3.5 w-3.5" />
              Smart bins online
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
