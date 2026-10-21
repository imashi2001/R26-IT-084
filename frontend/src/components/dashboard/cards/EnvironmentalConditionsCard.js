import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from "recharts";
import { Thermometer, Droplets, Wind } from "lucide-react";
import Card from "../Card";
import { CHART } from "../dashboardTheme";

function buildSeries(captures) {
  return captures
    .map((c) => ({
      ts: new Date(c.captured_at).getTime(),
      temp: Number(c.temp_c),
      hum: Number(c.humidity_pct),
    }))
    .filter((p) => Number.isFinite(p.ts));
}

function MiniLine({ data, dataKey, stroke, label, suffix }) {
  const latest = data.length ? data[data.length - 1][dataKey] : null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-2">
      <div className="w-20 shrink-0 leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-base font-bold text-white">
          {latest != null && Number.isFinite(latest)
            ? `${Math.round(latest)}${suffix}`
            : "—"}
        </div>
      </div>
      <div className="h-12 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip
              cursor={false}
              contentStyle={CHART.tooltip}
              formatter={(value) => [`${Math.round(value)}${suffix}`, label]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function EnvironmentalConditionsCard({
  snapshot,
  history,
  dbDisabled,
}) {
  const series = buildSeries(history || []);
  const tempSeries = series.filter((p) => Number.isFinite(p.temp));
  const humSeries = series.filter((p) => Number.isFinite(p.hum));

  const liveTemp = Number(snapshot?.extras?.temp_c);
  const liveHum = Number(snapshot?.extras?.humidity_pct);

  const tempData =
    tempSeries.length >= 2
      ? tempSeries
      : Number.isFinite(liveTemp)
        ? [{ ts: Date.now(), temp: liveTemp }]
        : [];
  const humData =
    humSeries.length >= 2
      ? humSeries
      : Number.isFinite(liveHum)
        ? [{ ts: Date.now(), hum: liveHum }]
        : [];

  return (
    <Card>
      <Card.Header
        icon={Thermometer}
        accent="text-amber-400"
        title="Environmental Conditions"
        right={<Droplets className="h-4 w-4 text-sky-400" aria-hidden />}
      />

      <Card.Body className="flex flex-col gap-2">
        <MiniLine
          data={tempData}
          dataKey="temp"
          stroke="#f97316"
          label="Temperature"
          suffix="°C"
        />
        <MiniLine
          data={humData}
          dataKey="hum"
          stroke="#0ea5e9"
          label="Humidity"
          suffix="%"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Wind className="h-3 w-3" /> Air quality: Good
          </span>
          <span>Wind ~12 km/h</span>
        </div>
      </Card.Body>

      <Card.Footer>
        {dbDisabled
          ? "Live snapshot only — enable DATABASE_URL for 24h trends."
          : `${series.length} reading${series.length === 1 ? "" : "s"} in last 24h`}
      </Card.Footer>
    </Card>
  );
}
