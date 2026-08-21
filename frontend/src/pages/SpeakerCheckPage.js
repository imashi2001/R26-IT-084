import React, { useCallback, useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../utils/apiBase";

/**
 * Speaker Check — queue a LAN speaker test via the backend; the laptop bridge
 * relays GET /speaker/test to the ESP32 (HTTPS sites cannot call private IPs).
 */
export default function SpeakerCheckPage() {
  const { user, authFetch } = useAuth();
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [msgs, setMsgs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/devices"));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDevices(Array.isArray(body.devices) ? body.devices : []);
    } catch (e) {
      setError(e.message || "Could not load devices.");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onTest = async (deviceId) => {
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
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Volume2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Speaker check
              </h1>
              <p className="text-sm text-slate-600">
                Queue a test tone on the ESP32 buzzer. The laptop bridge relays
                the command (Railway cannot reach LAN cameras directly).
              </p>
            </div>
          </div>
        </header>

        {!isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Admin role required to queue speaker tests. You can still view
            connected cameras below.
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Flash VisionWaste speaker routes on the ESP32 (see <code>VisionWaste/esp32-cam</code>).</li>
            <li>Set each bin’s <strong>Camera base URL</strong> in Admin (e.g. <code>http://10.158.245.191</code>).</li>
            <li>Run the bridge with matching <code>DEVICE_ESP32_ID</code>.</li>
            <li>Click <strong>Test speaker</strong> — bridge polls every ~5s and hits <code>/speaker/test</code>.</li>
          </ol>
          <p className="mt-2 text-slate-500">
            Same Wi‑Fi direct link (opens in a new tab from a LAN machine only):{" "}
            <code>/speaker/test</code> on the camera IP.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">
            Connected cameras ({devices.length})
          </h2>
          <button
            type="button"
            onClick={loadDevices}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading bins…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-500">
            No bins yet. Create one under Admin / Settings.
          </p>
        ) : (
          <ul className="space-y-3">
            {devices.map((d) => {
              const base = (d.camera_base_url || "").replace(/\/+$/, "");
              const directTest = base ? `${base}/speaker/test` : null;
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {d.name}
                        <span className="ml-2 text-xs font-normal uppercase tracking-wide text-slate-500">
                          {d.status || "active"}
                        </span>
                      </p>
                      <p className="text-sm text-slate-600">
                        ESP32 ID:{" "}
                        <code className="rounded bg-slate-100 px-1">
                          {d.esp32_id || "—"}
                        </code>
                      </p>
                      <p className="text-sm text-slate-600">
                        Camera URL:{" "}
                        {base ? (
                          <code className="break-all rounded bg-slate-100 px-1">
                            {base}
                          </code>
                        ) : (
                          <span className="text-amber-700">
                            not set — bridge will use its ESP32_CAPTURE_URL base
                          </span>
                        )}
                      </p>
                      {d.pending_speaker_action && (
                        <p className="text-xs text-emerald-700">
                          Pending: {d.pending_speaker_action}
                          {d.pending_speaker_at
                            ? ` @ ${new Date(d.pending_speaker_at).toLocaleString()}`
                            : ""}
                        </p>
                      )}
                      {msgs[d.id] && (
                        <p className="text-sm text-slate-700">{msgs[d.id]}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <button
                        type="button"
                        disabled={!isAdmin || busyId === d.id}
                        onClick={() => onTest(d.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Volume2 className="h-4 w-4" aria-hidden />
                        {busyId === d.id ? "Queuing…" : "Test speaker"}
                      </button>
                      {directTest && (
                        <a
                          href={directTest}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-500 underline hover:text-slate-800"
                        >
                          Same Wi‑Fi direct test
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
