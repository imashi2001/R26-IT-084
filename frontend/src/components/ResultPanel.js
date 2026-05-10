import { DashboardCard } from './DashboardCard'
import { ProgressMeter } from './ProgressMeter'

export function ResultPanel({ result, confidence, error, busy }) {
  const predictedLabel = result?.predicted_label || ''
  const isOrganic = predictedLabel === 'organic'
  const organicProbability = Number(result?.organic_probability || 0) * 100
  const confidenceValue = Number(confidence || 0)
  const status = isOrganic
    ? {
        title: 'Hygienic Risk Detected',
        icon: '!',
        badge: 'Organic Waste',
        colors: 'border-orange-300/30 bg-orange-400/10 text-orange-200',
        meter: 'bg-gradient-to-r from-orange-400 to-red-400',
      }
    : {
        title: 'Low Hygienic Risk',
        icon: 'OK',
        badge: 'Non-Organic Waste',
        colors: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
        meter: 'bg-gradient-to-r from-emerald-400 to-cyan-400',
      }

  return (
    <DashboardCard eyebrow="AI inference" title="Prediction Results" className="min-h-full">
      {error && (
        <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {!result ? (
        <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-center">
          <div className="relative mb-6">
            <div className="h-24 w-24 rounded-full border border-cyan-300/20 bg-cyan-300/10" />
            {busy && <div className="absolute inset-0 animate-ping rounded-full border border-cyan-300/50" />}
          </div>
          <h3 className="text-xl font-bold text-white">
            {busy ? 'Model is analyzing image data' : 'Awaiting waste sample'}
          </h3>
          <p className="mt-3 max-w-sm text-sm text-slate-400">
            Results will appear here with class, confidence, organic probability, and hygienic
            risk status.
          </p>
        </div>
      ) : (
        <div className="animate-[fadeIn_0.5s_ease-out] space-y-5">
          <div className={`rounded-3xl border p-5 ${status.colors}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] opacity-75">Risk level</p>
                <h3 className="mt-2 text-2xl font-black text-white">{status.title}</h3>
                <p className="mt-2 text-sm opacity-85">{status.badge}</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white">
                {status.icon}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Predicted class</p>
              <p className="mt-2 text-2xl font-black text-white">{predictedLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Threshold</p>
              <p className="mt-2 text-2xl font-black text-white">{result.threshold}</p>
            </div>
          </div>

          <ProgressMeter label="Confidence meter" value={confidenceValue} color={status.meter} />
          <ProgressMeter
            label="Organic probability"
            value={organicProbability}
            color="bg-gradient-to-r from-amber-400 to-orange-500"
          />

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
            Classes: <span className="text-slate-200">{result.class_names?.join(' / ')}</span>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
