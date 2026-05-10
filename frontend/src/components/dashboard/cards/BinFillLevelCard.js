import { Trash2 } from "lucide-react";
import Card from "../Card";
import {
  bestBinFill,
  tierFromPercentage,
} from "../../../hooks/useSystemSnapshot";

/*
 * Bin Fill Level card.
 *
 * Resolves the tier (Empty / Half / Overflow) using two signals, in order:
 *   1. Highest-confidence bin_fill prediction in `predictions[]` (if YOLO ran).
 *   2. Tier derived from `extras.fill_percentage` (numeric fallback).
 *
 * Renders a circular progress ring (SVG) sized to fill_percentage, colored by
 * tier (green / amber / red) so it reads at a glance like the mockup.
 */

const TIER_THEME = {
  Empty: {
    ring: "#22c55e",
    bg: "bg-brand-50",
    text: "text-brand-700",
    label: "Empty",
  },
  Half: {
    ring: "#f59e0b",
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Half",
  },
  Overflow: {
    ring: "#ef4444",
    bg: "bg-red-50",
    text: "text-red-700",
    label: "Overflow",
  },
};

function ProgressRing({ percent, color, size = 92, stroke = 9 }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#e2e8f0"
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
  const theme = tier ? TIER_THEME[tier] : null;

  const ringColor = theme?.ring || "#cbd5e1";
  const display = hasPct ? `${Math.round(pct)}%` : "—";
  const sub = tierFromYolo
    ? `YOLO ${(yoloBest.confidence * 100).toFixed(0)}% · ${tier}`
    : tier
      ? `Derived from fill %`
      : "No fill reading";

  return (
    <Card>
      <Card.Header
        icon={Trash2}
        title="Bin Fill Level"
        right={
          theme ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.bg} ${theme.text}`}
            >
              {theme.label}
            </span>
          ) : null
        }
      />

      <Card.Body className="flex items-center gap-4">
        <div className="relative shrink-0">
          <ProgressRing percent={hasPct ? pct : 0} color={ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold text-ink-900">{display}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-ink-900">
            {tier || "—"}
          </div>
          <div className="mt-1 text-xs text-ink-500">{sub}</div>
        </div>
      </Card.Body>

      <Card.Footer>
        Bands: <span className="text-brand-600">Empty &lt;40%</span> ·{" "}
        <span className="text-amber-600">Half 40-70%</span> ·{" "}
        <span className="text-red-600">Overflow ≥70%</span>
      </Card.Footer>
    </Card>
  );
}
