import { ShieldAlert, Smile, Meh, Frown, AlertOctagon } from "lucide-react";
import Card from "../Card";
import computeRiskScore, { RISK_TONE } from "../../../utils/riskScore";

const FACE_BY_TONE = {
  low: Smile,
  medium: Meh,
  high: Frown,
  critical: AlertOctagon,
};

const STATUS_WORD = {
  low: "Safe",
  medium: "Watch",
  high: "High Risk",
  critical: "Critical",
};

function RiskGauge({ score, color }) {
  const pct = Math.max(0, Math.min(100, score));
  const rotation = -90 + (pct / 100) * 180;
  return (
    <div className="relative mx-auto h-20 w-40 overflow-hidden">
      <div
        className="absolute bottom-0 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-full border-[10px] border-slate-800"
        style={{
          borderBottomColor: "transparent",
          background: `conic-gradient(from 180deg at 50% 100%, #22c55e 0deg, #f59e0b 72deg, #ef4444 144deg, #ef4444 180deg)`,
          WebkitMaskImage:
            "radial-gradient(circle at 50% 100%, transparent 58%, black 59%)",
          maskImage:
            "radial-gradient(circle at 50% 100%, transparent 58%, black 59%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-14 w-0.5 origin-bottom -translate-x-1/2 rounded-full bg-white shadow-lg transition-transform duration-700"
        style={{
          transform: `translateX(-50%) rotate(${rotation}deg)`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
        <div className="text-2xl font-bold text-white">{score}</div>
        <div className="text-[10px] text-slate-500">/ 100</div>
      </div>
    </div>
  );
}

export default function HygienicRiskLevelCard({ snapshot }) {
  const extras = snapshot?.extras || {};
  const result = computeRiskScore(extras);
  const tone = result?.tone;
  const theme = tone ? RISK_TONE[tone] : null;
  const Face = tone ? FACE_BY_TONE[tone] : null;

  return (
    <Card glow={tone === "high" || tone === "critical"}>
      <Card.Header
        icon={ShieldAlert}
        accent={
          tone === "high" || tone === "critical"
            ? "text-red-400"
            : "text-brand-400"
        }
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
              {Face ? (
                <Face className="h-5 w-5" style={{ color: theme.ring }} />
              ) : null}
              <div
                className="text-lg font-extrabold tracking-wide"
                style={{ color: theme.ring }}
              >
                {result.band} RISK
              </div>
            </div>
            <RiskGauge score={result.score} color={theme.ring} />
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${theme.barBg}`}
                style={{
                  width: `${result.score}%`,
                  boxShadow: `0 0 8px ${theme.ring}66`,
                }}
              />
            </div>
          </>
        ) : (
          <div className="py-8 text-sm text-slate-500">
            No risk evaluation yet.
          </div>
        )}
      </Card.Body>

      <Card.Footer>
        {extras.risk_case ? (
          <span className="text-red-400">
            Immediate attention recommended · {extras.risk_case}
          </span>
        ) : (
          "Risk computed from waste, animals, and weather."
        )}
      </Card.Footer>
    </Card>
  );
}
