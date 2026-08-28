import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  PlusCircle,
  Pencil,
  RefreshCw,
  Search,
  XCircle,
  MapPin,
  Cpu,
  Wifi,
  Activity,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Save,
  CircleAlert,
  CircleCheck,
  Settings as SettingsIcon,
  Volume2,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import BinLocationPicker from "../components/bins/BinLocationPicker";
import {
  inputClass,
  selectClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
  fillBadgeClass,
  statusBadgeClass,
  riskBadgeClass,
  bannerTone,
  summaryTone,
} from "../components/bins/binStatusUi";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../utils/apiBase";
import {
  normalizeFill,
  effectiveFillTier,
  fillLabel,
} from "../utils/fillTier";
import {
  collectionUrgency,
  needsCollectionSoon,
} from "../utils/collectionPriority";
import {
  formatLastSeen,
  isCameraOnline,
  runRemoteAudioStop,
  runRemoteAudioTest,
} from "../utils/audioTest";

/*
 * /bins  - Bin Status (formerly the legacy /admin device-management UI).
 *
 * Dashboard-themed registry of all bins. Pulls GET /devices?latest=1 so each
 * row carries the latest fill level/% and risk band. Admin can:
 *   - Search by name / location / ESP32 ID
 *   - Filter by device status, fill tier, risk band
 *   - Sort by name | urgency | fill % | last update
 *   - Edit an existing bin (PATCH /devices/:id) — or quick-cycle its status
 *   - Register a new bin (POST /devices) with map-pick + Nominatim address search
 *
 * Keeps the same `authFetch` flow as the legacy AdminPage so JWT + role checks
 * keep working with no backend changes.
 */

const STATUS_OPTIONS = ["active", "inactive", "maintenance"];
const FILL_FILTERS = [
  { id: "all", label: "All fills" },
  { id: "empty", label: "Empty" },
  { id: "half", label: "Half" },
  { id: "overflow", label: "Overflow" },
  { id: "unknown", label: "Unknown" },
];
const RISK_FILTERS = [
  { id: "all", label: "All risk" },
  { id: "LOW", label: "LOW" },
  { id: "MEDIUM", label: "MEDIUM" },
  { id: "HIGH", label: "HIGH" },
  { id: "CRITICAL", label: "CRITICAL" },
];
const SORT_OPTIONS = [
  { id: "urgency", label: "Urgency (high → low)" },
  { id: "name", label: "Name (A → Z)" },
  { id: "fill_pct", label: "Fill % (high → low)" },
  { id: "captured_at", label: "Last update (newest)" },
];

const FORM_STEPS = [
  { id: "details", label: "Bin details", icon: Database },
  { id: "location", label: "Location", icon: MapPin },
  { id: "device", label: "Device link", icon: Cpu },
];

/* ============================ helpers ============================ */

function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function relativeFromNow(iso) {
  const t = parseTs(iso);
  if (!t) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}

const EMPTY_FORM = {
  name: "",
  esp32Id: "",
  bridgeInstanceId: "",
  cameraBaseUrl: "",
  status: "active",
  locationLabel: "",
  address: "",
  latitude: "",
  longitude: "",
  geoQuery: "",
};

/* ============================ page ============================ */

export default function BinStatusPage() {
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === "admin";

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fillFilter, setFillFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("urgency");

  const [editingId, setEditingId] = useState(null);
  const [formStep, setFormStep] = useState("details");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [audioBusyId, setAudioBusyId] = useState(null);
  const [stopBusyId, setStopBusyId] = useState(null);
  const [audioMsgs, setAudioMsgs] = useState({});

  /* ----- data ----- */

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbDisabled(false);
    try {
      const res = await fetch(apiUrl("/devices?latest=1"));
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setDbDisabled(true);
        setDevices([]);
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDevices(Array.isArray(body.devices) ? body.devices : []);
    } catch (e) {
      setError(e.message || "Could not load bins.");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onTestAudio = useCallback(
    async (device) => {
      if (!device?.id || !device?.esp32_id) return;
      setAudioBusyId(device.id);
      setAudioMsgs((m) => ({ ...m, [device.id]: null }));
      try {
        await runRemoteAudioTest({
          authFetch,
          deviceId: device.id,
          onStatus: (msg) =>
            setAudioMsgs((m) => ({ ...m, [device.id]: msg })),
        });
        loadDevices();
      } catch (e) {
        setAudioMsgs((m) => ({
          ...m,
          [device.id]: e.message || "Audio test failed.",
        }));
      } finally {
        setAudioBusyId(null);
      }
    },
    [authFetch, loadDevices]
  );

  const onStopAudio = useCallback(
    async (device) => {
      if (!device?.id || !device?.esp32_id) return;
      setStopBusyId(device.id);
      setAudioMsgs((m) => ({ ...m, [device.id]: null }));
      try {
        await runRemoteAudioStop({
          authFetch,
          deviceId: device.id,
          onStatus: (msg) =>
            setAudioMsgs((m) => ({ ...m, [device.id]: msg })),
        });
        loadDevices();
      } catch (e) {
        setAudioMsgs((m) => ({
          ...m,
          [device.id]: e.message || "Stop failed.",
        }));
      } finally {
        setStopBusyId(null);
        setAudioBusyId(null);
      }
    },
    [authFetch, loadDevices]
  );

  /* ----- summary chips ----- */

  const summary = useMemo(() => {
    let active = 0;
    let maintenance = 0;
    let inactive = 0;
    let overflow = 0;
    let highRisk = 0;
    let urgent = 0;
    let withCoords = 0;
    for (const d of devices) {
      const s = (d.status || "").toLowerCase();
      if (s === "active") active += 1;
      else if (s === "maintenance") maintenance += 1;
      else if (s === "inactive") inactive += 1;

      if (effectiveFillTier(d) === "overflow") overflow += 1;

      const r = (d.latest_risk_level || "").toUpperCase();
      if (r === "HIGH" || r === "CRITICAL") highRisk += 1;

      if (needsCollectionSoon(d)) urgent += 1;

      if (
        Number.isFinite(Number(d.latitude)) &&
        Number.isFinite(Number(d.longitude))
      ) {
        withCoords += 1;
      }
    }
    return {
      total: devices.length,
      active,
      maintenance,
      inactive,
      overflow,
      highRisk,
      urgent,
      withCoords,
    };
  }, [devices]);

  /* ----- filtered + sorted list ----- */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = devices.slice();

    if (q) {
      rows = rows.filter((d) => {
        const hay = [
          d.name,
          d.esp32_id,
          d.location,
          d.address,
          d.bridge_instance_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter(
        (d) => (d.status || "").toLowerCase() === statusFilter
      );
    }

    if (fillFilter !== "all") {
      rows = rows.filter((d) => (effectiveFillTier(d) || "unknown") === fillFilter);
    }

    if (riskFilter !== "all") {
      rows = rows.filter(
        (d) => (d.latest_risk_level || "").toUpperCase() === riskFilter
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortBy === "fill_pct") {
        const ap = Number(a.latest_fill_percentage);
        const bp = Number(b.latest_fill_percentage);
        const av = Number.isFinite(ap) ? ap : -1;
        const bv = Number.isFinite(bp) ? bp : -1;
        return bv - av;
      }
      if (sortBy === "captured_at") {
        return parseTs(b.latest_captured_at) - parseTs(a.latest_captured_at);
      }
      // urgency (default)
      return collectionUrgency(b) - collectionUrgency(a);
    });

    return rows;
  }, [devices, query, statusFilter, fillFilter, riskFilter, sortBy]);

  /* ----- form helpers ----- */

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormStep("details");
    setForm(EMPTY_FORM);
    setFormMsg(null);
    setFormError(null);
  }, []);

  const startEdit = (d) => {
    setEditingId(d.id);
    setFormStep("details");
    setForm({
      name: d.name || "",
      esp32Id: d.esp32_id || "",
      bridgeInstanceId: d.bridge_instance_id || "",
      cameraBaseUrl: d.camera_base_url || "",
      status: d.status || "active",
      locationLabel: d.location || "",
      address: d.address || "",
      latitude:
        d.latitude != null && Number.isFinite(Number(d.latitude))
          ? String(d.latitude)
          : "",
      longitude:
        d.longitude != null && Number.isFinite(Number(d.longitude))
          ? String(d.longitude)
          : "",
      geoQuery: d.address || d.location || "",
    });
    setFormMsg(null);
    setFormError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onSaveDevice = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormMsg(null);

    if (!isAdmin) {
      setFormError("Admin role required.");
      return;
    }

    const latRaw = form.latitude.trim();
    const lngRaw = form.longitude.trim();
    const lat = latRaw === "" ? null : Number(latRaw);
    const lng = lngRaw === "" ? null : Number(lngRaw);

    if (
      (lat !== null && !Number.isFinite(lat)) ||
      (lng !== null && !Number.isFinite(lng))
    ) {
      setFormError(
        "Latitude and longitude must be valid numbers (or leave blank)."
      );
      setFormStep("location");
      return;
    }
    if (lat !== null && (lat < -90 || lat > 90)) {
      setFormError("Latitude must be between -90 and 90.");
      setFormStep("location");
      return;
    }
    if (lng !== null && (lng < -180 || lng > 180)) {
      setFormError("Longitude must be between -180 and 180.");
      setFormStep("location");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Bin name is required.");
      setFormStep("details");
      return;
    }

    const payload = {
      name: form.name.trim(),
      status: form.status,
      esp32_id: form.esp32Id.trim() || null,
      bridge_instance_id: form.bridgeInstanceId.trim() || null,
      camera_base_url: form.cameraBaseUrl.trim().replace(/\/+$/, "") || null,
      location: form.locationLabel.trim() || null,
      address: form.address.trim() || null,
      latitude: lat,
      longitude: lng,
    };

    setBusy(true);
    try {
      const path = editingId ? `/devices/${editingId}` : "/devices";
      const method = editingId ? "PATCH" : "POST";
      const res = await authFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setFormMsg(
        editingId ? `Updated bin #${editingId}` : `Created bin #${body.id}`
      );
      resetForm();
      loadDevices();
    } catch (err) {
      setFormError(err.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const quickStatus = async (d, nextStatus) => {
    if (!isAdmin) return;
    try {
      const res = await authFetch(`/devices/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setFormMsg(`Bin #${d.id} status → ${nextStatus}`);
      setFormError(null);
      loadDevices();
    } catch (err) {
      setFormError(err.message || "Status update failed.");
      setFormMsg(null);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setFillFilter("all");
    setRiskFilter("all");
    setSortBy("urgency");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <PageHeader
          isAdmin={isAdmin}
          loading={loading}
          onRefresh={loadDevices}
          onAdd={() => {
            resetForm();
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
            const el = document.getElementById("bin-form");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

        {dbDisabled ? (
          <Banner
            tone="amber"
            icon={Database}
            title="Database not configured"
            body="Set DATABASE_URL on the backend service to enable bin registry persistence. The form will fail until then."
          />
        ) : null}

        {!isAdmin ? (
          <Banner
            tone="amber"
            icon={ShieldAlert}
            title="Read-only view"
            body={`Signed in as ${user?.email || "—"} (role: ${user?.role || "—"}). Admin role is required to create or edit bins.`}
          />
        ) : null}

        {error ? (
          <Banner
            tone="red"
            icon={AlertTriangle}
            title="Could not load bins"
            body={error}
          />
        ) : null}

        <SummaryRow summary={summary} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_minmax(400px,480px)]">
          {/* LEFT: list */}
          <div className="space-y-5">
            <Card>
              <Card.Header
                icon={Search}
                title="Search & filters"
                right={
                  query || statusFilter !== "all" || fillFilter !== "all" || riskFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className={btnGhost}
                    >
                      <XCircle className="h-3 w-3" />
                      Clear
                    </button>
                  ) : null
                }
              />
              <Card.Body className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, ESP32 ID, location, address…"
                    className={`${inputClass.replace("mt-1 ", "")} pl-9`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SelectField
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { id: "all", label: "All statuses" },
                      ...STATUS_OPTIONS.map((s) => ({ id: s, label: s })),
                    ]}
                  />
                  <SelectField
                    label="Fill"
                    value={fillFilter}
                    onChange={setFillFilter}
                    options={FILL_FILTERS}
                  />
                  <SelectField
                    label="Risk"
                    value={riskFilter}
                    onChange={setRiskFilter}
                    options={RISK_FILTERS}
                  />
                  <SelectField
                    label="Sort"
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                  />
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header
                icon={Database}
                title={editingId ? "Bins" : "Bin registry"}
                right={
                  <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {filtered.length} / {devices.length}
                  </span>
                }
              />
              <Card.Body className="!mt-2">
                {loading ? (
                  <ListSkeleton />
                ) : devices.length === 0 ? (
                  <EmptyState
                    title="No bins registered yet"
                    body="Use the form on the right to add your first bin. You can click the map to pick coordinates or search an address."
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    title="No bins match the current filters"
                    body="Adjust the search or clear filters to see more results."
                  />
                ) : (
                  <ul className="space-y-2">
                    {filtered.map((d) => (
                      <BinRow
                        key={d.id}
                        device={d}
                        editing={editingId === d.id}
                        canEdit={isAdmin}
                        onEdit={() => startEdit(d)}
                        onQuickStatus={(s) => quickStatus(d, s)}
                        onTestAudio={() => onTestAudio(d)}
                        onStopAudio={() => onStopAudio(d)}
                        audioBusy={audioBusyId === d.id}
                        stopBusy={stopBusyId === d.id}
                        audioMsg={audioMsgs[d.id] || null}
                      />
                    ))}
                  </ul>
                )}
              </Card.Body>
              <Card.Footer>
                Bins are sourced from <code className="rounded bg-slate-800/80 px-1 py-0.5 text-[10px] text-brand-400">GET /devices?latest=1</code>. Latest fill / risk reflects the most recent capture from any model.
              </Card.Footer>
            </Card>
          </div>

          {/* RIGHT: add / edit form */}
          <div id="bin-form" className="space-y-5">
            <Card glow={Boolean(editingId)}>
              <Card.Header
                icon={editingId ? Pencil : PlusCircle}
                title={editingId ? `Edit bin #${editingId}` : "Register new bin"}
                subtitle="Complete each section — use map, address search, or coordinates for location."
                right={
                  editingId ? (
                    <button type="button" onClick={resetForm} className={btnGhost}>
                      <XCircle className="h-3 w-3" />
                      Cancel edit
                    </button>
                  ) : null
                }
              />
              <Card.Body className="!mt-2">
                {formError ? (
                  <Banner
                    tone="red"
                    icon={CircleAlert}
                    title="Could not save"
                    body={formError}
                    compact
                  />
                ) : null}
                {formMsg ? (
                  <Banner
                    tone="brand"
                    icon={CircleCheck}
                    title="Success"
                    body={formMsg}
                    compact
                  />
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-1">
                  {FORM_STEPS.map(({ id, label, icon: Icon }, idx) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormStep(id)}
                      className={[
                        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition sm:flex-none sm:px-3",
                        formStep === id
                          ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/25"
                          : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300",
                      ].join(" ")}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden sm:inline">{idx + 1}.</span> {label}
                    </button>
                  ))}
                </div>

                <form className="mt-4 space-y-4" onSubmit={onSaveDevice}>
                  {formStep === "details" ? (
                    <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/20 p-3">
                      <FieldRow
                        label="Bin name"
                        required
                        value={form.name}
                        onChange={(v) => updateField("name", v)}
                        placeholder="e.g. Faculty Gate Bin"
                        disabled={!isAdmin || busy}
                      />
                      <SelectField
                        label="Operational status"
                        value={form.status}
                        onChange={(v) => updateField("status", v)}
                        options={STATUS_OPTIONS.map((s) => ({ id: s, label: s }))}
                        disabled={!isAdmin || busy}
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldRow
                          label="Location name"
                          value={form.locationLabel}
                          onChange={(v) => updateField("locationLabel", v)}
                          placeholder="e.g. Faculty gate"
                          disabled={!isAdmin || busy}
                        />
                        <FieldRow
                          label="Address (display)"
                          value={form.address}
                          onChange={(v) => updateField("address", v)}
                          placeholder="Street / city — filled by search or manual"
                          disabled={!isAdmin || busy}
                        />
                      </div>
                    </div>
                  ) : null}

                  {formStep === "location" ? (
                    <div className="rounded-xl border border-slate-800/50 bg-slate-950/20 p-3">
                      <p className="mb-3 text-xs text-slate-400">
                        Set the bin pin using <strong className="text-slate-300">any</strong> method below — map click, address search with result picker, manual coordinates, or GPS.
                      </p>
                      <BinLocationPicker
                        latitude={form.latitude}
                        longitude={form.longitude}
                        geoQuery={form.geoQuery}
                        onGeoQueryChange={(v) => updateField("geoQuery", v)}
                        onCoordsChange={(lat, lng) => {
                          setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
                        }}
                        onAddressPick={(label) => {
                          if (!form.address.trim()) updateField("address", label);
                          if (!form.locationLabel.trim()) {
                            const short = label.split(",")[0]?.trim();
                            if (short) updateField("locationLabel", short);
                          }
                        }}
                        disabled={!isAdmin || busy}
                      />
                    </div>
                  ) : null}

                  {formStep === "device" ? (
                    <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/20 p-3">
                      <FieldRow
                        label="ESP32 device ID"
                        helperRight="(matches bridge DEVICE_ESP32_ID)"
                        value={form.esp32Id}
                        onChange={(v) => updateField("esp32Id", v)}
                        placeholder="esp-cam-1"
                        disabled={!isAdmin || busy}
                        help="Required for ESP32-CAM captures and remote audio tests."
                      />
                      <FieldRow
                        label="Bridge / laptop ID"
                        helperRight="(optional)"
                        value={form.bridgeInstanceId}
                        onChange={(v) => updateField("bridgeInstanceId", v)}
                        placeholder="BRIDGE_xxxxxxxxxxxx"
                        autoComplete="off"
                        disabled={!isAdmin || busy}
                        help="From bridge startup logs. When set, only that laptop can attach captures."
                      />
                      <FieldRow
                        label="Camera base URL"
                        helperRight="(optional)"
                        value={form.cameraBaseUrl}
                        onChange={(v) => updateField("cameraBaseUrl", v)}
                        placeholder="http://192.168.1.50"
                        disabled={!isAdmin || busy}
                        help="ESP32 stream root URL — no trailing slash. Used by bridge and speaker check."
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {formStep !== "details" ? (
                        <button
                          type="button"
                          disabled={!isAdmin || busy}
                          onClick={() =>
                            setFormStep(
                              formStep === "device" ? "location" : "details"
                            )
                          }
                          className={btnSecondary}
                        >
                          Back
                        </button>
                      ) : null}
                      {formStep !== "device" ? (
                        <button
                          type="button"
                          disabled={!isAdmin || busy}
                          onClick={() =>
                            setFormStep(
                              formStep === "details" ? "location" : "device"
                            )
                          }
                          className={btnSecondary}
                        >
                          Next: {formStep === "details" ? "Location" : "Device link"}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={!isAdmin || busy}
                        className={btnPrimary}
                      >
                        <Save className="h-4 w-4" />
                        {busy
                          ? "Saving…"
                          : editingId
                            ? "Update bin"
                            : "Save bin"}
                      </button>
                      {editingId ? (
                        <button type="button" onClick={resetForm} className={btnSecondary}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </form>
              </Card.Body>
              <Card.Footer>
                Tip: use <strong className="text-slate-300">Location → Search address</strong> to pick from multiple results, then fine-tune on the map.
              </Card.Footer>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ============================ subcomponents ============================ */

function PageHeader({ isAdmin, loading, onRefresh, onAdd }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Bin Status
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-slate-400">
          Registry of every smart bin connected to the system. Each row shows
          its latest fill level, hygienic risk band, and ESP32 / bridge
          binding. Use the form to register a new bin, edit an existing one,
          or quick-cycle its operational status.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {isAdmin ? (
          <button type="button" onClick={onAdd} className={btnPrimary}>
            <PlusCircle className="h-3.5 w-3.5" />
            Add bin
          </button>
        ) : null}
        <Link to="/map" className={btnSecondary}>
          Open map
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <SummaryChip
        icon={Database}
        label="Total"
        value={summary.total}
        tone="default"
      />
      <SummaryChip
        icon={CircleCheck}
        label="Active"
        value={summary.active}
        tone="brand"
      />
      <SummaryChip
        icon={SettingsIcon}
        label="Maintenance"
        value={summary.maintenance}
        tone="amber"
      />
      <SummaryChip
        icon={CircleAlert}
        label="Inactive"
        value={summary.inactive}
        tone="slate"
      />
      <SummaryChip
        icon={ShieldAlert}
        label="Overflow"
        value={summary.overflow}
        tone="risk"
      />
      <SummaryChip
        icon={Activity}
        label="High risk"
        value={summary.highRisk}
        tone="risk"
      />
      <SummaryChip
        icon={AlertTriangle}
        label="Urgent pickup"
        value={summary.urgent}
        tone="amber"
      />
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, tone }) {
  const toneClass = summaryTone(
    tone === "brand"
      ? "brand"
      : tone === "amber"
        ? "amber"
        : tone === "risk"
          ? "risk"
          : "default"
  );
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${toneClass}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/60 ring-1 ring-slate-700/50">
        <Icon className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function Banner({ tone, icon: Icon, title, body, compact = false }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${compact ? "px-3 py-2" : "px-4 py-3"} ${bannerTone(tone)}`}
    >
      <Icon className={`${compact ? "h-4 w-4" : "h-5 w-5"} mt-0.5 shrink-0`} />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className={`${compact ? "mt-0" : "mt-0.5"} break-words opacity-90`}>{body}</div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-slate-800/60 bg-slate-900/40 p-3"
        >
          <div className="h-4 w-1/3 rounded bg-slate-700/60" />
          <div className="mt-2 flex gap-2">
            <div className="h-3 w-16 rounded-full bg-slate-700/50" />
            <div className="h-3 w-16 rounded-full bg-slate-700/50" />
            <div className="h-3 w-24 rounded-full bg-slate-800/60" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 ring-1 ring-slate-700/50">
        <Database className="h-5 w-5 text-slate-500" />
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{body}</div>
    </div>
  );
}

function BinRow({
  device,
  editing,
  canEdit,
  onEdit,
  onQuickStatus,
  onTestAudio,
  onStopAudio,
  audioBusy,
  stopBusy,
  audioMsg,
}) {
  const d = device;
  const tier = effectiveFillTier(d);
  const tierKey = normalizeFill(tier) || "unknown";
  const pct =
    d.latest_fill_percentage != null &&
    Number.isFinite(Number(d.latest_fill_percentage))
      ? `${Math.round(Number(d.latest_fill_percentage))}%`
      : "—";
  const urgency = collectionUrgency(d);
  const urgent = needsCollectionSoon(d);
  const hasEsp32 = Boolean(d.esp32_id && String(d.esp32_id).trim());
  const camOnline = isCameraOnline(d);

  return (
    <li>
      <div
        className={`rounded-xl border bg-slate-900/40 p-3 transition ${
          editing
            ? "border-brand-500/40 ring-1 ring-brand-500/20"
            : "border-slate-800/60 hover:border-slate-700/60"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">
                {d.name}
              </span>
              <span className="text-[11px] text-slate-500">#{d.id}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeClass(d.status)}`}
              >
                {d.status || "—"}
              </span>
              {hasEsp32 ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    camOnline
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      : "border-slate-600/50 bg-slate-800/50 text-slate-400"
                  }`}
                >
                  Camera {camOnline ? "Online" : "Offline"}
                </span>
              ) : null}
              {urgent ? (
                <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  Urgent pickup
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {d.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-brand-400" />
                  {d.location}
                </span>
              ) : null}
              {d.address ? <span className="truncate">{d.address}</span> : null}
              {d.esp32_id ? (
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  ESP32:{" "}
                  <code className="rounded bg-slate-800/80 px-1 text-brand-300">
                    {d.esp32_id}
                  </code>
                </span>
              ) : null}
              {d.bridge_instance_id ? (
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  <code className="rounded bg-slate-800/80 px-1 text-slate-400">
                    {d.bridge_instance_id}
                  </code>
                </span>
              ) : null}
              {hasEsp32 ? (
                <span className="text-slate-500">
                  Last seen: {formatLastSeen(d.last_seen_at)}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${fillBadgeClass(tierKey)}`}
              >
                {fillLabel(tier === "unknown" ? "" : tier)}
              </span>
              <span className="text-[11px] tabular-nums text-slate-400">
                Fill <span className="font-semibold text-slate-200">{pct}</span>
              </span>
              {d.latest_risk_level ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskBadgeClass(d.latest_risk_level)}`}
                >
                  Risk {d.latest_risk_level}
                </span>
              ) : (
                <span className="rounded-full border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-500">
                  Risk —
                </span>
              )}
              <span className="text-[11px] text-slate-500">
                Updated {relativeFromNow(d.latest_captured_at)}
              </span>
              <span className="text-[11px] text-slate-500">
                Urgency <span className="font-semibold text-slate-300">{urgency}</span>
              </span>
              {Number.isFinite(Number(d.latitude)) &&
              Number.isFinite(Number(d.longitude)) ? (
                <span className="font-mono text-[11px] text-slate-500">
                  {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}
                </span>
              ) : (
                <span className="text-[11px] text-amber-400">No coordinates</span>
              )}
            </div>
            {audioMsg ? (
              <p className="mt-2 text-xs text-slate-400">{audioMsg}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/bins/${d.id}`} className={btnSecondary}>
              Details
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            {canEdit && hasEsp32 ? (
              <>
                <button
                  type="button"
                  disabled={audioBusy || stopBusy}
                  onClick={onTestAudio}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {audioBusy ? "Testing…" : "Test Audio"}
                </button>
                <button
                  type="button"
                  disabled={stopBusy}
                  onClick={onStopAudio}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stopBusy ? "Stopping…" : "Stop"}
                </button>
              </>
            ) : null}
            {canEdit ? (
              <>
                <button type="button" onClick={onEdit} className={btnPrimary}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <QuickStatusMenu
                  current={d.status}
                  onChange={onQuickStatus}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function QuickStatusMenu({ current, onChange }) {
  return (
    <select
      aria-label="Quick status"
      value={current || "active"}
      onChange={(e) => {
        const v = e.target.value;
        if (v && v !== current) onChange(v);
      }}
      className={`${selectClass.replace("mt-1 ", "")} w-auto py-1.5 text-xs`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  helperRight,
  help,
  autoComplete,
  disabled = false,
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span className={labelClass}>
          {label}
          {required ? <span className="ml-0.5 text-red-400">*</span> : null}
        </span>
        {helperRight ? (
          <span className="text-[10px] text-slate-500">{helperRight}</span>
        ) : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={inputClass}
      />
      {help ? (
        <span className="mt-1 block text-[11px] text-slate-500">{help}</span>
      ) : null}
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
