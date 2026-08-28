import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings,
  ImagePlus,
  Trash2,
  Upload,
  RefreshCw,
  Database,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import { useAuth } from "../context/AuthContext";
import useDashboardSettings, {
  DEFAULT_HERO_PATH,
  removeDashboardHero,
  resolveHeroUrl,
  uploadDashboardHero,
} from "../hooks/useDashboardSettings";

export default function DashboardSettingsPage() {
  const { user, authFetch } = useAuth();
  const { settings, heroUrl, loading, error, refresh, setSettings } =
    useDashboardSettings();
  const fileRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [preview, setPreview] = useState(null);

  const displayHero = preview || heroUrl || DEFAULT_HERO_PATH;

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setErr(null);
    setMsg(null);
  };

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Choose an image first.");
      return;
    }
    setUploading(true);
    setErr(null);
    setMsg(null);
    try {
      const body = await uploadDashboardHero(authFetch, file);
      setSettings((s) => ({
        ...(s || {}),
        hero_image_url: body.hero_image_url,
        has_custom_hero: true,
        hero_updated_at: body.hero_updated_at,
        default_hero: false,
      }));
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg("Dashboard hero image updated.");
      refresh();
    } catch (e) {
      setErr(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    setUploading(true);
    setErr(null);
    setMsg(null);
    try {
      await removeDashboardHero(authFetch);
      setSettings((s) => ({
        ...(s || {}),
        hero_image_url: null,
        has_custom_hero: false,
        default_hero: true,
      }));
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg("Restored default hero image.");
      refresh();
    } catch (e) {
      setErr(e.message || "Could not remove hero image.");
    } finally {
      setUploading(false);
    }
  };

  const cancelPreview = useCallback(() => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Customize the VisionWaste dashboard appearance and manage shortcuts.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error} — showing bundled default hero.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card glow className="min-h-0 xl:col-span-2">
          <Card.Header
            icon={ImagePlus}
            title="Dashboard Hero Image"
            accent="text-brand-400"
            right={
              settings?.has_custom_hero ? (
                <span className="rounded-full border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400">
                  Custom
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Default</span>
              )
            }
          />

          <Card.Body className="space-y-4">
            <p className="text-sm text-slate-400">
              This banner appears at the top of the main dashboard. Upload a wide
              image (recommended 1200×400px or larger) showing your smart bins or
              city branding.
            </p>

            <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/80">
              <div className="relative aspect-[3/1] min-h-[140px] w-full">
                <img
                  src={displayHero}
                  alt="Dashboard hero preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="text-sm font-medium text-brand-400">
                    Preview
                  </div>
                  <div className="text-lg font-bold text-white">
                    Good evening — dashboard hero
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-brand-500/40 hover:text-brand-400">
                <Upload className="h-4 w-4" />
                Choose image
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickFile}
                />
              </label>
              <button
                type="button"
                disabled={uploading || !fileRef.current?.files?.[0]}
                onClick={onUpload}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-brand transition hover:bg-brand-500 disabled:opacity-50"
              >
                {uploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save hero image
              </button>
              {preview ? (
                <button
                  type="button"
                  onClick={cancelPreview}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Cancel preview
                </button>
              ) : null}
              {settings?.has_custom_hero ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={onRemove}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Reset to default
                </button>
              ) : null}
            </div>

            {err ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {err}
              </div>
            ) : null}
            {msg ? (
              <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
                {msg}
              </div>
            ) : null}

            {settings?.hero_updated_at ? (
              <p className="text-xs text-slate-500">
                Last updated:{" "}
                {new Date(settings.hero_updated_at).toLocaleString()}
              </p>
            ) : null}
          </Card.Body>
        </Card>

        <Card className="min-h-0">
          <Card.Header icon={Database} title="Bin registry" accent="text-sky-400" />
          <Card.Body>
            <p className="text-sm text-slate-400">
              Add bins, map coordinates, ESP32 IDs, and camera URLs from the Bin
              Status page.
            </p>
            <Link
              to="/bins"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-brand-400 hover:bg-brand-500/20"
            >
              Open Bin Status
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Card.Body>
        </Card>

        <Card className="min-h-0">
          <Card.Header icon={Settings} title="Account" accent="text-violet-400" />
          <Card.Body>
            <div className="space-y-2 text-sm">
              <div className="text-slate-500">Signed in as</div>
              <div className="font-semibold text-white">
                {user?.adminName || user?.name || user?.email || "Administrator"}
              </div>
              {user?.email ? (
                <div className="text-slate-500">{user.email}</div>
              ) : null}
              {user?.municipalCouncil ? (
                <div className="text-slate-400">{user.municipalCouncil}</div>
              ) : null}
            </div>
            {!loading && (
              <p className="mt-4 text-xs text-slate-600">
                Current hero:{" "}
                {settings?.has_custom_hero ? "custom upload" : "default image"}
              </p>
            )}
          </Card.Body>
        </Card>
      </div>
    </DashboardLayout>
  );
}
