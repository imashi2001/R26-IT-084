"use client";
import { PawPrint, Check } from "lucide-react";
import Card from "../Card";
import { partitionPredictions } from "../../../hooks/useSystemSnapshot";

/*
 * Animal Detection card.
 *
 * Two visual states:
 *   - count > 0  : show count + per-class chips with confidence
 *   - count == 0 : "No Animal Attacks Detected" with green check
 *
 * Source of truth for count is `extras.animal_count` (set by the gateway from
 * the YOLO animal microservice). The chips come from `predictions[]` filtered
 * to animal labels (anything that's not Empty/Half/Overflow).
 */

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
    <Card>
      <Card.Header
        icon={PawPrint}
        accent={danger ? "text-red-600" : "text-brand-600"}
        title="Animal Detection"
        right={
          count != null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                danger
                  ? "bg-red-50 text-red-700"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              {count} detected
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        {safe ? (
          <>
            <div className="text-xl font-bold text-brand-700">
              No Animal Attacks Detected
            </div>
            <div className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
              <Check className="h-4 w-4" strokeWidth={3} />
            </div>
          </>
        ) : danger ? (
          <>
            <div className="text-2xl font-bold text-red-700">
              {count} animal{count > 1 ? "s" : ""} detected
            </div>
            {classes.length ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {classes.slice(0, 4).map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700"
                  >
                    {c.label} · {(c.confidence * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-ink-400 text-sm">No detection yet</div>
        )}
      </Card.Body>

      <Card.Footer>
        {safe
          ? "No animals detected around the bin."
          : danger
            ? "Activate deterrence and verify on the live feed."
            : "Waiting for the next capture from animal-api."}
      </Card.Footer>
    </Card>
  );
}
