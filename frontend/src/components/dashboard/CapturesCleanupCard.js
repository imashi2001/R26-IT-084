import { useCallback, useEffect, useState } from "react";
import { Trash2, RefreshCw, AlertCircle, CheckCircle2, Image } from "lucide-react";
import Card from "./Card";

const PRESETS = [
  { id: "all", label: "Delete all photos", olderThanDays: null, all: true },
  { id: "7", label: "Older than 7 days", olderThanDays: 7, all: false },
  { id: "30", label: "Older than 30 days", olderThanDays: 30, all: false },
  {
    id: "keep50",
    label: "Keep newest 50 only",
    olderThanDays: null,
    all: false,
    keepLatest: 50,
  },
];

export default function CapturesCleanupCard({ authFetch, isAdmin }) {
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState("7");
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await authFetch("/captures/stats");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setTotal(Number(body.total) || 0);
    } catch (e) {
      setErr(e.message || "Failed to load capture count");
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const selected = PRESETS.find((p) => p.id === preset) || PRESETS[1];
  const needsTypeDelete = selected.id === "all";
  const canDelete =
    isAdmin &&
    !busy &&
    total != null &&
    total > 0 &&
    (!needsTypeDelete || confirmText.trim().toUpperCase() === "DELETE");

  const onDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const q = new URLSearchParams();
      if (selected.all) q.set("all", "1");
      if (selected.olderThanDays != null) {
        q.set("older_than_days", String(selected.olderThanDays));
      }
      if (selected.keepLatest != null) {
        q.set("keep_latest", String(selected.keepLatest));
      }
      const res = await authFetch(`/captures?${q.toString()}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setMsg(body.message || `Deleted ${body.deleted} photo(s).`);
      setTotal(Number(body.remaining) || 0);
      setConfirmText("");
    } catch (e) {
      setErr(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header
        icon={Image}
        title="Capture photos"
        accent="text-rose-400"
      />
      <Card.Body className="space-y-4">
        <p className="text-sm text-slate-400">
          Bin camera uploads pile up in the database. Clear old captures here
          (images + linked predictions/alerts). New motion photos will keep
          saving after cleanup.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Stored captures
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {loading ? "…" : total == null ? "—" : total.toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={loadStats}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {!isAdmin ? (
          <p className="text-sm text-amber-300/90">
            Admin login required to delete photos.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cleanup action
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESETS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                      preset === p.id
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                        : "border-slate-700/60 bg-slate-950/40 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="capture-cleanup"
                      className="accent-rose-500"
                      checked={preset === p.id}
                      onChange={() => {
                        setPreset(p.id);
                        setConfirmText("");
                        setMsg("");
                        setErr("");
                      }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {needsTypeDelete ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Type DELETE to confirm wipe
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-rose-500/60 focus:outline-none"
                  autoComplete="off"
                />
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canDelete}
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={16} />
              {busy ? "Deleting…" : "Delete photos"}
            </button>
          </>
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
