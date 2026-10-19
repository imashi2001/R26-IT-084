import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  KeyRound,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Volume2,
  ImagePlus,
  Upload,
} from "lucide-react";
import Card from "./Card";
import useGeminiSettings, {
  saveGeminiSettings,
  predictGeminiPhoto,
  VOICE_SOURCE_OPTIONS,
} from "../../hooks/useGeminiSettings";
import { formatTrackLabel } from "../../hooks/useAudioSettings";

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

function pct(conf) {
  if (!Number.isFinite(Number(conf))) return "—";
  return `${Math.round(Number(conf) * 100)}%`;
}

function PredBlock({ title, data, empty }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </div>
        <p className="mt-2 text-sm text-slate-500">{empty || "No result yet."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {data.error ? (
        <p className="mt-2 text-sm text-amber-300">{data.error}</p>
      ) : (
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Scenario</dt>
            <dd className="font-medium text-slate-100">
              {data.label || data.scenario || "—"}
            </dd>
          </div>
          {data.fill_level != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Fill</dt>
              <dd className="capitalize text-slate-200">{data.fill_level}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Track</dt>
            <dd className="font-mono text-slate-200">
              {data.track != null ? formatTrackLabel(data.track) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Confidence</dt>
            <dd className="text-slate-200">{pct(data.confidence)}</dd>
          </div>
          {data.reason ? (
            <div>
              <dt className="text-slate-500">Reason</dt>
              <dd className="mt-0.5 text-slate-300">{data.reason}</dd>
            </div>
          ) : null}
          {data.winner ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Winner</dt>
              <dd className="font-semibold text-brand-400">{data.winner}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}

/**
 * Admin card: Gemini API key, voice source mode, latest prediction panel.
 */
export default function GeminiSettingsCard({ authFetch, isAdmin }) {
  const { settings, setSettings, loading, error, refresh } = useGeminiSettings(12_000);

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("gemini-3.8-flash");
  const [voiceSource, setVoiceSource] = useState("models");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const photoRef = useRef(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!settings) return;
    setModelDraft(settings.gemini_model || "gemini-3.8-flash");
    setVoiceSource(settings.voice_source || "models");
  }, [settings]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const options =
    settings?.voice_source_options?.length > 0
      ? settings.voice_source_options
      : VOICE_SOURCE_OPTIONS;

  const onSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {
        voice_source: voiceSource,
        gemini_model: modelDraft.trim() || "gemini-3.8-flash",
      };
      if (apiKeyDraft.trim()) {
        payload.api_key = apiKeyDraft.trim();
      }
      const body = await saveGeminiSettings(authFetch, payload);
      setSettings(body);
      setApiKeyDraft("");
      setMsg("Gemini settings saved.");
      refresh();
    } catch (e) {
      setErr(e.message || "Could not save Gemini settings.");
    } finally {
      setSaving(false);
    }
  };

  const onClearKey = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Remove the stored Gemini API key?")) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const body = await saveGeminiSettings(authFetch, { clear_api_key: true });
      setSettings(body);
      setApiKeyDraft("");
      setMsg("Gemini API key cleared.");
      refresh();
    } catch (e) {
      setErr(e.message || "Could not clear key.");
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setTestResult(null);
    setErr(null);
    setMsg(null);
  };

  const onClearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    setTestResult(null);
    if (photoRef.current) photoRef.current.value = "";
  };

  const onRunGemini = async () => {
    if (!isAdmin || !photoFile) return;
    setPredicting(true);
    setErr(null);
    setMsg(null);
    try {
      const body = await predictGeminiPhoto(authFetch, photoFile);
      setTestResult(body);
      if (body.settings) setSettings(body.settings);
      else refresh();
      if (body.ok) {
        setMsg(
          `Gemini: ${body.gemini?.label || body.gemini?.scenario || "done"} (${formatTrackLabel(body.gemini?.track)})`
        );
      } else {
        setErr(body.error || body.gemini?.error || "Gemini prediction failed.");
      }
    } catch (e) {
      setErr(e.message || "Gemini prediction failed.");
    } finally {
      setPredicting(false);
    }
  };

  const last = settings?.last_prediction;

  return (
    <Card glow={settings?.key_configured} className="mb-4 min-h-0 xl:col-span-2">
      <Card.Header
        icon={Sparkles}
        title="Gemini Vision & voice source"
        accent="text-violet-400"
        right={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />
      <Card.Body className="space-y-5">
        <p className="text-sm text-slate-400">
          Paste your Gemini API key and choose how auto voice commands are chosen
          after each ESP32 photo. Tracks stay the same (0001–0004). The key is
          stored on the backend and never shown in full.
        </p>

        {(error || err) && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {err || error}
          </div>
        )}
        {msg ? (
          <div className="flex items-start gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {msg}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gemini API key
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                autoComplete="off"
                disabled={!isAdmin || saving}
                placeholder={
                  settings?.key_configured
                    ? `Configured ···${settings.key_last4 || "****"} (leave blank to keep)`
                    : "Paste Gemini API key"
                }
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {settings?.key_configured ? (
                <span className="rounded-full border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 font-semibold text-brand-400">
                  Key configured ···{settings.key_last4}
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">
                  No key — Gemini voice disabled until set
                </span>
              )}
              {isAdmin && settings?.key_configured ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClearKey}
                  className="text-slate-500 underline-offset-2 hover:text-red-400 hover:underline disabled:opacity-50"
                >
                  Clear key
                </button>
              ) : null}
            </div>

            <label className="mt-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Model
            </label>
            <input
              type="text"
              disabled={!isAdmin || saving}
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Volume2 className="h-3.5 w-3.5" />
              Voice command source
            </div>
            <div className="space-y-2">
              {options.map((opt) => {
                const active = voiceSource === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition ${
                      active
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-slate-700/50 bg-slate-950/40 hover:border-slate-600"
                    } ${!isAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="voice_source"
                      value={opt.value}
                      checked={active}
                      disabled={!isAdmin || saving}
                      onChange={() => setVoiceSource(opt.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-100">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {isAdmin ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Gemini settings
          </button>
        ) : (
          <p className="text-sm text-slate-500">
            Admin role required to edit Gemini settings.
          </p>
        )}

        <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Test photo → Gemini prediction
            </h3>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            Upload any bin photo to see the Gemini scenario (fill, litter, animal,
            track). Does not play on the ESP32 voice board.
          </p>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/80">
              <div className="relative aspect-square w-full">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Test upload"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
                    No photo
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-violet-500/40 hover:text-violet-300">
                  <Upload className="h-4 w-4" />
                  Choose photo
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={!isAdmin || predicting}
                    onChange={onPickPhoto}
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    !isAdmin ||
                    predicting ||
                    !photoFile ||
                    !settings?.key_configured
                  }
                  onClick={onRunGemini}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {predicting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {predicting ? "Analyzing…" : "Get Gemini prediction"}
                </button>
                {photoFile ? (
                  <button
                    type="button"
                    onClick={onClearPhoto}
                    className="text-sm text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {!settings?.key_configured ? (
                <p className="text-xs text-amber-300">
                  Save a Gemini API key above before running a test.
                </p>
              ) : null}
              {testResult?.gemini ? (
                <div className="max-w-md">
                  <PredBlock title="This upload — Gemini" data={testResult.gemini} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Latest prediction
            </h3>
            <span className="text-xs text-slate-500">
              {last?.at
                ? formatTs(last.at)
                : "Upload a test photo or wait for an ESP32 capture…"}
              {last?.source === "settings_upload" ? " · test upload" : ""}
              {last?.voice_source ? ` · mode: ${last.voice_source}` : ""}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <PredBlock title="Our models (YOLO)" data={last?.yolo} />
            <PredBlock
              title="Gemini"
              data={last?.gemini}
              empty="Gemini not run (mode is Our models), or no capture yet."
            />
            <PredBlock
              title="Final voice"
              data={last?.final}
              empty="No voice scenario chosen yet."
            />
          </div>
          {last?.event_id || last?.capture_id ? (
            <p className="mt-2 text-xs text-slate-600">
              {last.event_id ? `Event ${last.event_id}` : ""}
              {last.event_id && last.capture_id ? " · " : ""}
              {last.capture_id ? `Capture #${last.capture_id}` : ""}
              {last.motion_session_id
                ? ` · Session ${last.motion_session_id}`
                : ""}
            </p>
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}
