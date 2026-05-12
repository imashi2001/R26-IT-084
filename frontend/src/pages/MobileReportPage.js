import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Smartphone,
  Camera,
  MapPin,
  Trash2,
  ImageIcon,
  Upload,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import {
  apiUrl,
  getApiBaseUrl,
  getPredictUrl,
  isApiUrlPointingAtFrontend,
  analyzeCapture,
} from "../utils/apiBase";

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

function riskBadgeClass(level) {
  const u = String(level || "").toUpperCase();
  if (u === "HIGH" || u === "CRITICAL")
    return "border-red-200 bg-red-50 text-red-800";
  if (u === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-800";
  if (u === "LOW") return "border-brand-200 bg-brand-50 text-brand-800";
  return "border-slate-200 bg-slate-50 text-ink-700";
}

/**
 * /mobile-report — Field capture from a phone: camera or gallery, GPS,
 * bin selection, then POST /predict with source_type=mobile (same pipeline
 * as ESP32 bridge). Uses DashboardLayout to match the rest of VisionWaste.
 */
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
  const [lastRisk, setLastRisk] = useState(null);

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
      setGpsNote("Geolocation not supported on this device.");
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
        setCaptureFile(
          new File([blob], "mobile-report.jpg", { type: "image/jpeg" })
        );
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
    setLastRisk(null);
    if (!captureFile) {
      setResultErr("Capture or choose a photo first.");
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
      setResultErr("Production API URL missing (REACT_APP_API_URL).");
      return;
    }
    if (
      process.env.NODE_ENV === "production" &&
      apiBase &&
      isApiUrlPointingAtFrontend(apiBase)
    ) {
      setResultErr("REACT_APP_API_URL points at this frontend; set backend URL.");
      return;
    }

    setBusy(true);
    try {
      const body = await analyzeCapture(captureFile, {
        binId: did,
        lat: la,
        lon: ln,
        sourceType: "mobile",
      });
      const cap = body.capture_id;
      const level = body?.risk?.level;
      setLastRisk(level || null);
      setResultMsg(
        cap
          ? `Capture saved (#${cap}). Pipeline completed successfully.`
          : "Analysis completed."
      );
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Upload failed.";
      setResultErr(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-brand-600">
              <Smartphone className="h-6 w-6" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Field reporting
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              Mobile report
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Submit an on-site photo through the same analysis pipeline as the
              ESP32 bridge. Use{" "}
              <strong className="text-ink-700">HTTPS</strong> so the camera API
              works in the browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Dashboard
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/bins"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Bin registry
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="!min-h-0">
            <Card.Header icon={Camera} title="Capture" />
            <Card.Body className="!mt-2 space-y-3">
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  <Camera className="h-4 w-4" />
                  Open rear camera
                </button>
              ) : (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    className="w-full max-h-64 rounded-lg bg-black object-contain"
                    playsInline
                    muted
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={snapshotFromVideo}
                      className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Capture frame
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-ink-500">
                Or{" "}
                <label className="cursor-pointer font-semibold text-brand-700 hover:text-brand-600">
                  choose from gallery
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={onPickFile}
                  />
                </label>
              </p>
              {cameraErr ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {cameraErr}
                </div>
              ) : null}
            </Card.Body>
          </Card>

          <Card className="!min-h-0">
            <Card.Header icon={MapPin} title="Location" />
            <Card.Body className="!mt-2 space-y-3">
              <p className="text-xs text-ink-500">{gpsNote}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink-600">
                  Latitude
                  <input
                    className={inputClass}
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="e.g. 6.927079"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-600">
                  Longitude
                  <input
                    className={inputClass}
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    placeholder="e.g. 79.861244"
                  />
                </label>
              </div>
            </Card.Body>
          </Card>

          <Card className="!min-h-0">
            <Card.Header icon={Trash2} title="Bin" />
            <Card.Body className="!mt-2 space-y-2">
              {binsError ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {binsError}
                </div>
              ) : null}
              <label className="block text-xs font-semibold text-ink-600">
                Linked bin
                <select
                  className={inputClass}
                  value={binId}
                  onChange={(e) => setBinId(e.target.value)}
                >
                  <option value="">Select a bin…</option>
                  {bins.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name} (#{b.id})
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-ink-400">
                When GPS works, the nearest bin with coordinates is pre-selected.
              </p>
            </Card.Body>
          </Card>

          <Card className="!min-h-0">
            <Card.Header icon={ImageIcon} title="Review & submit" />
            <Card.Body className="!mt-2 space-y-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected capture"
                  className="max-h-56 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                  <Upload className="h-10 w-10 text-ink-300" />
                  <p className="mt-2 text-sm text-ink-500">No image yet</p>
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={runSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload &amp; analyze
                  </>
                )}
              </button>
              {resultErr ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {resultErr}
                </div>
              ) : null}
              {resultMsg ? (
                <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3 text-sm text-brand-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{resultMsg}</span>
                  </div>
                  {lastRisk ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                        Hygienic risk
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${riskBadgeClass(
                          lastRisk
                        )}`}
                      >
                        {lastRisk}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card.Body>
          </Card>
        </div>

        <p className="text-center text-xs text-ink-400">
          Automated captures still use the ESP32 LAN bridge. This page is for
          manual reporting when you are on-site with a phone.
        </p>
      </div>
    </DashboardLayout>
  );
}
