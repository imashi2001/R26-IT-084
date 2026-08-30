import { Trash2 } from "lucide-react";
import Card from "../Card";
import { tierBadge } from "../dashboardTheme";
import {
  bestBinFill,
  tierFromPercentage,
} from "../../../hooks/useSystemSnapshot";

const TIER_RING = {
  Empty: "#22c55e",
  Half: "#f59e0b",
  Overflow: "#ef4444",
};

function ProgressRing({ percent, color, size = 100, stroke = 10 }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90 drop-shadow-glow-brand">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#1e293b"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
    </svg>
  );
}

export default function BinFillLevelCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const pct = Number(extras.fill_percentage);
  const hasPct = Number.isFinite(pct);

  const yoloBest = bestBinFill(snapshot?.predictions);
  const tierFromYolo = yoloBest
    ? yoloBest.label.charAt(0).toUpperCase() +
      yoloBest.label.slice(1).toLowerCase()
    : null;
  const tier = tierFromYolo || tierFromPercentage(pct);
  const ringColor = tier ? TIER_RING[tier] : "#475569";

  const display = hasPct ? `${Math.round(pct)}%` : "—";
  const fullLabel = hasPct ? "Full" : tier || "—";

  return (
    <Card>
      <Card.Header
        icon={Trash2}
        title="Bin Fill Level"
        right={
          tier ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierBadge[tier] || tierBadge.Half}`}
            >
              {tier}
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        <div className="relative">
          <ProgressRing percent={hasPct ? pct : 0} color={ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{display}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {fullLabel}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {yoloBest
            ? `YOLO ${(yoloBest.confidence * 100).toFixed(0)}% confidence`
            : "From risk-derived fill estimate"}
        </p>
      </Card.Body>

      <Card.Footer>
        <span className="text-brand-400">&lt;40% Empty</span>
        <span className="mx-1 text-slate-600">·</span>
        <span className="text-amber-400">40–70% Half</span>
        <span className="mx-1 text-slate-600">·</span>
        <span className="text-red-400">≥70% Overflow</span>
      </Card.Footer>
    </Card>
  );
}
