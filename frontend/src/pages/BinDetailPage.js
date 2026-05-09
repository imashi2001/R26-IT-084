import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ImageCanvas from "../components/ImageCanvas";
import PredictionList from "../components/PredictionList";
import { apiUrl } from "../utils/apiBase";

export default function BinDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl(`/devices/${id}/latest`));
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load bin.");
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
                <dt>Fill level</dt>
                <dd>{latest?.fill_level || "—"}</dd>
              </div>
              <div>
                <dt>Last capture</dt>
                <dd>{latest?.captured_at || "—"}</dd>
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
              <code>DEVICE_ESP32_ID</code> / <code>esp32_id</code>.
            </div>
          )}

          {predictions.length > 0 && (
            <PredictionList predictions={predictions} />
          )}
        </>
      )}
    </div>
  );
}
