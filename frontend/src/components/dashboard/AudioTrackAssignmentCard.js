import React, { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import Card from "./Card";
import {
  AUTO_CONDITION_OPTIONS,
  BUILTIN_LABELS,
  BUILTIN_SCENARIO_KEYS,
  defaultAudioSettings,
  formatTrackLabel,
  mp3Path,
  saveAudioSettings,
} from "../../hooks/useAudioSettings";
import { btnPrimary, btnSecondary } from "./dashboardUi";

export default function AudioTrackAssignmentCard({
  settings,
  loading,
  error,
  authFetch,
  isAdmin,
  onSaved,
}) {
  const [tracks, setTracks] = useState(defaultAudioSettings().tracks);
  const [customScenarios, setCustomScenarios] = useState([]);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTracks({ ...defaultAudioSettings().tracks, ...(settings.tracks || {}) });
    setCustomScenarios(
      Array.isArray(settings.custom_scenarios)
        ? settings.custom_scenarios.map((c) => ({ ...c }))
        : []
    );
  }, [settings]);

  const labels = settings?.builtin_labels || BUILTIN_LABELS;

  const onTrackChange = (key, value) => {
    setTracks((prev) => ({ ...prev, [key]: value }));
  };

  const addCustom = () => {
    setCustomScenarios((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        label: "",
        track: 5 + prev.length,
        auto_condition: "manual_only",
      },
    ]);
  };

  const updateCustom = (index, field, value) => {
    setCustomScenarios((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeCustom = (index) => {
    setCustomScenarios((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const payload = {
        tracks: Object.fromEntries(
          BUILTIN_SCENARIO_KEYS.map((key) => [
            key,
            Number(tracks[key]) || defaultAudioSettings().tracks[key],
          ])
        ),
        custom_scenarios: customScenarios.map((row) => ({
          id: row.id,
          label: row.label,
          track: Number(row.track),
          auto_condition: row.auto_condition || "manual_only",
        })),
      };
      const saved = await saveAudioSettings(authFetch, payload);
      setSaveMsg("Audio track mapping saved.");
      onSaved?.(saved);
    } catch (e) {
      setSaveErr(e.message || "Could not save audio settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header
        title="Audio track assignment"
        subtitle="Enter track numbers only (e.g. 1 → /MP3/0001.mp3). After ESP32 /predict, every model runs and the highest-confidence result picks the audio."
      />
      <Card.Body className="space-y-5">
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {BUILTIN_SCENARIO_KEYS.map((key) => {
            const trackNum = tracks[key] ?? defaultAudioSettings().tracks[key];
            return (
              <label
                key={key}
                className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-3"
              >
                <span className="block text-sm font-semibold text-slate-200">
                  {labels[key] || BUILTIN_LABELS[key]}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Auto-play priority:{" "}
                  {key === "illegal_dumping"
                    ? "1 (highest)"
                    : key === "waste_full"
                      ? "2"
                      : key === "animal_detected"
                        ? "3"
                        : "4 (when clean)"}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    disabled={!isAdmin || loading}
                    value={trackNum}
                    onChange={(e) => onTrackChange(key, e.target.value)}
                    className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">
                    → {mp3Path(trackNum)}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Other / custom tracks
            </h3>
            {isAdmin ? (
              <button type="button" onClick={addCustom} className={btnSecondary}>
                <Plus className="h-3.5 w-3.5" />
                Add track
              </button>
            ) : null}
          </div>

          {customScenarios.length === 0 ? (
            <p className="text-sm text-slate-500">
              Optional extra MP3 slots for manual testing or auto rules (e.g. HIGH
              risk).
            </p>
          ) : (
            <div className="space-y-2">
              {customScenarios.map((row, index) => (
                <div
                  key={row.id || index}
                  className="grid gap-2 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 sm:grid-cols-[1fr_100px_180px_auto]"
                >
                  <input
                    type="text"
                    placeholder="Label (e.g. Maintenance)"
                    disabled={!isAdmin}
                    value={row.label}
                    onChange={(e) =>
                      updateCustom(index, "label", e.target.value)
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    disabled={!isAdmin}
                    value={row.track}
                    onChange={(e) =>
                      updateCustom(index, "track", e.target.value)
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                  <select
                    disabled={!isAdmin}
                    value={row.auto_condition || "manual_only"}
                    onChange={(e) =>
                      updateCustom(index, "auto_condition", e.target.value)
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
                  >
                    {AUTO_CONDITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => removeCustom(index)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 hover:bg-red-500/20"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving || loading}
              onClick={onSave}
              className={btnPrimary}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save track mapping"}
            </button>
            {saveMsg ? (
              <span className="text-sm text-brand-400">{saveMsg}</span>
            ) : null}
            {saveErr ? (
              <span className="text-sm text-red-400">{saveErr}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Admin role required to edit track numbers.
          </p>
        )}

        <p className="text-xs text-slate-500">
          Preview format: track {formatTrackLabel(7)} = {mp3Path(7)}
        </p>
      </Card.Body>
    </Card>
  );
}
