import { useEffect, useState } from "react";
import { Volume2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Card from "./Card";
import {
  VOICE_POLICY_OPTIONS,
  saveAudioSettings,
} from "../../hooks/useAudioSettings";

export default function VoicePolicyCard({
  authFetch,
  isAdmin,
  settings,
  loading,
  onSaved,
}) {
  const [policy, setPolicy] = useState("classic");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const options =
    Array.isArray(settings?.voice_policy_options) &&
    settings.voice_policy_options.length > 0
      ? settings.voice_policy_options
      : VOICE_POLICY_OPTIONS;

  useEffect(() => {
    if (!settings) return;
    setPolicy(settings.voice_policy === "quality" ? "quality" : "classic");
  }, [settings]);

  const dirty =
    (settings?.voice_policy || "classic") !== policy && isAdmin && !loading;

  const onSave = async () => {
    if (!isAdmin || !dirty) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const saved = await saveAudioSettings(authFetch, {
        voice_policy: policy,
        enable_animal_on_predict: Boolean(
          settings?.enable_animal_on_predict
        ),
      });
      setMsg(
        policy === "quality"
          ? "Quality (change-based) voice method is active."
          : "Classic (timed) voice method is active."
      );
      onSaved?.(saved);
    } catch (e) {
      setErr(e.message || "Could not save voice method.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header
        icon={Volume2}
        title="Voice command method"
        accent="text-sky-400"
      />
      <Card.Body className="space-y-4">
        <p className="text-sm text-slate-400">
          Switch how auto voice works after each ESP32 bin photo. Keep{" "}
          <span className="text-slate-200">Classic</span> for viva demos; use{" "}
          <span className="text-slate-200">Quality</span> when you want voice
          only when the prediction changes (correct dump thank-you, illegal
          dumping, etc.) without spam.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {options.map((opt) => {
            const id = opt.id || opt.value;
            const active = policy === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!isAdmin || saving || loading}
                onClick={() => {
                  setPolicy(id);
                  setMsg("");
                  setErr("");
                }}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-sky-500/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]"
                    : "border-slate-700/60 bg-slate-950/40 hover:border-slate-600"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">
                    {opt.label}
                  </span>
                  {active ? (
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      Active
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {opt.summary}
                </p>
              </button>
            );
          })}
        </div>

        {!isAdmin ? (
          <p className="text-sm text-amber-300/90">
            Admin login required to change the voice method.
          </p>
        ) : (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save voice method"}
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
