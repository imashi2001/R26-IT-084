import { card, subtle } from "../dashboardStyles";

/**
 * MobileNetV2 waste classification (organic / non-organic) — Imashi feature branch.
 */
export default function WasteClassificationCard({ waste }) {
  const label = (waste?.label || "").toString().toLowerCase();
  const isOrganic = label === "organic";
  const isNonOrganic = label === "non_organic" || label === "non-organic";
  const confPct =
    waste?.confidence_percent != null
      ? Math.round(Number(waste.confidence_percent))
      : null;

  const accent = isOrganic ? "#86efac" : isNonOrganic ? "#7dd3fc" : "#64748b";
  const title = isOrganic
    ? "Organic waste"
    : isNonOrganic
      ? "Non-organic waste"
      : "Awaiting scan";

  const organicPct =
    isOrganic && confPct != null
      ? confPct
      : isOrganic
        ? 82
        : 0;
  const donutStyle =
    isOrganic || isNonOrganic
      ? {
          background: isOrganic
            ? `conic-gradient(#22c55e 0 ${organicPct}%, #0ea5e9 ${organicPct}% 100%)`
            : "conic-gradient(#0ea5e9 0 100%)",
        }
      : { background: "#1e293b" };

  return (
    <div style={card}>
      <div style={{ ...subtle, fontSize: 12, marginBottom: 8 }}>
        Waste classification (MobileNetV2)
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            ...donutStyle,
            width: 96,
            height: 96,
            borderRadius: "50%",
            padding: 6,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#0f172a",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {confPct != null ? (
              <>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{confPct}%</span>
                <span style={{ ...subtle, fontSize: 9, letterSpacing: 0.5 }}>
                  CONF.
                </span>
              </>
            ) : (
              <span style={subtle}>—</span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: accent }}>{title}</div>

        {waste ? (
          <>
            <div style={{ ...subtle, fontSize: 13 }}>
              Confidence {waste.confidence_percent}% · organic prob{" "}
              {Number(waste.organic_probability).toFixed(2)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                borderTop: "1px solid #1f2937",
                paddingTop: 8,
                width: "100%",
              }}
            >
              {isOrganic
                ? "Organic materials detected — monitor rotting risk."
                : "Non-organic waste — lower rotting concern."}
            </div>
          </>
        ) : (
          <div style={subtle}>Run Analyze to classify waste type.</div>
        )}
      </div>
    </div>
  );
}
