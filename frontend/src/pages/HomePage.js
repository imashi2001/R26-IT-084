import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Wifi,
  WifiOff,
  Loader2,
  Play,
  RotateCcw,
  AlertTriangle,
  ImagePlus,
  ChevronRight,
  ListChecks,
  ShieldAlert,
  Layers,
  Bot,
  PackageOpen,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import ImageCanvas from "../components/ImageCanvas";
import {
  getApiBaseUrl,
  getPredictUrl,
  isApiUrlPointingAtFrontend,
  apiUrl,
} from "../utils/apiBase";
import { normalizeFill, effectiveFillTier, fillLabel } from "../utils/fillTier";

/*
 * /bin-level-detector — redesigned.
 *
 * Same business logic as before (drag-and-drop or ESP32-CAM snapshot →
 * POST /predict → render waste/animal/bin-fill detections), but the page
 * now lives inside DashboardLayout (sidebar + topbar) and the visuals use
 * the same Tailwind card primitives as SystemDashboard / LiveMonitoring /
 * HygienicRisk so the whole admin surface reads as one product.
 *
 * Sections:
 *   1. Page header (title, subtitle, jump-to chips)
 *   2. Empty state (no image yet):
 *        - "Image source" card (drag-drop + ESP32-CAM URL row + mixed-content warning)
 *        - "Bins — latest fill" card (snapshot of every bin's current fill tier)
 *   3. Working state (image loaded):
 *        - "Workspace" card with ImageCanvas + Run / Upload-new controls
 *        - "Detections" card (label / confidence / bounding box)
 *        - "Server annotations" card (animal + bin-fill YOLO annotated JPEGs)
 *
 * The legacy LiveEsp32View "last capture" widget is intentionally dropped:
 * SystemDashboardPage already exposes the latest capture; keeping it here
 * duplicated the same data.
 */

const DEFAULT_ESP32_URL =
  import.meta.env.VITE_ESP32_CAPTURE_URL || "http://10.134.126.191/capture";

function detectionLabel(det) {
  if (det.label != null && String(det.label).trim()) return String(det.label).trim();
  if (det.class_name != null && String(det.class_name).trim())
    return String(det.class_name).trim();
  return "animal";
}

function detectionBox(det) {
  if (Array.isArray(det.box) && det.box.length >= 4) {
    return det.box.slice(0, 4).map((x) => Number(x));
  }
  if (Array.isArray(det.box_xyxy) && det.box_xyxy.length >= 4) {
    return det.box_xyxy.slice(0, 4).map((x) => Number(x));
  }
  return [0, 0, 0, 0];
}

function predictionsFromPredictResponse(data) {
  if (Array.isArray(data)) return data;
  const preds = [];
  const waste = data?.waste;
  if (waste && !waste.error && waste.label) {
    preds.push({
      label: `${waste.label}`,
      confidence: Number(waste.confidence) || 0,
      box: [8, 8, 92, 92],
    });
  }
  const animal = data?.animal;
  if (animal && !animal.error && Array.isArray(animal.detections)) {
    for (const det of animal.detections) {
      preds.push({
        label: detectionLabel(det),
        confidence: Number(det.confidence) || 0,
        box: detectionBox(det),
      });
    }
  }
  const binFill = data?.bin_fill;
  if (binFill && !binFill.error) {
    const fillList = Array.isArray(binFill.predictions)
      ? binFill.predictions
      : Array.isArray(binFill.detections)
        ? binFill.detections
        : [];
    for (const det of fillList) {
      preds.push({
        label:
          det.label != null && String(det.label).trim()
            ? String(det.label).trim()
            : "fill",
        confidence: Number(det.confidence) || 0,
        box: detectionBox(det),
      });
    }
  }
  const risk = data?.risk;
  if (risk?.level) {
    preds.push({
      label: `risk:${risk.level}`,
      confidence: 1,
      box: [0, 0, 0, 0],
    });
  }
  return preds;
}

/* ---------------- styling helpers ---------------- */

const LABEL_PALETTE = [
  { match: /^risk:critical$/i, chip: "bg-red-100 text-red-800 border-red-200" },
  { match: /^risk:high$/i, chip: "bg-red-50 text-red-700 border-red-200" },
  { match: /^risk:medium$/i, chip: "bg-amber-50 text-amber-700 border-amber-200" },
  { match: /^risk:low$/i, chip: "bg-brand-50 text-brand-700 border-brand-200" },
  { match: /^overflow$/i, chip: "bg-red-50 text-red-700 border-red-200" },
  { match: /^half$/i, chip: "bg-amber-50 text-amber-700 border-amber-200" },
  { match: /^empty$/i, chip: "bg-brand-50 text-brand-700 border-brand-200" },
];

function labelChipClass(label) {
  const hit = LABEL_PALETTE.find((p) => p.match.test(String(label)));
  if (hit) return hit.chip;
  return "bg-slate-100 text-ink-700 border-slate-200";
}

function fillBadgeClass(tier) {
  switch (tier) {
    case "overflow":
      return "bg-red-50 text-red-700 border-red-200";
    case "half":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "empty":
      return "bg-brand-50 text-brand-700 border-brand-200";
    default:
      return "bg-slate-100 text-ink-500 border-slate-200";
  }
}

export default function HomePage() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [lastPredict, setLastPredict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [esp32Loading, setEsp32Loading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [esp32Url, setEsp32Url] = useState(DEFAULT_ESP32_URL);
  const fileInputRef = useRef(null);

  const [binsSnapshot, setBinsSnapshot] = useState([]);
  const [binsSnapLoading, setBinsSnapLoading] = useState(false);
  const [binsSnapError, setBinsSnapError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBinsFill() {
      setBinsSnapLoading(true);
      setBinsSnapError(null);
      try {
        let url;
        try {
          url = apiUrl("/devices?latest=1");
        } catch {
          if (!cancelled) {
            setBinsSnapshot([]);
            setBinsSnapError(null);
          }
          return;
        }
        const res = await fetch(url);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setBinsSnapError(body.error || `HTTP ${res.status}`);
            setBinsSnapshot([]);
          }
          return;
        }
        if (!cancelled) {
          setBinsSnapshot(Array.isArray(body.devices) ? body.devices : []);
        }
      } catch (e) {
        if (!cancelled) {
          setBinsSnapError(e.message || "Could not load bins.");
          setBinsSnapshot([]);
        }
      } finally {
        if (!cancelled) setBinsSnapLoading(false);
      }
    }

    loadBinsFill();
    return () => {
      cancelled = true;
    };
  }, []);

  const mixedContentBlocked =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    esp32Url.trim().toLowerCase().startsWith("http:");

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setImageFile(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPredictions([]);
    setLastPredict(null);
    setError(null);
  }, []);

  const onFileChange = (e) => handleFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const loadFromEsp32 = async () => {
    const trimmed = esp32Url.trim();
    if (!trimmed) return;

    if (mixedContentBlocked) {
      setError(
        "HTTPS page cannot load HTTP ESP32 (mixed content). Use VisionWaste/bridge on your laptop or upload a file."
      );
      return;
    }

    setEsp32Loading(true);
    setError(null);

    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`ESP32 returned HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const type = blob.type?.startsWith("image/") ? blob.type : "image/jpeg";
      const file = new File([blob], "capture.jpg", { type });
      handleFile(file);
    } catch (e) {
      setError(e.message || "Could not reach ESP32. Check URL and Wi‑Fi.");
    } finally {
      setEsp32Loading(false);
    }
  };

  const runPrediction = async () => {
    if (!imageFile) return;

    const predictUrl = getPredictUrl();
    const apiBase = getApiBaseUrl();

    if (predictUrl === null) {
      setError(
        "API URL missing for production. In Railway → Frontend service → Variables, set VITE_API_URL to your backend URL (e.g. https://your-backend.up.railway.app) then redeploy."
      );
      return;
    }

    if (
      import.meta.env.PROD &&
      apiBase &&
      isApiUrlPointingAtFrontend(apiBase)
    ) {
      setError(
        "VITE_API_URL points to this frontend site. Set it to your backend Railway URL only, save variables, and redeploy the frontend."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setPredictions([]);
    setLastPredict(null);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const response = await fetch(predictUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = `Server error ${response.status}`;
        const ct = response.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const errBody = await response.json();
            if (errBody && errBody.error) message = errBody.error;
          } catch {
            /* ignore */
          }
        } else if (response.status === 405) {
          message =
            "405 Method Not Allowed — the request hit the wrong server (often VITE_API_URL points at the frontend URL, not the backend). Fix the variable and redeploy.";
        }
        throw new Error(message);
      }

      const data = await response.json();
      setLastPredict(data);
      const preds = predictionsFromPredictResponse(data);
      setPredictions(preds);

      if (preds.length === 0 && !data?.bin_fill_level) {
        setError(
          "No waste/animal/bin-fill/risk outputs returned. Check backend MODEL_YOLO_URL and other model services, then try another image."
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPredictions([]);
    setLastPredict(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasAnnotations =
    !!(
      lastPredict?.animal &&
      !lastPredict.animal.error &&
      lastPredict.animal.annotated_image_base64
    ) ||
    !!(
      lastPredict?.bin_fill &&
      !lastPredict.bin_fill.error &&
      lastPredict.bin_fill.annotated_image_base64
    );

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <PageHeader />

        {error ? (
          <Banner
            tone="red"
            icon={AlertTriangle}
            title="Detector error"
            body={error}
          />
        ) : null}

        {!imageUrl ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <UploadCard
                dragOver={dragOver}
                fileInputRef={fileInputRef}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onFileChange={onFileChange}
                esp32Url={esp32Url}
                onEsp32UrlChange={setEsp32Url}
                onLoadFromEsp32={loadFromEsp32}
                esp32Loading={esp32Loading}
                mixedContentBlocked={mixedContentBlocked}
              />
            </div>
            <BinsSnapshotCard
              bins={binsSnapshot}
              loading={binsSnapLoading}
              error={binsSnapError}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WorkspaceCard
                imageUrl={imageUrl}
                predictions={predictions}
                loading={loading}
                onRun={runPrediction}
                onReset={reset}
              />
            </div>
            <PredictionsCard predictions={predictions} />
          </div>
        )}

        {imageUrl && hasAnnotations ? (
          <AnnotationsCard lastPredict={lastPredict} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}

/* ============================ Page header ============================ */

function PageHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Bin Level Detector
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-ink-500">
          Upload an image or pull one from an ESP32-CAM to run waste
          classification, animal detection, and bin-fill detection. Same models
          the{" "}
          <Link
            to="/live-monitoring"
            className="font-semibold text-brand-700 hover:text-brand-600"
          >
            Live Monitoring
          </Link>{" "}
          map uses behind the scenes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/live-monitoring"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          Live Monitoring
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/hygienic-risk"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          Risk Dashboard
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/mobile-report"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          Phone report
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ============================ Banners ============================ */

function Banner({ tone, icon: Icon, title, body }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    brand: "border-brand-200 bg-brand-50 text-brand-700",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 break-words">{body}</div>
      </div>
    </div>
  );
}

/* ============================ Empty state ============================ */

function UploadCard({
  dragOver,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileChange,
  esp32Url,
  onEsp32UrlChange,
  onLoadFromEsp32,
  esp32Loading,
  mixedContentBlocked,
}) {
  return (
    <Card>
      <Card.Header
        icon={ImagePlus}
        title="Image source"
        right={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Upload or LAN snapshot
          </span>
        }
      />

      <Card.Body className="space-y-4">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              fileInputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragOver
              ? "border-brand-500 bg-brand-50/60"
              : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"
          }`}
          aria-label="Upload an image"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            <UploadCloud className="h-6 w-6 text-brand-600" />
          </div>
          <div className="text-sm font-semibold text-ink-900">
            Drag &amp; drop an image here
          </div>
          <div className="text-xs text-ink-500">or click to browse</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              {mixedContentBlocked ? (
                <WifiOff className="h-4 w-4 text-red-600" />
              ) : (
                <Wifi className="h-4 w-4 text-brand-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-900">
                ESP32-CAM (same Wi‑Fi)
              </div>
              <div className="text-xs text-ink-500">
                Snapshot URL on your LAN, e.g.{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-ink-700">
                  http://10.134.126.191/capture
                </code>
              </div>
            </div>
          </div>

          {mixedContentBlocked ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This site is served over HTTPS. Browsers block loading{" "}
              <code className="rounded bg-amber-100 px-1">http://</code> camera
              URLs (mixed content). Use the{" "}
              <strong>VisionWaste bridge</strong> on your laptop, or upload an
              image instead.
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="http://10.134.126.191/capture"
              value={esp32Url}
              onChange={(e) => onEsp32UrlChange(e.target.value)}
              disabled={esp32Loading}
              aria-label="ESP32 snapshot URL"
            />
            <button
              type="button"
              onClick={onLoadFromEsp32}
              disabled={esp32Loading || mixedContentBlocked || !esp32Url.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {esp32Loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Load from ESP32
                </>
              )}
            </button>
          </div>
        </div>
      </Card.Body>

      <Card.Footer>
        Primary monitoring is the ESP32-CAM + laptop bridge. Phone-camera
        fallback lives under{" "}
        <Link
          to="/mobile-report"
          className="font-semibold text-brand-700 hover:text-brand-600"
        >
          Mobile Report
        </Link>
        .
      </Card.Footer>
    </Card>
  );
}

function BinsSnapshotCard({ bins, loading, error }) {
  return (
    <Card>
      <Card.Header
        icon={Layers}
        title="Bins — latest fill"
        right={
          <Link
            to="/live-monitoring"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-600"
          >
            Map
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <Card.Body>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bins…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && bins.length === 0 ? (
          <div className="text-sm text-ink-500">
            No bins yet. Create bins in{" "}
            <Link
              to="/admin"
              className="font-semibold text-brand-700 hover:text-brand-600"
            >
              Admin
            </Link>
            , then send captures from the bridge or mobile report.
          </div>
        ) : null}

        {bins.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {bins.map((b) => {
              const tier = effectiveFillTier(b);
              const tierKey = normalizeFill(tier) || "unknown";
              const pct =
                b.latest_fill_percentage != null &&
                Number.isFinite(Number(b.latest_fill_percentage))
                  ? `${Math.round(Number(b.latest_fill_percentage))}%`
                  : "—";
              return (
                <li key={b.id}>
                  <Link
                    to={`/bins/${b.id}`}
                    className="flex items-center justify-between gap-2 py-2.5 transition hover:bg-slate-50"
                  >
                    <span className="truncate text-sm font-medium text-ink-900">
                      {b.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${fillBadgeClass(
                          tierKey
                        )}`}
                      >
                        {fillLabel(tier === "unknown" ? "" : tier)}
                      </span>
                      <span className="w-10 text-right text-xs font-medium tabular-nums text-ink-700">
                        {pct}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card.Body>
    </Card>
  );
}

/* ============================ Working state ============================ */

function WorkspaceCard({ imageUrl, predictions, loading, onRun, onReset }) {
  return (
    <Card>
      <Card.Header
        icon={ImagePlus}
        title="Workspace"
        right={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Waste · Animal · Bin-fill
          </span>
        }
      />
      <Card.Body className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Detecting…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Detection
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Upload new image
          </button>
        </div>
      </Card.Body>
    </Card>
  );
}

function PredictionsCard({ predictions }) {
  return (
    <Card>
      <Card.Header
        icon={ListChecks}
        title="Detections"
        right={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {predictions.length}
          </span>
        }
      />
      <Card.Body>
        {predictions.length === 0 ? (
          <div className="text-sm text-ink-500">
            Run detection to see waste, animal, bin-fill, and risk predictions
            here.
          </div>
        ) : (
          <ul className="space-y-2">
            {predictions.map((p, i) => {
              const [x1, y1, x2, y2] = p.box || [0, 0, 0, 0];
              const conf = Number.isFinite(Number(p.confidence))
                ? `${(Number(p.confidence) * 100).toFixed(1)}%`
                : "—";
              return (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${labelChipClass(
                        p.label
                      )}`}
                    >
                      {p.label}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-ink-700">
                      {conf}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-500">
                    Box: [{Math.round(x1)}, {Math.round(y1)}, {Math.round(x2)},{" "}
                    {Math.round(y2)}]
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

/* ============================ Annotations row ============================ */

function AnnotationsCard({ lastPredict }) {
  const animal =
    lastPredict?.animal && !lastPredict.animal.error
      ? lastPredict.animal
      : null;
  const binFill =
    lastPredict?.bin_fill && !lastPredict.bin_fill.error
      ? lastPredict.bin_fill
      : null;

  return (
    <Card>
      <Card.Header
        icon={ShieldAlert}
        title="Server-rendered annotations"
        right={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            From model microservices
          </span>
        }
      />
      <Card.Body>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {animal?.annotated_image_base64 ? (
            <AnnotationPanel
              icon={Bot}
              title="Animal YOLO"
              imgSrc={`data:image/jpeg;base64,${animal.annotated_image_base64}`}
              meta={
                animal.inference_imgsz != null
                  ? `Same scan as Risk Dashboard · inference imgsz ${
                      animal.inference_imgsz
                    }${
                      typeof animal.detection_count === "number"
                        ? ` · ${animal.detection_count} detection(s)`
                        : ""
                    }`
                  : null
              }
            />
          ) : null}

          {binFill?.annotated_image_base64 ? (
            <AnnotationPanel
              icon={PackageOpen}
              title="Bin fill YOLO"
              imgSrc={`data:image/jpeg;base64,${binFill.annotated_image_base64}`}
              meta={
                lastPredict.bin_fill_level
                  ? `Derived tier: ${lastPredict.bin_fill_level}${
                      typeof binFill.detection_count === "number"
                        ? ` · ${binFill.detection_count} detection(s)`
                        : Array.isArray(binFill.predictions)
                          ? ` · ${binFill.predictions.length} detection(s)`
                          : ""
                    }`
                  : null
              }
            />
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}

function AnnotationPanel({ icon: Icon, title, imgSrc, meta }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-3.5 w-3.5 text-ink-700" />
          </div>
          <span className="text-sm font-semibold text-ink-900">{title}</span>
        </div>
      </div>
      <div className="bg-slate-50">
        <img
          src={imgSrc}
          alt={`${title} annotated detection`}
          className="block max-h-[420px] w-full object-contain"
        />
      </div>
      {meta ? (
        <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-ink-500">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
