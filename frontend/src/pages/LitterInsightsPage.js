import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  BarChart3,
  Brush,
  Camera,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  Map as MapIcon,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundX,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import { SummaryChip } from "../components/litter/LitterModelWorkspace";
import LitterHotspotMap from "../components/litter/insights/LitterHotspotMap";
import LitterTrendChart from "../components/litter/insights/LitterTrendChart";
import LitterHeatmap from "../components/litter/insights/LitterHeatmap";
import LitterBinsTable from "../components/litter/insights/LitterBinsTable";
import LitterCleanupList from "../components/litter/insights/LitterCleanupList";
import LitterEvidenceGallery from "../components/litter/insights/LitterEvidenceGallery";
import BinOutlineEditor from "../components/litter/insights/BinOutlineEditor";
import {
  btnGhost,
  bannerTone,
  chipClass,
  chipActiveClass,
  selectClass,
  labelClass,
} from "../components/dashboard/dashboardUi";
import { filterBar } from "../components/dashboard/dashboardTheme";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../utils/apiBase";
import { formatBinCode } from "../utils/dashboardBins";
import { formatLsi } from "../utils/litterSeverity";
import { describePeak, pct } from "../utils/litterInsights";
import {
  fetchLitterSummary,
  fetchFeedbackExport,
  apiErrorMessage,
} from "../utils/litterInsightsApi";

const RANGES = [7, 30, 90];

function Banner({ tone, icon: Icon, title, body }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone(tone)}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 leading-relaxed opacity-90">{body}</div>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-800/40 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-200">{value}</span>
    </div>
  );
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LitterInsightsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [days, setDays] = useState(30);
  const [deviceId, setDeviceId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outlineDevice, setOutlineDevice] = useState(null);
  const [exportError, setExportError] = useState("");
  const editorRef = useRef(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await fetchLitterSummary({ days, deviceId }));
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load litter insights"));
    } finally {
      setLoading(false);
    }
  }, [days, deviceId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(apiUrl("/devices"))
      .then(({ data }) => {
        if (cancelled) return;
        const list = data?.devices || [];
        setDevices(list);
        setOutlineDevice((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const editOutline = useCallback((id) => {
    setOutlineDevice(id);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const exportSamples = async () => {
    setExportError("");
    try {
      const rows = await fetchFeedbackExport(90);
      downloadJson(`litter-labelled-samples-${new Date().toISOString().slice(0, 10)}.json`, rows);
    } catch (e) {
      setExportError(apiErrorMessage(e, "Export failed"));
    }
  };

  const t = summary?.totals;
  const fb = summary?.feedback;
  const cfg = summary?.config;
  const peak = describePeak(summary?.peak);
  const persistentBins = (summary?.bins || []).filter((b) => b.status === "persistent");
  const risingBins = (summary?.bins || []).filter((b) => b.trend === "rising");

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Litter Insights"
          subtitle={
            <>
              Where and when litter builds up around bins, which littering events were
              confirmed across several frames, whether cleanups worked, and how accurate the
              litter models are according to staff reviews.
            </>
          }
          actions={
            <>
              <Link to="/litter-severity" className={btnGhost}>
                Litter severity
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/littering-event" className={btnGhost}>
                Littering events
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          }
        />

        <div className={filterBar}>
          <div>
            <span className={labelClass}>Range</span>
            <div className="mt-1 flex gap-1.5">
              {RANGES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={days === d ? chipActiveClass : chipClass}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <label className="min-w-[14rem]">
            <span className={labelClass}>Bin</span>
            <select
              className={selectClass}
              value={deviceId || ""}
              onChange={(e) => setDeviceId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All bins</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatBinCode(d.id)} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={loadSummary} className={btnGhost} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <Banner tone="error" icon={AlertTriangle} title="Could not load insights" body={error} />
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryChip
            icon={Gauge}
            label="Average LSI"
            value={formatLsi(t?.avg_lsi)}
            sub={t ? `${t.captures_analyzed} readings` : "—"}
          />
          <SummaryChip
            icon={Sparkles}
            label="HIGH share"
            value={pct(t?.high_share)}
            sub={t ? `${t.high} HIGH readings` : "—"}
            tone={(t?.high_share || 0) >= 25 ? "red" : "default"}
          />
          <SummaryChip
            icon={UserRoundX}
            label="Confirmed littering"
            value={t ? t.littering_confirmed : "—"}
            sub={t ? `${t.littering_unconfirmed} unconfirmed filtered` : "—"}
            tone={(t?.littering_confirmed || 0) > 0 ? "amber" : "default"}
          />
          <SummaryChip
            icon={AlertTriangle}
            label="Bins need action"
            value={t ? t.bins_persistent : "—"}
            sub="3 elevated in a row"
            tone={(t?.bins_persistent || 0) > 0 ? "red" : "brand"}
          />
          <SummaryChip
            icon={TrendingUp}
            label="Rising bins"
            value={t ? t.bins_rising : "—"}
            sub="LSI climbing"
            tone={(t?.bins_rising || 0) > 0 ? "amber" : "default"}
          />
          <SummaryChip
            icon={ShieldCheck}
            label="Verified cleanups"
            value={t ? t.cleanups : "—"}
            sub="MEDIUM/HIGH → LOW"
            tone="brand"
          />
        </div>

        {persistentBins.length ? (
          <Banner
            tone="error"
            icon={AlertTriangle}
            title={`${persistentBins.length} bin${persistentBins.length === 1 ? "" : "s"} still need cleaning`}
            body={`${persistentBins
              .slice(0, 4)
              .map((b) => b.bin_code)
              .join(", ")}${persistentBins.length > 4 ? "…" : ""} had MEDIUM or HIGH litter on the last 3 readings.`}
          />
        ) : null}
        {risingBins.length ? (
          <Banner
            tone="warn"
            icon={TrendingUp}
            title="Litter building up"
            body={`${risingBins
              .slice(0, 4)
              .map((b) => `${b.bin_code} (+${b.trend_per_day} LSI/day)`)
              .join(", ")} — clean before they reach HIGH.`}
          />
        ) : null}
        {peak ? (
          <Banner
            tone="info"
            icon={Clock}
            title={`Peak litter time: ${peak}`}
            body={`${summary.peak.events} confirmed littering episode(s) and ${summary.peak.high} HIGH reading(s) in this hour slot. Schedule cleaning or patrols just before it.`}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Card>
              <Card.Header
                icon={MapIcon}
                title="Litter hotspot map"
                subtitle={`Average LSI and confirmed littering per bin · last ${days} days`}
              />
              <Card.Body>
                <LitterHotspotMap bins={summary?.bins} />
              </Card.Body>
            </Card>
          </div>
          <Card>
            <Card.Header
              icon={Brush}
              title="Cleanup verification"
              subtitle="Did the litter around each bin actually go down?"
            />
            <Card.Body>
              <LitterCleanupList cleanups={summary?.cleanups} bins={summary?.bins} />
            </Card.Body>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card>
            <Card.Header
              icon={BarChart3}
              title="Daily litter trend"
              subtitle="Avg LSI line · HIGH readings and confirmed littering bars"
            />
            <Card.Body>
              <LitterTrendChart daily={summary?.daily} />
            </Card.Body>
          </Card>
          <Card>
            <Card.Header
              icon={Clock}
              title="When litter happens"
              subtitle="Day × hour in your local time · confirmed littering weighs double"
            />
            <Card.Body>
              <LitterHeatmap heatmap={summary?.heatmap} />
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Header
            icon={Gauge}
            title="Bins by litter pressure"
            subtitle="Worst status first · trend is the LSI slope over the latest readings"
          />
          <Card.Body>
            <LitterBinsTable bins={summary?.bins} onEditOutline={editOutline} />
            {summary?.truncated ? (
              <p className="mt-2 text-[11px] text-amber-300">
                Showing the first 10,000 readings — pick a shorter range or one bin for exact
                numbers.
              </p>
            ) : null}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            icon={Camera}
            title="Evidence & review"
            subtitle="Check model results on real captures — your answers become retraining labels"
          />
          <Card.Body>
            <LitterEvidenceGallery
              days={Math.min(days, 30)}
              deviceId={deviceId}
              summary={summary}
              onReviewed={loadSummary}
            />
          </Card.Body>
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div ref={editorRef} className="scroll-mt-4 xl:col-span-2">
            <Card>
              <Card.Header
                icon={PenTool}
                title="Bin outline calibration"
                subtitle="Litter inside the outline (rubbish in the bin) is not counted in the LSI"
              />
              <Card.Body>
                <BinOutlineEditor
                  bins={devices}
                  deviceId={outlineDevice}
                  onSelectDevice={setOutlineDevice}
                  canEdit={isAdmin}
                  onSaved={loadSummary}
                />
              </Card.Body>
            </Card>
          </div>
          <Card>
            <Card.Header icon={ShieldCheck} title="Model quality" subtitle="From staff reviews in this range" />
            <Card.Body className="space-y-4 text-sm">
              <div>
                <StatRow
                  label="Litter severity accuracy"
                  value={fb?.severity?.total ? `${pct(fb.severity.accuracy)} of ${fb.severity.total}` : "No reviews"}
                />
                <StatRow
                  label="Littering detection accuracy"
                  value={fb?.action?.total ? `${pct(fb.action.accuracy)} of ${fb.action.total}` : "No reviews"}
                />
                <StatRow label="False littering alarms" value={fb?.action?.false_alarms ?? 0} />
                {Object.entries(fb?.severity?.confusion || {})
                  .filter(([k]) => {
                    const [a, b] = k.split("->");
                    return a !== b;
                  })
                  .map(([k, n]) => (
                    <StatRow key={k} label={`Predicted ${k.replace("->", " → actual ")}`} value={n} />
                  ))}
              </div>
              {cfg ? (
                <div>
                  <div className={labelClass}>Current rules</div>
                  <StatRow
                    label="Littering confirmation"
                    value={`${cfg.confirm_min_frames} frames / ${cfg.confirm_window_seconds}s`}
                  />
                  <StatRow label="Single-frame confirm at" value={pct(cfg.strong_confidence * 100)} />
                  <StatRow
                    label="Early warning"
                    value={`+${cfg.rise_delta} LSI in ${cfg.rise_window_hours}h`}
                  />
                  <StatRow label="Add-bin streak" value={`${cfg.add_bin_streak} HIGH`} />
                </div>
              ) : null}
              <button type="button" onClick={exportSamples} className={btnGhost}>
                <Download className="h-3.5 w-3.5" />
                Export labelled samples (JSON)
              </button>
              {exportError ? <p className="text-[11px] text-red-300">{exportError}</p> : null}
            </Card.Body>
          </Card>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
