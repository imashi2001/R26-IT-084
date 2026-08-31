import React, { useState } from "react";
import { Volume2, Square } from "lucide-react";
import {
  formatTrackLabel,
  mp3Path,
} from "../../hooks/useAudioSettings";
import {
  runRemoteAudioStop,
  runRemoteAudioTest,
} from "../../utils/audioTest";
import { btnPrimary, btnSecondary } from "./dashboardUi";

/**
 * Manual DFPlayer track tests for a single bin.
 */
export default function AudioTrackTestPanel({
  device,
  tracks,
  authFetch,
  isAdmin,
  compact = false,
}) {
  const [status, setStatus] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [stopBusy, setStopBusy] = useState(false);

  const hasEsp32 = Boolean(device?.esp32_id && String(device.esp32_id).trim());
  const list = Array.isArray(tracks) ? tracks : [];

  const onPlay = async (track, label) => {
    if (!device?.id || !hasEsp32) return;
    const key = `${device.id}:${track}`;
    setBusyKey(key);
    setStatus(null);
    try {
      await runRemoteAudioTest({
        authFetch,
        deviceId: device.id,
        track,
        onStatus: setStatus,
      });
    } catch (e) {
      setStatus(`${label}: ${e.message || "Test failed."}`);
    } finally {
      setBusyKey(null);
    }
  };

  const onStop = async () => {
    if (!device?.id || !hasEsp32) return;
    setStopBusy(true);
    setStatus(null);
    try {
      await runRemoteAudioStop({
        authFetch,
        deviceId: device.id,
        onStatus: setStatus,
      });
    } catch (e) {
      setStatus(e.message || "Stop failed.");
    } finally {
      setStopBusy(false);
      setBusyKey(null);
    }
  };

  if (!hasEsp32) {
    return (
      <p className="text-sm text-slate-500">
        Set an ESP32 ID on this bin to test DFPlayer audio remotely.
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-slate-500">
        Admin role required to queue remote audio tests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!compact ? (
        <p className="text-sm text-slate-400">
          Each button queues <code className="text-brand-400">PLAY_AUDIO</code>{" "}
          for track N → {mp3Path(1).replace("0001", "000N")} on the ESP32.
        </p>
      ) : null}

      <div
        className={
          compact
            ? "flex flex-wrap gap-2"
            : "grid gap-2 sm:grid-cols-2"
        }
      >
        {list.map((row) => {
          const label = formatTrackLabel(row.track);
          const busy = busyKey === `${device.id}:${row.track}`;
          return (
            <button
              key={`${row.key}-${row.track}`}
              type="button"
              disabled={busyKey != null || stopBusy}
              onClick={() => onPlay(row.track, row.label)}
              className={
                compact
                  ? "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-brand-500/40 hover:text-brand-300 disabled:opacity-50"
                  : btnSecondary + " justify-start text-left"
              }
              title={mp3Path(row.track)}
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {busy ? "Playing…" : `${row.label} (${label})`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={stopBusy || busyKey != null}
        onClick={onStop}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        <Square className="h-3.5 w-3.5" />
        {stopBusy ? "Stopping…" : "Stop playback"}
      </button>

      {status ? (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          {status}
        </p>
      ) : null}
    </div>
  );
}
