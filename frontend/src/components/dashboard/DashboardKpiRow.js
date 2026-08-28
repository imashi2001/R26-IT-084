import { TrendingUp, AlertTriangle, Flame, Truck } from "lucide-react";
import Card from "./Card";
import { computeFleetStats } from "../../utils/dashboardBins";

function MiniSparkline({ points, stroke }) {
  if (!points.length) {
    return (
      <svg viewBox="0 0 80 24" className="h-6 w-20 opacity-40">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          points="0,20 20,16 40,18 60,12 80,14"
        />
      </svg>
    );
  }
  const max = Math.max(...points, 1);
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 80;
      const y = 22 - (v / max) * 18;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        points={coords}
      />
    </svg>
  );
}

function KpiRing({ value, max, color, label, sub, icon: Icon, spark, suffix = "" }) {
  const numeric = typeof value === "number" ? value : null;
  const pct = numeric != null && max > 0 ? Math.min(100, (numeric / max) * 100) : 0;
  const size = 72;
  const strokeW = 8;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <Card className="min-h-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/80">
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <MiniSparkline points={spark} stroke={color} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#1e293b"
              strokeWidth={strokeW}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={strokeW}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
            {numeric != null ? `${numeric}${suffix}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-200">{label}</div>
          <div className="text-xs text-slate-500">{sub}</div>
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
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiRing
        icon={TrendingUp}
        value={fleet.avgFill}
        max={100}
        color="#22c55e"
        label="Average Fill Level"
        sub="Fleet-wide average"
        spark={fillSpark}
        suffix="%"
      />
      <KpiRing
        icon={AlertTriangle}
        value={fleet.nearFull}
        max={Math.max(fleet.total, 1)}
        color="#f59e0b"
        label="Bins Near Full"
        sub="Needs attention soon"
        spark={[2, 3, 4, fleet.nearFull, fleet.nearFull]}
      />
      <KpiRing
        icon={Flame}
        value={fleet.overflow}
        max={Math.max(fleet.total, 1)}
        color="#ef4444"
        label="Overflow Bins"
        sub="Schedule collection"
        spark={[1, 2, fleet.overflow, fleet.overflow, fleet.overflow]}
      />
      <KpiRing
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
