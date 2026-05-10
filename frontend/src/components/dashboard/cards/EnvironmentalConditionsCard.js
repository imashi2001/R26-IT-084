import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from "recharts";
import { Thermometer, Droplets } from "lucide-react";
import Card from "../Card";

/*
 * Environmental Conditions card.
 *
 * Two stacked sparklines:
 *   - Temperature (orange) for the last 24 h
 *   - Humidity   (blue)   for the last 24 h
 *
 * Data source: `last24h` slice from useCaptureHistory. Each point is one
 * persisted capture (gateway calls weather.getCurrentWeather inside /predict).
 *
 * Fallbacks:
 *   - dbDisabled or no history -> render the most recent values from the live
 *     snapshot as a single value, no chart, with an explanatory tag.
 *   - <2 points              -> same single-point fallback.
 */

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
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 leading-tight">
        <div className="text-[11px] text-ink-400">{label}</div>
        <div className="text-base font-bold text-ink-900">
          {data.length
            ? `${Math.round(data[data.length - 1][dataKey])}${suffix}`
            : "—"}
        </div>
      </div>
      <div className="h-12 flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip
              cursor={false}
              contentStyle={{ fontSize: 11, padding: "4px 8px" }}
              formatter={(value) => [`${Math.round(value)}${suffix}`, label]}
              labelFormatter={(_, payload) => {
                const t = payload?.[0]?.payload?.ts;
                return t
                  ? new Date(t).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
              }}
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

  const noHistory = tempSeries.length < 2 && humSeries.length < 2;

  return (
    <Card>
      <Card.Header
        icon={Thermometer}
        accent="text-amber-500"
        title="Environmental Conditions"
        right={
          <Droplets className="h-4 w-4 text-sky-500" aria-hidden="true" />
        }
      />

      <Card.Body className="flex flex-col gap-3">
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
      </Card.Body>

      <Card.Footer>
        {dbDisabled
          ? "DB off — showing live snapshot only. Set DATABASE_URL for 24h history."
          : noHistory
            ? "Less than 2 captures in the last 24h — line will fill in as bins report."
            : `${series.length} reading${series.length === 1 ? "" : "s"} in the last 24h.`}
      </Card.Footer>
    </Card>
  );
}
