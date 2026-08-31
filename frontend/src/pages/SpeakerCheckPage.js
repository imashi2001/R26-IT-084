import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Volume2 } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import ListRow from "../components/dashboard/ListRow";
import EmptyState from "../components/dashboard/EmptyState";
import PageSkeleton from "../components/dashboard/PageSkeleton";
import AudioTrackAssignmentCard from "../components/dashboard/AudioTrackAssignmentCard";
import AudioTrackTestPanel from "../components/dashboard/AudioTrackTestPanel";
import useDevicesOverview from "../hooks/useDevicesOverview";
import useAudioSettings from "../hooks/useAudioSettings";
import { useAuth } from "../context/AuthContext";
import {
  btnSecondary,
  btnGhost,
  statusBadgeClass,
  bannerTone,
} from "../components/dashboard/dashboardUi";
import { formatLastSeen, isCameraOnline } from "../utils/audioTest";

export default function SpeakerCheckPage() {
  const { user, authFetch } = useAuth();
  const { devices, loading, error, refresh } = useDevicesOverview(60_000);
  const {
    settings: audioSettings,
    testTracks,
    loading: audioLoading,
    error: audioError,
    refresh: refreshAudio,
    setSettings: setAudioSettings,
  } = useAudioSettings();
  const [msgs, setMsgs] = useState({});
  const [busyId, setBusyId] = useState(null);

  const loadDevices = useCallback(() => {
    refresh();
    refreshAudio();
  }, [refresh, refreshAudio]);

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
            subtitle="Assign MP3 track numbers per scenario, then test on each bin."
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

          <AudioTrackAssignmentCard
            settings={audioSettings}
            loading={audioLoading}
            error={audioError}
            authFetch={authFetch}
            isAdmin={isAdmin}
            onSaved={(saved) => setAudioSettings(saved)}
          />

          <Card>
            <Card.Header icon={Volume2} title="How it works" accent="text-brand-400" />
            <Card.Body className="space-y-2 text-sm text-slate-400">
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  <strong className="text-slate-300">Save track mapping</strong> — maps
                  scenarios to DFPlayer files{" "}
                  <code className="text-brand-400">/MP3/000N.mp3</code>
                </li>
                <li>
                  <strong className="text-slate-300">Test tracks</strong> — queues{" "}
                  <code className="text-brand-400">PLAY_AUDIO</code> per bin
                </li>
                <li>
                  <strong className="text-slate-300">After ESP32 /predict</strong> — all
                  models run; the result with the{" "}
                  <strong className="text-slate-300">highest confidence %</strong>{" "}
                  picks which track plays
                </li>
                <li>
                  <strong className="text-slate-300">Test speaker (bridge)</strong> — LAN
                  buzzer via laptop bridge (separate from DFPlayer)
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
                          <Link
                            to={`/bins/${d.id}`}
                            className={`${btnGhost} mt-1 inline-flex text-xs`}
                          >
                            Open bin detail →
                          </Link>
                          {msgs[d.id] ? (
                            <p className={`rounded-lg border px-2 py-1 text-xs ${bannerTone("brand")}`}>
                              {msgs[d.id]}
                            </p>
                          ) : null}
                        </div>
                        <div className="min-w-[220px] shrink-0 space-y-2">
                          <AudioTrackTestPanel
                            device={d}
                            tracks={testTracks}
                            authFetch={authFetch}
                            isAdmin={isAdmin}
                            compact
                          />
                          <button
                            type="button"
                            disabled={!isAdmin || busyId === d.id}
                            onClick={() => onTestSpeaker(d.id)}
                            className={btnSecondary + " w-full"}
                          >
                            {busyId === d.id ? "Queuing…" : "Test speaker (bridge)"}
                          </button>
                          {directTest ? (
                            <a
                              href={directTest}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-center text-xs text-slate-500 underline hover:text-brand-400"
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
