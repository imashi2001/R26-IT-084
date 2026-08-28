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
  Leaf,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import PromoFooter from "../components/dashboard/PromoFooter";
import { useAuth } from "../context/AuthContext";
import useDashboardSettings, {
  DEFAULT_HERO_PATH,
  removeDashboardHero,
  removeDashboardPromo,
  uploadDashboardHero,
  uploadDashboardPromo,
} from "../hooks/useDashboardSettings";

function ImageUploadPanel({
  title,
  description,
  previewAspect = "aspect-[3/1]",
  previewOverlay,
  displayUrl,
  fileRef,
  onPick,
  onUpload,
  onRemove,
  onCancelPreview,
  uploading,
  hasCustom,
  updatedAt,
  saveLabel,
  err,
  msg,
  preview,
}) {
  const src = preview || displayUrl;

  return (
    <Card glow={hasCustom} className="min-h-0 xl:col-span-2">
      <Card.Header
        icon={ImagePlus}
        title={title}
        accent="text-brand-400"
        right={
          hasCustom ? (
            <span className="rounded-full border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400">
              Custom
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Default / gradient</span>
          )
        }
      />
      <Card.Body className="space-y-4">
        <p className="text-sm text-slate-400">{description}</p>

        <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/80">
          <div className={`relative min-h-[120px] w-full ${previewAspect}`}>
            {src ? (
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-slate-950" />
            )}
            {previewOverlay}
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
              onChange={onPick}
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
            {saveLabel}
          </button>
          {preview ? (
            <button
              type="button"
              onClick={onCancelPreview}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Cancel preview
            </button>
          ) : null}
          {hasCustom ? (
            <button
              type="button"
              disabled={uploading}
              onClick={onRemove}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove image
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

        {updatedAt ? (
          <p className="text-xs text-slate-500">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        ) : null}
      </Card.Body>
    </Card>
  );
}

export default function DashboardSettingsPage() {
  const { user, authFetch } = useAuth();
  const { settings, heroUrl, promoUrl, loading, error, refresh, setSettings } =
    useDashboardSettings();

  const heroFileRef = useRef(null);
  const promoFileRef = useRef(null);

  const [heroPreview, setHeroPreview] = useState(null);
  const [promoPreview, setPromoPreview] = useState(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [heroErr, setHeroErr] = useState(null);
  const [promoErr, setPromoErr] = useState(null);
  const [heroMsg, setHeroMsg] = useState(null);
  const [promoMsg, setPromoMsg] = useState(null);

  const pickImage = (setter, setErr, setMsg) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    setter(URL.createObjectURL(file));
    setErr(null);
    setMsg(null);
  };

  const onUploadHero = async () => {
    const file = heroFileRef.current?.files?.[0];
    if (!file) {
      setHeroErr("Choose an image first.");
      return;
    }
    setHeroUploading(true);
    setHeroErr(null);
    setHeroMsg(null);
    try {
      const body = await uploadDashboardHero(authFetch, file);
      setSettings((s) => ({
        ...(s || {}),
        ...body,
        has_custom_hero: true,
        default_hero: false,
      }));
      setHeroPreview(null);
      if (heroFileRef.current) heroFileRef.current.value = "";
      setHeroMsg("Dashboard hero image saved.");
      refresh();
    } catch (e) {
      setHeroErr(e.message || "Upload failed.");
    } finally {
      setHeroUploading(false);
    }
  };

  const onRemoveHero = async () => {
    setHeroUploading(true);
    setHeroErr(null);
    try {
      await removeDashboardHero(authFetch);
      setSettings((s) => ({
        ...(s || {}),
        hero_image_url: null,
        has_custom_hero: false,
        default_hero: true,
      }));
      setHeroPreview(null);
      if (heroFileRef.current) heroFileRef.current.value = "";
      setHeroMsg("Hero image removed.");
      refresh();
    } catch (e) {
      setHeroErr(e.message || "Could not remove hero image.");
    } finally {
      setHeroUploading(false);
    }
  };

  const onUploadPromo = async () => {
    const file = promoFileRef.current?.files?.[0];
    if (!file) {
      setPromoErr("Choose an image first.");
      return;
    }
    setPromoUploading(true);
    setPromoErr(null);
    setPromoMsg(null);
    try {
      const body = await uploadDashboardPromo(authFetch, file);
      setSettings((s) => ({
        ...(s || {}),
        ...body,
        has_custom_promo: true,
        default_promo: false,
      }));
      setPromoPreview(null);
      if (promoFileRef.current) promoFileRef.current.value = "";
      setPromoMsg("Sidebar promo image saved.");
      refresh();
    } catch (e) {
      setPromoErr(e.message || "Upload failed.");
    } finally {
      setPromoUploading(false);
    }
  };

  const onRemovePromo = async () => {
    setPromoUploading(true);
    setPromoErr(null);
    try {
      await removeDashboardPromo(authFetch);
      setSettings((s) => ({
        ...(s || {}),
        promo_image_url: null,
        has_custom_promo: false,
        default_promo: true,
      }));
      setPromoPreview(null);
      if (promoFileRef.current) promoFileRef.current.value = "";
      setPromoMsg("Sidebar promo image removed.");
      refresh();
    } catch (e) {
      setPromoErr(e.message || "Could not remove promo image.");
    } finally {
      setPromoUploading(false);
    }
  };

  const cancelHeroPreview = useCallback(() => {
    setHeroPreview(null);
    if (heroFileRef.current) heroFileRef.current.value = "";
  }, []);

  const cancelPromoPreview = useCallback(() => {
    setPromoPreview(null);
    if (promoFileRef.current) promoFileRef.current.value = "";
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload dashboard images — hero banner and sidebar &quot;Cleaner City,
          Better Tomorrow&quot; card.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error} — gradient fallbacks will show until the API is reachable.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ImageUploadPanel
          title="Dashboard Hero Image"
          description="Wide banner at the top of the main dashboard. Recommended 1200×400px or larger."
          displayUrl={heroUrl || DEFAULT_HERO_PATH}
          preview={heroPreview}
          fileRef={heroFileRef}
          onPick={pickImage(setHeroPreview, setHeroErr, setHeroMsg)}
          onUpload={onUploadHero}
          onRemove={onRemoveHero}
          onCancelPreview={cancelHeroPreview}
          uploading={heroUploading}
          hasCustom={settings?.has_custom_hero}
          updatedAt={settings?.hero_updated_at}
          saveLabel="Save hero image"
          err={heroErr}
          msg={heroMsg}
          previewOverlay={
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <div className="text-sm font-medium text-brand-400">Preview</div>
                <div className="text-lg font-bold text-white">
                  Good evening — dashboard hero
                </div>
              </div>
            </>
          }
        />

        <ImageUploadPanel
          title="Sidebar Promo — Cleaner City, Better Tomorrow"
          description="Background image for the green promo card at the bottom of the sidebar (bins in park / city scene from your mockup)."
          previewAspect="aspect-[16/9]"
          displayUrl={promoUrl}
          preview={promoPreview}
          fileRef={promoFileRef}
          onPick={pickImage(setPromoPreview, setPromoErr, setPromoMsg)}
          onUpload={onUploadPromo}
          onRemove={onRemovePromo}
          onCancelPreview={cancelPromoPreview}
          uploading={promoUploading}
          hasCustom={settings?.has_custom_promo}
          updatedAt={settings?.promo_updated_at}
          saveLabel="Save promo image"
          err={promoErr}
          msg={promoMsg}
          previewOverlay={
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <div className="text-xs font-bold text-white">Cleaner City,</div>
                <div className="text-xs font-bold text-brand-400">
                  Better Tomorrow
                </div>
              </div>
            </>
          }
        />

        <Card className="min-h-0">
          <Card.Header
            icon={Leaf}
            title="Live sidebar preview"
            accent="text-brand-400"
          />
          <Card.Body>
            <p className="mb-3 text-sm text-slate-400">
              This is how the promo card appears in the navigation sidebar.
            </p>
            <div className="max-w-xs rounded-xl border border-slate-800 bg-slate-950 p-1">
              <PromoFooter />
            </div>
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

        <Card className="min-h-0 xl:col-span-2">
          <Card.Header icon={Settings} title="Account" accent="text-violet-400" />
          <Card.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="text-slate-500">Signed in as</div>
                <div className="font-semibold text-white">
                  {user?.adminName || user?.name || user?.email || "Administrator"}
                </div>
                {user?.email ? (
                  <div className="text-slate-500">{user.email}</div>
                ) : null}
              </div>
              {!loading && (
                <div className="text-xs text-slate-500">
                  <div>
                    Hero:{" "}
                    {settings?.has_custom_hero ? "custom upload" : "default / gradient"}
                  </div>
                  <div className="mt-1">
                    Sidebar promo:{" "}
                    {settings?.has_custom_promo
                      ? "custom upload"
                      : "gradient only — upload above"}
                  </div>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>
    </DashboardLayout>
  );
}
