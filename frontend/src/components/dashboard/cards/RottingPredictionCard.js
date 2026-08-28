import { Droplet, Leaf } from "lucide-react";
import Card from "../Card";

function bandFromHours(h) {
  if (!Number.isFinite(h)) return null;
  if (h >= 18)
    return { color: "bg-brand-500", txt: "text-brand-400", lbl: "Plenty of time" };
  if (h >= 8)
    return { color: "bg-amber-500", txt: "text-amber-400", lbl: "Collect today" };
  return { color: "bg-red-500", txt: "text-red-400", lbl: "Collect soon" };
}

export default function RottingPredictionCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const hRaw = Number(extras.rotting_hours);
  const hasH = Number.isFinite(hRaw) && hRaw >= 0;
  const isOrganic = String(extras.waste_label || "").toLowerCase() === "organic";
  const band = hasH ? bandFromHours(hRaw) : null;
  const days = hasH ? Math.max(1, Math.round(hRaw / 24)) : null;
  const meterPct = hasH
    ? Math.max(8, Math.min(100, (Math.min(hRaw, 24) / 24) * 100))
    : 0;

  return (
    <Card>
      <Card.Header
        icon={Droplet}
        accent="text-sky-400"
        title="Rotting Prediction"
        right={
          band ? (
            <span className={`text-[11px] font-semibold ${band.txt}`}>
              {band.lbl}
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        {hasH ? (
          <>
            <div className="text-xs text-slate-500">
              Estimated days to rotting
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="text-4xl font-bold text-white">{days}</span>
              <span className="text-sm text-slate-400">
                day{days !== 1 ? "s" : ""}
              </span>
              <Leaf className="h-4 w-4 text-brand-400" />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              ~{Math.round(hRaw)} hours remaining window
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${band ? band.color : "bg-slate-600"}`}
                style={{ width: `${meterPct}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Confidence from temp + humidity model
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold text-slate-400">
              {isOrganic ? "—" : "N/A"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {isOrganic
                ? "Waiting for rotting estimate."
                : "Non-organic waste — not applicable."}
            </div>
          </>
        )}
      </Card.Body>

      <Card.Footer>Based on current temperature and humidity.</Card.Footer>
    </Card>
  );
}
