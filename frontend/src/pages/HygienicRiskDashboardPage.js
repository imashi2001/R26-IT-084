import { useEffect, useMemo, useRef, useState } from "react";
import WasteClassificationCard from "../components/dashboard/cards/WasteClassificationCard";
import RottingPredictionCard from "../components/dashboard/cards/RottingPredictionCard";
import { card, subtle } from "../components/dashboard/dashboardStyles";
import {
  analyzeCapture,
  fetchAnalyzeHistory,
  fetchBins,
  fetchForecast,
  fetchMetrics,
} from "../utils/apiBase";

const RISK_THEMES = {
  LOW: { bg: "#dcfce7", fg: "#166534", border: "#86efac", label: "LOW" },
  MEDIUM: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "MEDIUM" },
  HIGH: { bg: "#ffedd5", fg: "#9a3412", border: "#fdba74", label: "HIGH" },
  CRITICAL: { bg: "#fee2e2", fg: "#991b1b", border: "#fca5a5", label: "CRITICAL" },
};

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/** Vision-based hygienic risk dashboard (R26-IT-084). Routed at `/hygienic-risk`. */
export default function HygienicRiskDashboardPage() {
  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [now, setNow] = useState(new Date());

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const previewRef = useRef("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchBins().then((d) => setBins(d.bins || [])).catch(() => setBins([]));
    fetchMetrics().then(setMetrics).catch(() => setMetrics(null));
    fetchAnalyzeHistory()
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory([]));
  }, []);

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setPreviewUrl(url);
  }

  async function runAnalyze() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await analyzeCapture(file, { binId: binId || undefined });
      setResult(res);
      const next = await fetchAnalyzeHistory().catch(() => null);
      if (next?.history) setHistory(next.history);
      await loadForecast();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadForecast() {
    setForecastBusy(true);
    try {
      const f = await fetchForecast(binId || null, 24);
      setForecast(f);
    } catch {
      setForecast(null);
    } finally {
      setForecastBusy(false);
    }
  }

  useEffect(() => {
    loadForecast();
    // re-run when bin changes (loadForecast intentionally omitted from deps)
  }, [binId]);

  const weather = result?.weather;
  const risk = result?.risk;
  const waste = result?.waste;
  const animals = result?.animals;
  const theme = risk ? RISK_THEMES[risk.level] || RISK_THEMES.LOW : null;

  const dateText = useMemo(() => now.toLocaleDateString(), [now]);
  const timeText = useMemo(
    () => now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [now]
  );

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "24px 20px 48px",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#e2e8f0",
      }}
    >
      <header
        style={{
          ...card,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ ...subtle, fontSize: 12, letterSpacing: 1 }}>R26-IT-084</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Smart Waste &amp; Hygienic Risk Monitor
          </div>
          <div style={{ ...subtle, fontSize: 12, marginTop: 4 }}>
            ESP32-CAM &rarr; Laptop bridge &rarr; Express API + models on Railway
          </div>
        </div>
        <div>
          <div style={{ ...subtle, fontSize: 12 }}>Date / Time</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{dateText}</div>
          <div style={{ ...subtle }}>{timeText}</div>
        </div>
        <div>
          <div style={{ ...subtle, fontSize: 12 }}>Temperature</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {weather ? `${weather.temp_c}°C` : "—"}
          </div>
          <div style={{ ...subtle, fontSize: 12 }}>
            {weather?.source === "openweather"
              ? "live (OpenWeather)"
              : weather
              ? "stub fallback"
              : "no reading yet"}
          </div>
        </div>
        <div>
          <div style={{ ...subtle, fontSize: 12 }}>Humidity</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {weather ? `${Math.round(weather.humidity_pct)}%` : "—"}
          </div>
          <div style={{ ...subtle, fontSize: 12 }}>{weather?.condition || "—"}</div>
        </div>
        <div>
          <div style={{ ...subtle, fontSize: 12 }}>Device (PC ID)</div>
          <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>
            {result?.device_id || "—"}
          </div>
          <div style={{ ...subtle, fontSize: 12 }}>
            {result?.esp32_id ? `ESP32: ${result.esp32_id}` : "ESP32: —"}
          </div>
        </div>
      </header>

      <section
        style={{
          ...card,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(220px, auto) auto",
          gap: 12,
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ ...subtle, fontSize: 12, marginBottom: 6 }}>
            ESP32-CAM image (or upload manually)
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pickFile(e.target.files?.[0])}
            style={{ color: "#e2e8f0" }}
          />
        </div>
        <div>
          <div style={{ ...subtle, fontSize: 12, marginBottom: 6 }}>Bin (optional)</div>
          <select
            value={binId}
            onChange={(e) => setBinId(e.target.value)}
            style={{
              padding: "8px 10px",
              minWidth: 220,
              background: "#020617",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
          >
            <option value="">— use default location —</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={runAnalyze}
          disabled={!file || busy}
          style={{
            padding: "10px 18px",
            background: !file || busy ? "#334155" : "#22c55e",
            color: "#0b1220",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: !file || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Analyzing…" : "Analyze"}
        </button>
      </section>

      {error ? (
        <section style={{ ...card, marginBottom: 16, color: "#fecaca" }}>{error}</section>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)",
          marginBottom: 16,
        }}
      >
        <div style={card}>
          <div style={{ ...subtle, fontSize: 12, marginBottom: 8 }}>Captured image</div>
          {previewUrl ? (
            <img
              alt="capture"
              src={previewUrl}
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 10,
                background: "#020617",
              }}
            />
          ) : (
            <div style={{ ...subtle, padding: 32, textAlign: "center" }}>
              No image yet — pick a file and click Analyze.
            </div>
          )}
          {result?.server_time ? (
            <div style={{ ...subtle, fontSize: 12, marginTop: 8 }}>
              Server time: {formatDateTime(result.server_time)}
            </div>
          ) : null}
        </div>

        <div style={card}>
          <div style={{ ...subtle, fontSize: 12, marginBottom: 8 }}>
            Animal detection output
          </div>
          {animals?.annotated_image_base64 ? (
            <img
              alt="annotated"
              src={`data:image/jpeg;base64,${animals.annotated_image_base64}`}
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 10,
                background: "#020617",
              }}
            />
          ) : (
            <div style={{ ...subtle, padding: 32, textAlign: "center" }}>
              YOLO output will show after Analyze.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 16,
        }}
      >
        <WasteClassificationCard waste={waste} />

        <div style={card}>
          <div style={{ ...subtle, fontSize: 12 }}>Animal detection</div>
          {animals ? (
            animals.no_animal_attacks ? (
              <>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 4,
                    color: "#86efac",
                    letterSpacing: 0.5,
                  }}
                >
                  NO ANIMAL ATTACKS DETECTED
                </div>
                <div style={{ ...subtle, fontSize: 12, marginTop: 4 }}>
                  YOLO scanned at imgsz {animals.inference_imgsz}, conf ≥{" "}
                  {animals.conf_threshold}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {animals.detection_count} animal
                  {animals.detection_count > 1 ? "s" : ""}
                </div>
                <ul style={{ margin: "6px 0 0 16px", padding: 0, fontSize: 13 }}>
                  {animals.detections.map((d, i) => (
                    <li key={`${d.class_name}-${i}`}>
                      {d.class_name} · {(d.confidence * 100).toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <div style={{ ...subtle, marginTop: 4 }}>—</div>
          )}
        </div>

        <div
          style={{
            ...card,
            ...(theme && {
              background: theme.bg,
              color: theme.fg,
              border: `1px solid ${theme.border}`,
            }),
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Hygienic risk</div>
          {risk ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                {risk.level}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{risk.message}</div>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
                Case: {risk.case}
              </div>
            </>
          ) : (
            <div style={{ ...subtle, marginTop: 4 }}>—</div>
          )}
        </div>

        <RottingPredictionCard waste={waste} risk={risk} />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...subtle, fontSize: 12, marginBottom: 6 }}>
          Alerts and recommendations
        </div>
        {risk ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 4 }}>{risk.alert}</li>
            <li style={{ marginBottom: 4 }}>{risk.message}</li>
            {risk.no_animal_attacks ? (
              <li style={{ marginBottom: 4 }}>NO ANIMAL ATTACKS DETECTED</li>
            ) : null}
            {risk.rules_fired?.length ? (
              <li>
                Rules fired:{" "}
                <code style={{ color: "#cbd5e1" }}>
                  {risk.rules_fired.join(", ")}
                </code>
              </li>
            ) : null}
          </ul>
        ) : (
          <div style={subtle}>Run Analyze to see alerts.</div>
        )}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ ...subtle, fontSize: 12 }}>
            Risk forecast — next {forecast?.hours_ahead || 24} hours
            {forecast?.forecast?.slots?.[0]?.source === "stub" ||
            forecast?.forecast?.slots?.[0]?.source === "stub-fallback" ? (
              <span style={{ color: "#fcd34d", marginLeft: 8 }}>
                (stub forecast — set OPENWEATHER_API_KEY for live)
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={loadForecast}
            disabled={forecastBusy}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              background: "#1f2937",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 6,
              cursor: forecastBusy ? "not-allowed" : "pointer",
            }}
          >
            {forecastBusy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {forecast?.forecast?.slots?.length ? (
          <>
            <div
              style={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(110px, 1fr)",
                gap: 6,
                overflowX: "auto",
                paddingBottom: 6,
              }}
            >
              {forecast.forecast.slots.map((s, i) => {
                const t = RISK_THEMES[s.level] || RISK_THEMES.LOW;
                const dt = new Date(s.ts_unix ? s.ts_unix * 1000 : s.ts);
                const hh = dt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const dd = dt.toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={`${s.ts}-${i}`}
                    title={s.message}
                    style={{
                      background: t.bg,
                      color: t.fg,
                      border: `1px solid ${t.border}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{dd}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{hh}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                      {s.level}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      {Math.round(s.temp_c)}°C · {Math.round(s.humidity_pct)}%
                    </div>
                  </div>
                );
              })}
            </div>
            {forecast.forecast.summary?.recommendation ? (
              <div style={{ ...subtle, fontSize: 13, marginTop: 8 }}>
                {forecast.forecast.summary.recommendation}
              </div>
            ) : null}
          </>
        ) : (
          <div style={subtle}>No forecast data.</div>
        )}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...subtle, fontSize: 12, marginBottom: 6 }}>Risk history</div>
        {history.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "6px 8px" }}>Time</th>
                  <th style={{ padding: "6px 8px" }}>Risk</th>
                  <th style={{ padding: "6px 8px" }}>Case</th>
                  <th style={{ padding: "6px 8px" }}>Waste</th>
                  <th style={{ padding: "6px 8px" }}>Animals</th>
                  <th style={{ padding: "6px 8px" }}>Temp</th>
                  <th style={{ padding: "6px 8px" }}>Hum</th>
                  <th style={{ padding: "6px 8px" }}>Bin</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const t = RISK_THEMES[h.level] || RISK_THEMES.LOW;
                  return (
                    <tr key={`${h.ts}-${i}`} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "6px 8px" }}>{formatDateTime(h.ts)}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: t.bg,
                            color: t.fg,
                            fontWeight: 700,
                          }}
                        >
                          {h.level}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#cbd5e1" }}>{h.case}</td>
                      <td style={{ padding: "6px 8px" }}>{h.waste_label}</td>
                      <td style={{ padding: "6px 8px" }}>{h.animal_count}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {h.temp_c != null ? `${h.temp_c}°C` : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {h.humidity_pct != null ? `${Math.round(h.humidity_pct)}%` : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>{h.bin_id || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={subtle}>No analyses yet.</div>
        )}
      </section>

      {metrics ? (
        <details
          style={{
            ...card,
            background: "#0b1220",
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          <summary style={{ cursor: "pointer", color: "#e2e8f0" }}>
            Model info
          </summary>
          <div style={{ marginTop: 8 }}>
            Waste test accuracy: {metrics.waste?.test_accuracy_percent ?? "—"}%
            {metrics.animal ? (
              <>
                {" · "}Animal val mAP@50:{" "}
                {(metrics.animal.map50 * 100).toFixed(2)}% (epoch {metrics.animal.epoch})
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
