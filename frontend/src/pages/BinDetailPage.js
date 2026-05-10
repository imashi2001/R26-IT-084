import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ImageCanvas from "../components/ImageCanvas";
import PredictionList from "../components/PredictionList";
import { apiUrl } from "../utils/apiBase";

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

function formatConfidenceSummary(c) {
  if (c.prediction_class) return c.prediction_class;
  if (c.waste_label != null && Number.isFinite(Number(c.waste_confidence))) {
    const pct = Math.round(Number(c.waste_confidence) * 100);
    return `${c.waste_label} (${pct}%)`;
  }
  const preds = Array.isArray(c.predictions) ? c.predictions : [];
  let best = null;
  for (const p of preds) {
    if (!best || Number(p.confidence) > Number(best.confidence)) best = p;
  }
  if (best) {
    const pct = Math.round(Number(best.confidence) * 100);
    return `${best.label} (${pct}%)`;
  }
  if (c.animal_count != null && c.animal_count > 0) {
    return `${c.animal_count} animal(s)`;
  }
  if (c.risk_level) return `risk: ${c.risk_level}`;
  return "—";
}

function formatGps(c) {
  const lat = c.latitude;
  const lon = c.longitude;
  if (
    lat != null &&
    lon != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon))
  ) {
    return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  }
  return "—";
}

export default function BinDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setHistoryError(null);
      try {
        const [latestRes, capRes] = await Promise.all([
          fetch(apiUrl(`/devices/${id}/latest`)),
          fetch(apiUrl(`/devices/${id}/captures?limit=50`)),
        ]);
        const latestBody = await latestRes.json().catch(() => ({}));
        const capBody = await capRes.json().catch(() => ({}));

        if (!latestRes.ok) {
          throw new Error(latestBody.error || `HTTP ${latestRes.status}`);
        }
        if (!cancelled) setData(latestBody);

        if (!capRes.ok) {
          if (!cancelled) {
            setHistoryError(capBody.error || `HTTP ${capRes.status}`);
            setCaptures([]);
          }
        } else if (!cancelled) {
          setCaptures(Array.isArray(capBody.captures) ? capBody.captures : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load bin.");
          setCaptures([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const latest = data?.latest;
  const extras = latest?.extras || {};
  const imageUrl = latest?.image?.url || null;
  const predictions = Array.isArray(latest?.predictions)
    ? latest.predictions
    : [];

  return (
    <div className="page bin-detail-page">
      <p className="back-row">
        <Link to="/map">&larr; Back to map</Link>
      </p>

      {loading && <div className="info-banner">Loading bin…</div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && data?.device && (
        <>
          <header className="page-header">
            <h1>{data.device.name}</h1>
            <p className="subtitle">
              {data.device.address || data.device.location || "No address label"}
            </p>
            <dl className="bin-meta-grid">
              <div>
                <dt>Status</dt>
                <dd>{data.device.status || "—"}</dd>
              </div>
              <div>
                <dt>Fill level</dt>
                <dd>{latest?.fill_level || "—"}</dd>
              </div>
              <div>
                <dt>Fill estimate</dt>
                <dd>
                  {extras.fill_percentage != null &&
                  Number.isFinite(Number(extras.fill_percentage))
                    ? `${Math.round(Number(extras.fill_percentage))}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Last capture</dt>
                <dd>{formatTs(latest?.captured_at)}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{extras.source_type || "—"}</dd>
              </div>
              <div>
                <dt>Report GPS</dt>
                <dd>
                  {extras.capture_latitude != null &&
                  extras.capture_longitude != null &&
                  Number.isFinite(Number(extras.capture_latitude)) &&
                  Number.isFinite(Number(extras.capture_longitude))
                    ? `${Number(extras.capture_latitude).toFixed(5)}, ${Number(
                        extras.capture_longitude
                      ).toFixed(5)}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>ESP32 ID</dt>
                <dd>{data.device.esp32_id || "—"}</dd>
              </div>
              <div>
                <dt>Bridge / Laptop ID</dt>
                <dd>
                  {data.device.bridge_instance_id ? (
                    <code>{data.device.bridge_instance_id}</code>
                  ) : (
                    "— (any bridge with matching ESP32 ID may attach)"
                  )}
                </dd>
              </div>
            </dl>
          </header>

          {imageUrl ? (
            <div className="bin-detail-canvas">
              <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
            </div>
          ) : (
            <div className="info-banner">
              No image stored yet. Send a capture from the bridge with matching{" "}
              <code>DEVICE_ESP32_ID</code> / <code>esp32_id</code>, or submit from{" "}
              <Link to="/mobile-report">mobile report</Link>.
            </div>
          )}

          {predictions.length > 0 && (
            <PredictionList predictions={predictions} />
          )}

          <section className="bin-capture-history">
            <h2>Capture history</h2>
            {historyError && (
              <div className="error-banner">{historyError}</div>
            )}
            {!historyError && captures.length === 0 && (
              <p className="subtitle">No captures recorded for this bin yet.</p>
            )}
            {!historyError && captures.length > 0 && (
              <div className="bin-history-table-wrap">
                <table className="bin-history-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Fill %</th>
                      <th>Summary</th>
                      <th>GPS</th>
                      <th>Thumb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {captures.map((c) => (
                      <tr key={c.id}>
                        <td>{formatTs(c.captured_at)}</td>
                        <td>{c.source_type || "—"}</td>
                        <td>
                          {c.fill_percentage != null &&
                          Number.isFinite(Number(c.fill_percentage))
                            ? `${Math.round(Number(c.fill_percentage))}%`
                            : "—"}
                        </td>
                        <td>{formatConfidenceSummary(c)}</td>
                        <td className="bin-history-gps">{formatGps(c)}</td>
                        <td>
                          {c.has_image ? (
                            <a
                              href={apiUrl(`/captures/${c.id}/image`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bin-history-thumb-link"
                            >
                              <img
                                src={apiUrl(`/captures/${c.id}/image`)}
                                alt=""
                                className="bin-history-thumb"
                              />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
