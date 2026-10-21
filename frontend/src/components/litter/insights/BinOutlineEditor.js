import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2, Undo2, Eraser } from "lucide-react";
import { apiUrl } from "../../../utils/apiBase";
import { withAuthToken } from "../../../utils/authTransport";
import {
  fetchBinOutline,
  saveBinOutline,
  deleteBinOutline,
  apiErrorMessage,
} from "../../../utils/litterInsightsApi";
import { clickToFraction, polygonToSvgPoints } from "../../../utils/litterInsights";
import {
  btnPrimary,
  btnSecondary,
  selectClass,
  labelClass,
  bannerTone,
} from "../../dashboard/dashboardUi";
import { formatBinCode } from "../../../utils/dashboardBins";

const MAX_POINTS = 40;

/**
 * Draw the bin outline on the bin's latest photo. The litter severity model
 * ignores litter whose box centre is inside this outline (rubbish in the bin).
 */
export default function BinOutlineEditor({ bins, deviceId, onSelectDevice, canEdit, onSaved }) {
  const imgRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageState, setImageState] = useState("loading");
  const [message, setMessage] = useState(null);
  const [imageNonce, setImageNonce] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setMessage(null);
    try {
      const poly = await fetchBinOutline(deviceId);
      setSaved(poly);
      setPoints(poly || []);
    } catch (e) {
      setMessage({ tone: "error", text: apiErrorMessage(e, "Could not load outline") });
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    setImageState("loading");
    setImageNonce(Date.now());
    load();
  }, [load]);

  const addPoint = (e) => {
    if (!canEdit || imageState !== "ok" || points.length >= MAX_POINTS) return;
    const p = clickToFraction(e.clientX, e.clientY, imgRef.current?.getBoundingClientRect());
    if (p) setPoints((prev) => [...prev, p]);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const poly = await saveBinOutline(deviceId, points);
      setSaved(poly);
      setPoints(poly);
      setMessage({
        tone: "ok",
        text: "Outline saved. New captures from this bin will ignore litter inside it.",
      });
      onSaved?.();
    } catch (e) {
      setMessage({ tone: "error", text: apiErrorMessage(e, "Could not save outline") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await deleteBinOutline(deviceId);
      setSaved(null);
      setPoints([]);
      setMessage({ tone: "ok", text: "Outline removed — all detected litter counts again." });
      onSaved?.();
    } catch (e) {
      setMessage({ tone: "error", text: apiErrorMessage(e, "Could not remove outline") });
    } finally {
      setBusy(false);
    }
  };

  const dirty = JSON.stringify(points) !== JSON.stringify(saved || []);
  const imageSrc = deviceId
    ? withAuthToken(apiUrl(`/devices/${deviceId}/image/latest?t=${imageNonce}`))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className={labelClass}>Bin</span>
          <select
            className={selectClass}
            value={deviceId || ""}
            onChange={(e) => onSelectDevice(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select a bin…</option>
            {(bins || []).map((b) => (
              <option key={b.id} value={b.id}>
                {formatBinCode(b.id)} · {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-slate-500">
          {saved ? `Saved outline · ${saved.length} points` : "No outline saved"}
          {loading ? " · loading…" : ""}
        </div>
      </div>

      {deviceId ? (
        <div
          className={`relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/60 ${canEdit && imageState === "ok" ? "cursor-crosshair" : ""}`}
          onClick={addPoint}
          role="presentation"
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Latest capture from this bin"
            className={`block h-auto w-full select-none ${imageState === "missing" ? "hidden" : ""}`}
            draggable={false}
            onLoad={() => setImageState("ok")}
            onError={() => setImageState("missing")}
          />
          {imageState === "ok" && points.length ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              <polygon
                points={polygonToSvgPoints(points)}
                fill="rgba(56, 189, 248, 0.18)"
                stroke="#38bdf8"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
              {points.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x * 1000}
                  cy={y * 1000}
                  r="7"
                  fill={i === 0 ? "#f97316" : "#38bdf8"}
                  stroke="#0f172a"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          ) : null}
          {imageState === "missing" ? (
            <div className="flex h-48 items-center justify-center text-xs text-slate-500">
              No photo from this bin yet — the outline is drawn on its latest capture.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-700/50 text-xs text-slate-500">
          Pick a bin to draw its outline.
        </div>
      )}

      {deviceId && canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={!points.length || busy}
            onClick={() => setPoints((prev) => prev.slice(0, -1))}
          >
            <Undo2 className="h-4 w-4" /> Undo point
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!points.length || busy}
            onClick={() => setPoints([])}
          >
            <Eraser className="h-4 w-4" /> Clear
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={points.length < 3 || !dirty || busy}
            onClick={save}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save outline
          </button>
          {saved ? (
            <button type="button" className={btnSecondary} disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4" /> Remove saved
            </button>
          ) : null}
          <span className="text-[11px] text-slate-500">
            {points.length}/{MAX_POINTS} points · click around the bin edge
          </span>
        </div>
      ) : null}

      {deviceId && !canEdit ? (
        <p className="text-[11px] text-slate-500">Only admins can change bin outlines.</p>
      ) : null}

      {message ? (
        <div className={`rounded-xl border px-3 py-2 text-xs ${bannerTone(message.tone)}`}>
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
