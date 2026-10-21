"use client";
import { useMemo } from "react";
import { Link } from "@/lib/react-router-compat";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import Card from "../Card";
import computeRiskScore from "../../../utils/riskScore";

/*
 * Risk Trend (7 days) card.
 *
 * Buckets the last 7 days of captures into per-day groups and plots the
 * AVERAGE 0-100 risk score (computed via utils/riskScore.js so the bands stay
 * consistent with the Hygienic Risk Level card).
 *
 * Days with no captures get null so the line connects across gaps cleanly.
 *
 * Falls back to a clear empty-state when DB is off or there are <2 days of
 * data to plot a line.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = { en: { month: "short", day: "numeric" } };

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function build7DaySeries(captures) {
  const today = startOfDay(new Date());
  const buckets = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    buckets.push({
      ts: day.getTime(),
      label: day.toLocaleDateString([], DAY_LABELS.en),
      sum: 0,
      n: 0,
    });
  }

  for (const c of captures) {
    const t = startOfDay(c.captured_at).getTime();
    const slot = buckets.find((b) => b.ts === t);
    if (!slot) continue;
    const r = computeRiskScore({
      risk_level: c.risk_level,
      rotting_hours: c.rotting_hours,
      temp_c: c.temp_c,
      humidity_pct: c.humidity_pct,
      animal_count: c.animal_count,
      waste_label: c.waste_label,
    });
    if (r) {
      slot.sum += r.score;
      slot.n += 1;
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    score: b.n > 0 ? Math.round(b.sum / b.n) : null,
    samples: b.n,
  }));
}

export default function RiskTrend7dCard({ history, dbDisabled }) {
  const series = useMemo(() => build7DaySeries(history || []), [history]);
  const daysWithData = series.filter((d) => d.score != null).length;

  return (
    <Card className="min-h-[320px]">
      <Card.Header
        icon={TrendingUp}
        accent="text-brand-600"
        title="Risk Trend (7 Days)"
        right={
          <Link
            to="/reports"
            className="text-[11px] font-semibold text-brand-600 hover:underline"
          >
            View Report
          </Link>
        }
      />

      <Card.Body className="flex flex-col">
        {dbDisabled ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-500">
            DB off — trend appears once captures are persisted.
          </div>
        ) : daysWithData < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-500">
            {daysWithData === 0
              ? "No captures in the last 7 days."
              : "Need at least 2 days of data to draw a trend."}
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
              >
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, padding: "6px 10px" }}
                  formatter={(value, _, { payload }) =>
                    value == null
                      ? ["—", "Risk score"]
                      : [`${value}/100 (${payload.samples} captures)`, "Risk score"]
                  }
                />
                <ReferenceLine
                  y={70}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
                <ReferenceLine
                  y={40}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 3, stroke: "#22c55e", fill: "#fff" }}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>

      <Card.Footer>
        Daily average · dashed lines mark MEDIUM (40) and HIGH (70) bands.
      </Card.Footer>
    </Card>
  );
}
