import { Link } from "react-router-dom";
import { PawPrint, Check, AlertTriangle } from "lucide-react";
import Card from "../Card";
import { badge } from "../dashboardTheme";
import { partitionPredictions } from "../../../hooks/useSystemSnapshot";

function aggregateClasses(predictions) {
  const map = new Map();
  for (const p of predictions) {
    const k = String(p.label || "animal").toLowerCase();
    const prev = map.get(k);
    if (!prev || Number(p.confidence) > Number(prev.confidence)) {
      map.set(k, { label: k, confidence: Number(p.confidence) || 0 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

export default function AnimalDetectionCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const countRaw = extras.animal_count;
  const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : null;

  const { animals } = partitionPredictions(snapshot?.predictions);
  const classes = aggregateClasses(animals);

  const safe = count === 0;
  const danger = count != null && count > 0;

  return (
    <Card glow={danger}>
      <Card.Header
        icon={PawPrint}
        accent={danger ? "text-red-400" : "text-brand-400"}
        title="Animal Detection"
        right={
          count != null ? (
            <span className={danger ? badge.danger : badge.brand}>
              {count} detected
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        {safe ? (
          <>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 shadow-glow-brand">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
            <div className="mt-3 text-base font-bold text-brand-400">
              No animals detected
            </div>
            <p className="mt-1 text-xs text-slate-500">Bin perimeter is clear</p>
          </>
        ) : danger ? (
          <>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 shadow-glow-red">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="mt-3 text-xl font-bold text-red-300">
              {count} animal{count > 1 ? "s" : ""} near bin
            </div>
            {classes.length ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {classes.slice(0, 3).map((c) => (
                  <span key={c.label} className={badge.danger}>
                    {c.label} · {(c.confidence * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            ) : null}
            <Link
              to="/animals"
              className="mt-3 text-xs font-semibold text-brand-400 hover:underline"
            >
              View details →
            </Link>
          </>
        ) : (
          <div className="text-sm text-slate-500">Waiting for detection…</div>
        )}
      </Card.Body>

      <Card.Footer>
        {danger
          ? "High hygienic risk — audio deterrence may trigger automatically."
          : safe
            ? "No animal activity in the latest capture."
            : "Powered by animal-api YOLO detections."}
      </Card.Footer>
    </Card>
  );
}
