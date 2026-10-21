"use client";
import { DashboardCard } from './DashboardCard'
import { StatCard } from './StatCard'

export function AnalyticsPanel({ history }) {
  const total = history.length
  const organic = history.filter((item) => item.label === 'organic').length
  const nonOrganic = history.filter((item) => item.label === 'non_organic').length
  const averageConfidence =
    total === 0
      ? 0
      : history.reduce((sum, item) => sum + item.confidence, 0) / total

  const organicWidth = total ? (organic / total) * 100 : 0
  const nonOrganicWidth = total ? (nonOrganic / total) * 100 : 0

  return (
    <DashboardCard eyebrow="Live analytics" title="Session Monitoring">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Scans" value={total} detail="Current session" tone="cyan" />
        <StatCard label="Risk detections" value={organic} detail="Organic samples" tone="amber" />
        <StatCard label="Safe detections" value={nonOrganic} detail="Non-organic samples" tone="emerald" />
        <StatCard
          label="Avg confidence"
          value={`${averageConfidence.toFixed(1)}%`}
          detail="Model certainty"
          tone="violet"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-sm font-semibold text-white">Detection Distribution</p>
          <div className="mt-5 space-y-4">
            <DistributionBar
              label="Organic risk"
              value={organic}
              width={organicWidth}
              color="bg-gradient-to-r from-orange-400 to-red-400"
            />
            <DistributionBar
              label="Non-organic safe"
              value={nonOrganic}
              width={nonOrganicWidth}
              color="bg-gradient-to-r from-emerald-400 to-cyan-400"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-sm font-semibold text-white">Recent Scans</p>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                No scans yet. Upload an image and run prediction to build session history.
              </p>
            ) : (
              history.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.fileName}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                    {item.confidence.toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}

function DistributionBar({ label, value, width, color }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
