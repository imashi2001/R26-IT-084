"use client";
import { Leaf, Recycle } from "lucide-react";
import Card from "../Card";

/*
 * Waste Classification card.
 *
 * Reads `extras.waste_label` and `extras.waste_confidence` (already produced by
 * the gateway from waste-api). Confidence is stored 0-1 in the DB; we render
 * as a 0-100 % chip and a thin progress bar.
 */

export default function WasteClassificationCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const label = (extras.waste_label || "").toString().toLowerCase();
  const confRaw = Number(extras.waste_confidence);
  const hasConf = Number.isFinite(confRaw);
  const confPct = hasConf ? Math.round(confRaw * 100) : null;

  const isOrganic = label === "organic";
  const isNonOrganic = label === "non_organic" || label === "non-organic";

  const Icon = isOrganic ? Leaf : isNonOrganic ? Recycle : Leaf;
  const accent = isOrganic
    ? "text-brand-600"
    : isNonOrganic
      ? "text-sky-600"
      : "text-ink-400";

  const headlineText = isOrganic
    ? "Organic Waste"
    : isNonOrganic
      ? "Non-Organic Waste"
      : "—";

  const headlineClass = isOrganic
    ? "text-brand-700"
    : isNonOrganic
      ? "text-sky-700"
      : "text-ink-500";

  const barColor = isOrganic
    ? "bg-brand-500"
    : isNonOrganic
      ? "bg-sky-500"
      : "bg-slate-300";

  const detailMsg = isOrganic
    ? "Organic materials detected in the bin."
    : isNonOrganic
      ? "Non-organic materials detected (recyclables / plastics)."
      : "Waiting for the next capture from waste-api.";

  return (
    <Card>
      <Card.Header icon={Icon} accent={accent} title="Waste Classification" />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        <div className={`text-2xl font-bold ${headlineClass}`}>
          {headlineText}
        </div>

        {confPct != null ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {confPct}% Confidence
          </div>
        ) : (
          <div className="mt-2 text-xs text-ink-400">No prediction yet</div>
        )}

        {confPct != null ? (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${confPct}%` }}
            />
          </div>
        ) : null}
      </Card.Body>

      <Card.Footer>{detailMsg}</Card.Footer>
    </Card>
  );
}
