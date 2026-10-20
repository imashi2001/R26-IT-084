import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { CHART } from "../../dashboard/dashboardTheme";

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Daily average LSI (line) with HIGH readings and confirmed littering (bars). */
export default function LitterTrendChart({ daily }) {
  const data = (daily || []).map((d) => ({ ...d, label: shortDate(d.date) }));
  const daysWithData = data.filter((d) => d.captures > 0 || d.events > 0).length;

  if (daysWithData === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-500">
        No litter readings in this range.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            yAxisId="lsi"
            domain={[0, 100]}
            ticks={[0, 30, 53, 100]}
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={CHART.tooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="lsi" y={53} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine yAxisId="lsi" y={30} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Bar yAxisId="count" dataKey="high" name="HIGH readings" fill="#ef4444" fillOpacity={0.45} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="count" dataKey="events" name="Confirmed littering" fill="#f97316" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="lsi"
            type="monotone"
            dataKey="avg_lsi"
            name="Avg LSI"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={{ r: 2.5, stroke: "#22c55e", fill: "#0f172a", strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
