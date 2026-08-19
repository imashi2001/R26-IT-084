import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl, getApiBaseUrl, getPredictUrl, isApiUrlPointingAtFrontend } from "../utils/apiBase";

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function MobileReportPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef("");

  const [bins, setBins] = useState([]);
  const [binsError, setBinsError] = useState(null);
  const [binId, setBinId] = useState("");
  const [gpsNote, setGpsNote] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [captureFile, setCaptureFile] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraErr, setCameraErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [resultErr, setResultErr] = useState("");

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
    setCaptureFile(null);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      releasePreview();
    };
  }, [stopCamera, releasePreview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/devices/map"));
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const list = Array.isArray(body.bins) ? body.bins : [];
        if (!cancelled) {
          setBins(list);
          setBinsError(null);
        }
      } catch (e) {
        if (!cancelled) setBinsError(e.message || "Could not load bins.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickNearestBin = useCallback(
    (lat, lng) => {
      let best = null;
      let bestD = Infinity;
      for (const b of bins) {
        const la = Number(b.latitude);
        const ln = Number(b.longitude);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
        const d = haversineM(lat, lng, la, ln);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best) setBinId(String(best.id));
    },
    [bins]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsNote("Geolocation not supported.");
      return;
    }
    setGpsNote("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLatInput(String(la.toFixed(6)));
        setLngInput(String(ln.toFixed(6)));
        setGpsNote("GPS acquired.");
      },
      () => {
        setGpsNote("GPS unavailable — enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }, []);

  useEffect(() => {
    const la = Number(latInput);
    const ln = Number(lngInput);
    if (!bins.length || !Number.isFinite(la) || !Number.isFinite(ln)) return;
    if (binId) return;
    pickNearestBin(la, ln);
  }, [bins, latInput, lngInput, binId, pickNearestBin]);

  const startCamera = async () => {
    setCameraErr("");
    releasePreview();
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setCameraErr(e.message || "Could not open camera.");
      setCameraOn(false);
    }
  };

  const snapshotFromVideo = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        releasePreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setCaptureFile(new File([blob], "mobile-report.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    releasePreview();
    const url = URL.createObjectURL(f);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCaptureFile(f);
  };

  const runSubmit = async () => {
    setResultErr("");
    setResultMsg("");
    if (!captureFile) {
      setResultErr("Capture an image first.");
      return;
    }
    const did = parseInt(binId, 10);
    if (!Number.isFinite(did)) {
      setResultErr("Select a bin.");
      return;
    }
    const la = Number(latInput);
    const ln = Number(lngInput);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      setResultErr("Latitude and longitude are required.");
      return;
    }

    const predictUrl = getPredictUrl();
    const apiBase = getApiBaseUrl();
    if (predictUrl === null) {
      setResultErr("Production API URL missing (VITE_API_URL).");
      return;
    }
    if (
      import.meta.env.PROD &&
      apiBase &&
      isApiUrlPointingAtFrontend(apiBase)
    ) {
      setResultErr("VITE_API_URL points at this frontend; set backend URL.");
      return;
    }

    const fd = new FormData();
    fd.append("image", captureFile);
    fd.append("device_id", String(did));
    fd.append("lat", String(la));
    fd.append("lon", String(ln));
    fd.append("source_type", "mobile");

    setBusy(true);
    try {
      const res = await fetch(predictUrl, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const cap = res.headers.get("x-capture-id");
      setResultMsg(
        cap ? `Saved capture #${cap}. Risk: ${body?.risk?.level ?? "—"}` : "Prediction OK."
      );
    } catch (e) {
      setResultErr(e.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page mobile-report-page">
      <p className="back-row">
        <Link to="/">&larr; Home</Link>
      </p>
      <header className="page-header">
        <h1>Mobile report</h1>
        <p className="subtitle">
          Use your phone camera to submit a manual capture to the same AI pipeline as the ESP32
          bridge. Requires HTTPS for camera access.
        </p>
      </header>

      <section className="mobile-report-grid">
        <div className="mobile-report-card">
          <h2>Camera</h2>
          {!cameraOn ? (
            <button type="button" className="btn btn-primary" onClick={startCamera}>
              Open rear camera
            </button>
          ) : (
            <>
              <video ref={videoRef} className="mobile-report-video" playsInline muted />
              <div className="mobile-report-actions">
                <button type="button" className="btn btn-primary" onClick={snapshotFromVideo}>
                  Capture frame
                </button>
                <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                  Stop camera
                </button>
              </div>
            </>
          )}
          <p className="mobile-report-muted">
            Fallback:{" "}
            <label className="mobile-report-file-label">
              choose photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={onPickFile} />
            </label>
          </p>
          {cameraErr ? <div className="error-banner">{cameraErr}</div> : null}
        </div>

        <div className="mobile-report-card">
          <h2>GPS</h2>
          <p className="mobile-report-muted">{gpsNote}</p>
          <div className="latlng-row">
            <label>
              Latitude
              <input value={latInput} onChange={(e) => setLatInput(e.target.value)} placeholder="e.g. 6.927" />
            </label>
            <label>
              Longitude
              <input value={lngInput} onChange={(e) => setLngInput(e.target.value)} placeholder="e.g. 79.861" />
            </label>
          </div>
        </div>

        <div className="mobile-report-card">
          <h2>Bin</h2>
          {binsError ? <div className="error-banner">{binsError}</div> : null}
          <label>
            Select bin
            <select value={binId} onChange={(e) => setBinId(e.target.value)}>
              <option value="">— choose —</option>
              {bins.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name} (#{b.id})
                </option>
              ))}
            </select>
          </label>
          <p className="mobile-report-muted">
            Nearest bin with coordinates is pre-selected when GPS works.
          </p>
        </div>

        <div className="mobile-report-card mobile-report-preview-card">
          <h2>Preview</h2>
          {previewUrl ? (
            <img className="mobile-report-preview-img" src={previewUrl} alt="Preview" />
          ) : (
            <p className="mobile-report-muted">No image yet.</p>
          )}
          <button
            type="button"
            className="btn btn-primary mobile-report-submit"
            disabled={busy}
            onClick={runSubmit}
          >
            {busy ? "Uploading…" : "Upload & analyze"}
          </button>
          {resultErr ? <div className="error-banner">{resultErr}</div> : null}
          {resultMsg ? <div className="info-banner">{resultMsg}</div> : null}
        </div>
      </section>

      <section className="mobile-report-footnote">
        <p className="subtitle">
          ESP32 remains the primary automated path (LAN bridge). This page is for secondary manual
          reporting when you are on-site with a phone.
        </p>
      </section>
    </div>
  );
}
