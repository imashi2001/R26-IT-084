import { useEffect, useState } from "react";
import { AlertTriangle, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Card from "../dashboard/Card";
import {
  fetchLitterPopupSettings,
  saveLitterPopupSettings,
} from "../../utils/litterPopupSettings";

const SWITCHES = [
  {
    key: "popup_illegal_dumping",
    title: "Illegal dumping popup",
    on: "ON — a popup opens when the littering model catches someone dumping near a bin.",
    off: "OFF — no popup for illegal dumping. Alerts still appear on the Alerts page.",
  },
  {
    key: "popup_confirmed_only",
    title: "Only confirmed illegal dumping",
    on: (cfg) =>
      `ON — popup only after ${cfg.min_frames} littering photos within ${cfg.window_seconds}s, or one photo ≥ ${Math.round(cfg.strong_confidence * 100)}% confidence.`,
    off: "OFF — popup on every littering photo (more false alarms).",
    requires: "popup_illegal_dumping",
  },
  {
    key: "popup_add_bin",
    title: "\"Add a new bin\" popup",
    on: (_cfg, streak) => `ON — popup when a bin has HIGH litter on ${streak} captures in a row.`,
    off: "OFF — the add-bin recommendation only shows on bin badges and the Alerts page.",
  },
  {
    key: "popup_high_severity",
    title: "High litter severity popup",
    on: "ON — popup on every HIGH litter capture (can be frequent at busy bins).",
    off: "OFF — HIGH litter only shows on badges, Recent alerts and the Alerts page.",
  },
  {
    key: "popup_sound",
    title: "Sound for litter popups",
    on: "ON — the dashboard alert tone plays with litter popups.",
    off: "OFF — litter popups open silently. Animal popups keep their sound.",
  },
];

function describe(sw, value, settings) {
  const text = value ? sw.on : sw.off;
  return typeof text === "function"
    ? text(settings.confirmation, settings.add_bin_streak)
    : text;
}

/** Settings → on/off switches for litter severity + illegal dumping dashboard popups. */
export default function LitterPopupSettingsCard({ isAdmin }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchLitterPopupSettings()
      .then((s) => {
        if (cancelled) return;
        setSaved(s);
        setDraft(s);
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.response?.data?.error || e.message || "Could not load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    Boolean(saved && draft) && SWITCHES.some((sw) => saved[sw.key] !== draft[sw.key]);

  const onSave = async () => {
    if (!isAdmin || !dirty) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const patch = Object.fromEntries(SWITCHES.map((sw) => [sw.key, Boolean(draft[sw.key])]));
      const next = await saveLitterPopupSettings(patch);
      setSaved(next);
      setDraft(next);
      setMsg("Litter popup settings saved. Open dashboards update right away.");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Could not save litter popup settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header
        icon={AlertTriangle}
        title="Litter & illegal dumping popups"
        accent="text-orange-400"
      />
      <Card.Body className="space-y-4">
        <p className="text-sm text-slate-400">
          Choose which litter alerts open a popup on the dashboard. Alerts are still saved and
          listed on the <span className="text-slate-200">Alerts</span> page either way, and the
          bin speaker is not affected. Animal popups are controlled separately.
        </p>

        {!draft ? (
          <p className="text-sm text-slate-500">{err ? null : "Loading…"}</p>
        ) : (
          <div className="space-y-2">
            {SWITCHES.map((sw) => {
              const value = Boolean(draft[sw.key]);
              const blocked = sw.requires && !draft[sw.requires];
              const disabled = !isAdmin || saving || blocked;
              return (
                <label
                  key={sw.key}
                  className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
                    value && !blocked
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-slate-700/60 bg-slate-950/40"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{sw.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {blocked
                        ? "Turn on the illegal dumping popup to use this."
                        : describe(sw, value, draft)}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-orange-500"
                    checked={value}
                    disabled={disabled}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [sw.key]: e.target.checked }));
                      setMsg("");
                      setErr("");
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}

        {!isAdmin ? (
          <p className="text-sm text-amber-300/90">Admin login required to change this setting.</p>
        ) : (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save popup settings"}
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
