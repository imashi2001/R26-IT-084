"use client";
import { DashboardCard } from './DashboardCard'

const infoItems = [
  { label: 'Model', value: 'MobileNetV2', detail: 'Transfer learning CNN' },
  { label: 'Dataset', value: 'Train / Val / Test', detail: 'Image classification splits' },
  { label: 'Classes', value: '2', detail: 'organic and non_organic' },
  { label: 'Accuracy', value: 'Test evaluated', detail: 'From training pipeline' },
]

export function SystemInfoPanel() {
  return (
    <DashboardCard eyebrow="Research system" title="Model Information">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {infoItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:-translate-y-1 hover:border-emerald-300/30"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-lg font-black text-white">{item.value}</p>
            <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm text-cyan-100">
        Backend URL: <code className="rounded-lg bg-slate-950/60 px-2 py-1 text-cyan-200">/api</code>
        <span className="text-cyan-200/80"> proxied to FastAPI on 127.0.0.1:8001</span>
      </div>
    </DashboardCard>
  )
}
