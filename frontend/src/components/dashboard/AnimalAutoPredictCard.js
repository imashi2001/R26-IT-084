import { useEffect, useState } from "react";
import { PawPrint, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Card from "./Card";
import { saveAudioSettings } from "../../hooks/useAudioSettings";

/**
 * Toggle animal YOLO on ESP32 / auto /predict.
 * Manual Animal Detection tab (model=animal) always works regardless.
 */
export default function AnimalAutoPredictCard({
  authFetch,
  isAdmin,
  settings,
  loading,
  onSaved,
}) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!settings) return;
    setEnabled(Boolean(settings.enable_animal_on_predict));
  }, [settings]);

  const dirty =
    Boolean(settings?.enable_animal_on_predict) !== enabled &&
    isAdmin &&
    !loading;

  const onSave = async () => {
    if (!isAdmin || !dirty) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const saved = await saveAudioSettings(authFetch, {
        enable_animal_on_predict: enabled,
      });
      setMsg(
        enabled
          ? "Animal model is ON for ESP32 / auto predict."
          : "Animal model is OFF for ESP32 / auto predict. Manual Animal Detection tab still works."
      );
      onSaved?.(saved);
    } catch (e) {
      setErr(e.message || "Could not save animal setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header
        icon={PawPrint}
        title="Animal detection (auto predict)"
        accent="text-amber-400"
      />
      <Card.Body className="space-y-4">
        <p className="text-sm text-slate-400">
          Turn off the animal microservice on the main ESP32 bin pipeline when
          predictions are unreliable. Live captures then show{" "}
          <span className="text-slate-200">no animal detected</span> and no
          bounding boxes. The{" "}
          <span className="text-slate-200">Animal Detection</span> page still
          runs a manual <code className="text-amber-300">model=animal</code>{" "}
          test.
        </p>

        <label
          className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
            enabled
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-slate-700/60 bg-slate-950/40"
          } ${!isAdmin ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <div>
            <div className="text-sm font-semibold text-white">
              Run animal model on ESP32 / auto predict
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {enabled
                ? "ON — animal boxes and animal voice scenarios can appear from bin photos."
                : "OFF — auto pipeline skips animal; use Animal Detection tab for manual tests only."}
            </div>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 accent-amber-500"
            checked={enabled}
            disabled={!isAdmin || saving || loading}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setMsg("");
              setErr("");
            }}
          />
        </label>

        {!isAdmin ? (
          <p className="text-sm text-amber-300/90">
            Admin login required to change this setting.
          </p>
        ) : (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save animal setting"}
          </button>
        )}

        {err ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {err}
          </div>
        ) : null}
        {msg ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            {msg}
          </div>
        ) : null}
      </Card.Body>
    </Card>
  );
}
