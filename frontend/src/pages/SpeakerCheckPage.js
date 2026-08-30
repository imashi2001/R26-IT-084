import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Volume2 } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import ListRow from "../components/dashboard/ListRow";
import EmptyState from "../components/dashboard/EmptyState";
import PageSkeleton from "../components/dashboard/PageSkeleton";
import StatusBanner from "../components/dashboard/StatusBanner";
import useDevicesOverview from "../hooks/useDevicesOverview";
import { useAuth } from "../context/AuthContext";
import {
  btnPrimary,
  btnSecondary,
  btnGhost,
  statusBadgeClass,
  bannerTone,
} from "../components/dashboard/dashboardUi";
import {
  formatLastSeen,
  isCameraOnline,
  runRemoteAudioStop,
  runRemoteAudioTest,
} from "../utils/audioTest";

export default function SpeakerCheckPage() {
  const { user, authFetch } = useAuth();
  const { devices, loading, error, refresh } = useDevicesOverview(60_000);
  const [msgs, setMsgs] = useState({});
  const [audioMsgs, setAudioMsgs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [audioBusyKey, setAudioBusyKey] = useState(null);
  const [stopBusyId, setStopBusyId] = useState(null);

  const loadDevices = useCallback(() => refresh(), [refresh]);

  const onTestSpeaker = async (deviceId) => {
    setBusyId(deviceId);
    setMsgs((m) => ({ ...m, [deviceId]: null }));
    try {
      const res = await authFetch(`/devices/${deviceId}/speaker-test`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMsgs((m) => ({
        ...m,
        [deviceId]:
          body.message ||
          "Command queued — keep the bridge running; ESP32 should sound within ~5s.",
      }));
    } catch (e) {
      setMsgs((m) => ({
        ...m,
        [deviceId]: e.message || "Failed to queue speaker test.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  const onTestAudio = async (d, track = 1) => {
    if (!d?.esp32_id) return;
    const busyKey = `${d.id}:${track}`;
    setAudioBusyKey(busyKey);
    setAudioMsgs((m) => ({ ...m, [d.id]: null }));
    try {
      await runRemoteAudioTest({
        authFetch,
        deviceId: d.id,
        track,
        onStatus: (msg) => setAudioMsgs((m) => ({ ...m, [d.id]: msg })),
      });
      loadDevices();
    } catch (e) {
      setAudioMsgs((m) => ({
        ...m,
        [d.id]: e.message || "Audio test failed.",
      }));
    } finally {
      setAudioBusyKey(null);
    }
  };

  const onStopAudio = async (d) => {
    if (!d?.esp32_id) return;
    setStopBusyId(d.id);
    setAudioMsgs((m) => ({ ...m, [d.id]: null }));
    try {
      await runRemoteAudioStop({
        authFetch,
        deviceId: d.id,
        onStatus: (msg) => setAudioMsgs((m) => ({ ...m, [d.id]: msg })),
      });
      loadDevices();
    } catch (e) {
      setAudioMsgs((m) => ({
        ...m,
        [d.id]: e.message || "Stop failed.",
      }));
    } finally {
      setStopBusyId(null);
      setAudioBusyKey(null);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <DashboardLayout>
      {loading && devices.length === 0 ? (
        <PageSkeleton rows={4} />
      ) : (
        <PageShell
          banner={
            error
              ? { tone: "error", text: error, onRetry: loadDevices }
              : !isAdmin
                ? {
                    tone: "warn",
                    text: "Admin role required to queue speaker / audio tests.",
                  }
                : null
          }
        >
          <PageHeader
            title="Speaker Check"
            subtitle="Test the laptop-bridge speaker relay or remote ESP32 DFPlayer audio queue."
            actions={
              <button
                type="button"
                onClick={loadDevices}
                disabled={loading}
                className={btnSecondary}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            }
          />

          <Card>
            <Card.Header icon={Volume2} title="How it works" accent="text-brand-400" />
            <Card.Body className="space-y-2 text-sm text-slate-400">
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  <strong className="text-slate-300">Test speaker</strong> — bridge polls{" "}
                  <code className="text-brand-400">/bridge/speaker-pending</code>
                </li>
                <li>
                  <strong className="text-slate-300">Test Audio 0001 / 0002</strong> — queues{" "}
                  <code className="text-brand-400">PLAY_AUDIO</code> on DFPlayer
                </li>
                <li>
                  <strong className="text-slate-300">Stop</strong> — queues{" "}
                  <code className="text-brand-400">STOP_AUDIO</code>
                </li>
              </ol>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header
              title={`Connected cameras (${devices.length})`}
              subtitle="Per-device audio test controls"
            />
            <Card.Body className="space-y-3">
              {devices.length === 0 ? (
                <EmptyState
                  title="No bins yet"
                  message="Register bins under Bin Status."
                  action={
                    <Link to="/bins" className={btnSecondary}>
                      Open Bin Status
                    </Link>
                  }
                />
              ) : (
                devices.map((d) => {
                  const base = (d.camera_base_url || "").replace(/\/+$/, "");
                  const directTest = base ? `${base}/speaker/test` : null;
                  const hasEsp32 = Boolean(d.esp32_id && String(d.esp32_id).trim());
                  const camOnline = isCameraOnline(d);
                  return (
                    <ListRow key={d.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-base font-semibold text-slate-100">
                            {d.name}
                            <span
                              className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(d.status)}`}
                            >
                              {d.status || "active"}
                            </span>
                            {hasEsp32 ? (
                              <span
                                className={`ml-2 text-xs font-medium ${camOnline ? "text-brand-400" : "text-slate-500"}`}
                              >
                                Camera {camOnline ? "Online" : "Offline"}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-slate-400">
                            ESP32:{" "}
                            <code className="rounded bg-slate-800/80 px-1 text-brand-300">
                              {d.esp32_id || "—"}
                            </code>
                          </p>
                          {hasEsp32 ? (
                            <p className="text-sm text-slate-500">
                              Last seen: {formatLastSeen(d.last_seen_at)}
                            </p>
                          ) : null}
                          {msgs[d.id] ? (
                            <p className={`rounded-lg border px-2 py-1 text-xs ${bannerTone("brand")}`}>
                              {msgs[d.id]}
                            </p>
                          ) : null}
                          {audioMsgs[d.id] ? (
                            <p className={`rounded-lg border px-2 py-1 text-xs ${bannerTone("info")}`}>
                              {audioMsgs[d.id]}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <button
                            type="button"
                            disabled={
                              !isAdmin ||
                              !hasEsp32 ||
                              audioBusyKey != null ||
                              stopBusyId === d.id
                            }
                            onClick={() => onTestAudio(d, 1)}
                            className={btnPrimary}
                          >
                            {audioBusyKey === `${d.id}:1` ? "Testing…" : "Test Audio 0001"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              !isAdmin ||
                              !hasEsp32 ||
                              audioBusyKey != null ||
                              stopBusyId === d.id
                            }
                            onClick={() => onTestAudio(d, 2)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                          >
                            {audioBusyKey === `${d.id}:2` ? "Testing…" : "Test Audio 0002"}
                          </button>
                          <button
                            type="button"
                            disabled={!isAdmin || !hasEsp32 || stopBusyId === d.id}
                            onClick={() => onStopAudio(d)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {stopBusyId === d.id ? "Stopping…" : "Stop"}
                          </button>
                          <button
                            type="button"
                            disabled={!isAdmin || busyId === d.id}
                            onClick={() => onTestSpeaker(d.id)}
                            className={btnSecondary}
                          >
                            {busyId === d.id ? "Queuing…" : "Test speaker (bridge)"}
                          </button>
                          {directTest ? (
                            <a
                              href={directTest}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-slate-500 underline hover:text-brand-400"
                            >
                              Same Wi‑Fi direct test
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </ListRow>
                  );
                })
              )}
            </Card.Body>
          </Card>
        </PageShell>
      )}
    </DashboardLayout>
  );
}
