import { Droplet, Leaf } from "lucide-react";
import Card from "../Card";

/*
 * Rotting Prediction card.
 *
 * `extras.rotting_hours` is the engine's estimate of when ORGANIC waste will
 * start to rot. For non-organic captures the engine returns null/skip; we
 * treat that as "not applicable" rather than 0 so the card never lies.
 *
 * Display:
 *   - Big "X hours" headline (or "—" / "N/A").
 *   - Small label explaining the source.
 *   - Tiny meter showing how close to rot we are (24h scale).
 */

function bandFromHours(h) {
  if (!Number.isFinite(h)) return null;
  if (h >= 18) return { color: "bg-brand-500", txt: "text-brand-700", lbl: "Plenty of time" };
  if (h >= 8) return { color: "bg-amber-500", txt: "text-amber-700", lbl: "Collect within the day" };
  return { color: "bg-red-500", txt: "text-red-700", lbl: "Collect soon" };
}

export default function RottingPredictionCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const hRaw = Number(extras.rotting_hours);
  const hasH = Number.isFinite(hRaw) && hRaw >= 0;
  const isOrganic = String(extras.waste_label || "").toLowerCase() === "organic";
  const band = hasH ? bandFromHours(hRaw) : null;

  // Meter caps at 24h — anything longer is "plenty of time".
  const meterPct = hasH ? Math.max(8, Math.min(100, (Math.min(hRaw, 24) / 24) * 100)) : 0;

  return (
    <Card>
      <Card.Header
        icon={Droplet}
        accent="text-sky-500"
        title="Rotting Prediction"
        right={
          band ? (
            <span className={`text-[11px] font-semibold ${band.txt}`}>{band.lbl}</span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        {hasH ? (
          <>
            <div className="text-xs text-ink-500">
              Estimated time for organic waste to start rotting
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold text-ink-900">
                {Math.round(hRaw)}
              </span>
              <span className="text-sm text-ink-400">Hours</span>
              <Leaf className="h-4 w-4 text-brand-500" />
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${band ? band.color : "bg-slate-300"}`}
                style={{ width: `${meterPct}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-base font-semibold text-ink-700">
              {isOrganic ? "—" : "N/A"}
            </div>
            <div className="mt-1 text-xs text-ink-400">
              {isOrganic
                ? "No rotting estimate from engine."
                : "Non-organic waste — rotting model not applicable."}
            </div>
          </>
        )}
      </Card.Body>

      <Card.Footer>Based on current temperature and humidity.</Card.Footer>
    </Card>
  );
}
