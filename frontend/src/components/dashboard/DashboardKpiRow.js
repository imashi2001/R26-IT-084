import { TrendingUp, AlertTriangle, Flame, Truck } from "lucide-react";
import Card from "./Card";
import { LAYOUT } from "./dashboardTheme";
import { computeFleetStats } from "../../utils/dashboardBins";

function MiniSparkline({ points, stroke }) {
  const coords =
    points.length > 0
      ? points
          .map((v, i) => {
            const max = Math.max(...points, 1);
            const x = (i / Math.max(points.length - 1, 1)) * 72;
            const y = 20 - (v / max) * 16;
            return `${x},${y}`;
          })
          .join(" ")
      : "0,18 18,14 36,16 54,10 72,12";

  return (
    <svg viewBox="0 0 72 22" className="h-5 w-[4.5rem] shrink-0 opacity-90">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

function ProgressRing({ value, max, color, suffix = "", size = 64, stroke = 7 }) {
  const numeric = typeof value === "number" ? value : null;
  const pct =
    numeric != null && max > 0 ? Math.min(100, (numeric / max) * 100) : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#1e293b"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-white">
        {numeric != null ? `${numeric}${suffix}` : "—"}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, value, max, color, label, sub, spark, suffix }) {
  return (
    <Card compact className="min-h-[9.5rem]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/70"
            style={{ color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <MiniSparkline points={spark} stroke={color} />
        </div>

        <div className="mt-auto flex items-center gap-3 pt-3">
          <ProgressRing
            value={value}
            max={max}
            color={color}
            suffix={suffix}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-snug text-slate-100">
              {label}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {sub}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function sparkFromHistory(captures, pick) {
  return (captures || [])
    .slice(-8)
    .map(pick)
    .filter((v) => Number.isFinite(v));
}

export default function DashboardKpiRow({ devices, history }) {
  const fleet = computeFleetStats(devices);
  const fillSpark = sparkFromHistory(history, (c) =>
    Number(c.fill_percentage)
  );
  const collectionsToday = (history || []).filter((c) => {
    const t = new Date(c.captured_at);
    const now = new Date();
    return (
      t.getFullYear() === now.getFullYear() &&
      t.getMonth() === now.getMonth() &&
      t.getDate() === now.getDate()
    );
  }).length;

  return (
    <div className={LAYOUT.kpiGrid}>
      <KpiCard
        icon={TrendingUp}
        value={fleet.avgFill}
        max={100}
        color="#22c55e"
        label="Average Fill Level"
        sub="Fleet-wide average"
        spark={fillSpark}
        suffix="%"
      />
      <KpiCard
        icon={AlertTriangle}
        value={fleet.nearFull}
        max={Math.max(fleet.total, 1)}
        color="#f59e0b"
        label="Bins Near Full"
        sub="Needs attention soon"
        spark={[2, 3, 4, fleet.nearFull, fleet.nearFull]}
      />
      <KpiCard
        icon={Flame}
        value={fleet.overflow}
        max={Math.max(fleet.total, 1)}
        color="#ef4444"
        label="Overflow Bins"
        sub="Schedule collection"
        spark={[1, 2, fleet.overflow, fleet.overflow, fleet.overflow]}
      />
      <KpiCard
        icon={Truck}
        value={collectionsToday}
        max={Math.max(collectionsToday, 12, 1)}
        color="#0ea5e9"
        label="Collections Today"
        sub="Captures logged today"
        spark={[4, 6, 8, collectionsToday, collectionsToday]}
      />
    </div>
  );
}
