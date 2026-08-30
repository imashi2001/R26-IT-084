import { Leaf, Recycle } from "lucide-react";
import Card from "../Card";
import { badge } from "../dashboardTheme";

export default function WasteClassificationCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const label = (extras.waste_label || "").toString().toLowerCase();
  const confRaw = Number(extras.waste_confidence);
  const hasConf = Number.isFinite(confRaw);
  const confPct = hasConf ? Math.round(confRaw * 100) : null;

  const isOrganic = label === "organic";
  const isNonOrganic = label === "non_organic" || label === "non-organic";

  const Icon = isOrganic ? Leaf : Recycle;
  const accent = isOrganic
    ? "text-brand-400"
    : isNonOrganic
      ? "text-sky-400"
      : "text-slate-500";

  const organicPct = isOrganic && confPct != null ? confPct : isOrganic ? 82 : 0;
  const otherPct = isOrganic && confPct != null ? 100 - confPct : isNonOrganic ? 100 : 0;

  const donutStyle =
    isOrganic || isNonOrganic
      ? {
          background: isOrganic
            ? `conic-gradient(#22c55e 0 ${organicPct}%, #0ea5e9 ${organicPct}% ${organicPct + Math.min(12, otherPct)}%, #f59e0b ${organicPct + 12}% 100%)`
            : `conic-gradient(#0ea5e9 0 100%)`,
        }
      : { background: "#1e293b" };

  return (
    <Card>
      <Card.Header icon={Icon} accent={accent} title="Waste Classification" />

      <Card.Body className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="relative h-24 w-24 rounded-full p-2" style={donutStyle}>
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-900/95">
            {confPct != null ? (
              <>
                <span className="text-lg font-bold text-white">{confPct}%</span>
                <span className="text-[9px] uppercase text-slate-500">conf.</span>
              </>
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </div>
        </div>

        <div
          className={`text-lg font-bold ${isOrganic ? "text-brand-400" : isNonOrganic ? "text-sky-400" : "text-slate-500"}`}
        >
          {isOrganic
            ? "Organic Waste"
            : isNonOrganic
              ? "Non-Organic"
              : "Awaiting scan"}
        </div>

        {confPct != null ? (
          <span className={badge.brand}>{confPct}% Confidence Score</span>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Organic
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Recyclable
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Other
          </span>
        </div>
      </Card.Body>

      <Card.Footer>
        {isOrganic
          ? "Organic materials detected — monitor rotting risk."
          : isNonOrganic
            ? "Non-organic waste — lower rotting concern."
            : "Next capture will classify waste type."}
      </Card.Footer>
    </Card>
  );
}
