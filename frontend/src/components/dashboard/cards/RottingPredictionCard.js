import { card, subtle } from "../dashboardStyles";

function bandFromHours(h) {
  if (!Number.isFinite(h)) return null;
  if (h >= 18)
    return { color: "#22c55e", label: "Plenty of time" };
  if (h >= 8)
    return { color: "#f59e0b", label: "Collect today" };
  return { color: "#ef4444", label: "Collect soon" };
}

/**
 * Rule-based rotting estimate from organic waste + temp + humidity.
 */
export default function RottingPredictionCard({ waste, risk }) {
  const isOrganic = (waste?.label || "").toString().toLowerCase() === "organic";
  const hRaw = Number(risk?.rotting_hours);
  const hasH = Number.isFinite(hRaw) && hRaw >= 0;
  const band = hasH ? bandFromHours(hRaw) : null;
  const days = hasH ? Math.max(1, Math.round(hRaw / 24)) : null;
  const meterPct = hasH
    ? Math.max(8, Math.min(100, (Math.min(hRaw, 24) / 24) * 100))
    : 0;

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ ...subtle, fontSize: 12 }}>Rotting prediction</div>
        {band ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: band.color }}>
            {band.label}
          </span>
        ) : null}
      </div>

      {hasH ? (
        <>
          <div style={{ ...subtle, fontSize: 12 }}>Estimated days to rotting</div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800 }}>{days}</span>
            <span style={subtle}>
              day{days !== 1 ? "s" : ""} (~{Math.round(hRaw)} h)
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              height: 6,
              borderRadius: 999,
              background: "#1e293b",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${meterPct}%`,
                borderRadius: 999,
                background: band?.color || "#64748b",
              }}
            />
          </div>
          {risk?.rotting_summary ? (
            <div style={{ ...subtle, fontSize: 13, marginTop: 8 }}>
              {risk.rotting_summary}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {isOrganic ? "—" : "N/A"}
          </div>
          <div style={{ ...subtle, fontSize: 13, marginTop: 4 }}>
            {isOrganic
              ? "Waiting for rotting estimate."
              : "Non-organic waste — rotting not applicable."}
          </div>
          {risk?.rotting_summary ? (
            <div style={{ ...subtle, fontSize: 13, marginTop: 8 }}>
              {risk.rotting_summary}
            </div>
          ) : null}
        </>
      )}

      {risk?.thresholds ? (
        <div style={{ ...subtle, fontSize: 12, marginTop: 8 }}>
          MEDIUM thresholds: {risk.thresholds.HIGH_TEMP_C}°C,{" "}
          {risk.thresholds.HIGH_HUMIDITY_PCT}% RH
        </div>
      ) : null}

      <div
        style={{
          ...subtle,
          fontSize: 11,
          marginTop: 10,
          borderTop: "1px solid #1f2937",
          paddingTop: 8,
        }}
      >
        Based on current temperature and humidity model.
      </div>
    </div>
  );
}
