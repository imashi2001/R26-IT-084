import { ShieldAlert, Smile, Meh, Frown, AlertOctagon } from "lucide-react";
import Card from "../Card";
import computeRiskScore, { RISK_TONE } from "../../../utils/riskScore";

/*
 * Hygienic Risk Level card.
 *
 * - Headline: LOW / MEDIUM / HIGH / CRITICAL with a face icon.
 * - Score: 0-100 derived in `utils/riskScore.js` (engine stays untouched).
 * - Bar: thin progress bar showing the score within its band.
 * - Footer: risk case key + short status word.
 */

const FACE_BY_TONE = {
  low: Smile,
  medium: Meh,
  high: Frown,
  critical: AlertOctagon,
};

const STATUS_WORD = {
  low: "Safe",
  medium: "Watch",
  high: "Action needed",
  critical: "Urgent",
};

export default function HygienicRiskLevelCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const result = computeRiskScore(extras);
  const tone = result?.tone;
  const theme = tone ? RISK_TONE[tone] : null;
  const Face = tone ? FACE_BY_TONE[tone] : null;

  const message = extras.risk_case
    ? `Case: ${extras.risk_case}`
    : "No risk evaluation yet.";

  return (
    <Card>
      <Card.Header
        icon={ShieldAlert}
        accent={tone === "high" || tone === "critical" ? "text-red-600" : "text-brand-600"}
        title="Hygienic Risk Level"
        right={
          result ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.chipBg} ${theme.chipFg}`}
            >
              {STATUS_WORD[tone]}
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col items-center text-center">
        {result ? (
          <>
            <div className="flex items-center gap-2">
              {Face ? <Face className="h-5 w-5" style={{ color: theme.ring }} /> : null}
              <div
                className="text-2xl font-extrabold"
                style={{ color: theme.ring }}
              >
                {result.band} RISK
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-ink-900">
                {result.score}
              </span>
              <span className="text-sm text-ink-400">/ 100</span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${theme.barBg}`}
                style={{ width: `${result.score}%` }}
              />
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-400">No risk evaluation yet.</div>
        )}
      </Card.Body>

      <Card.Footer>{message}</Card.Footer>
    </Card>
  );
}
