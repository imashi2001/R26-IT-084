import { useMemo, useState } from 'react'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { ResultPanel } from './components/ResultPanel'
import { StatCard } from './components/StatCard'
import { SystemInfoPanel } from './components/SystemInfoPanel'
import { UploadPanel } from './components/UploadPanel'
import { predictWaste } from './api'

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  const confidencePct = useMemo(() => {
    if (!result) return null
    const p = result.organic_probability
    const conf = result.predicted_label === 'organic' ? p : 1 - p
    return conf * 100
  }, [result])

  function onSelectFile(nextFile) {
    setFile(nextFile)
    setResult(null)
    setError('')
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return URL.createObjectURL(nextFile)
    })
  }

  async function onPredict() {
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const json = await predictWaste(file)
      setResult(json)
      const probability = Number(json.organic_probability)
      const confidence = json.predicted_label === 'organic' ? probability : 1 - probability
      setHistory((currentHistory) => [
        {
          id: `${Date.now()}-${file.name}`,
          fileName: file.name,
          label: json.predicted_label,
          confidence: confidence * 100,
        },
        ...currentHistory,
      ])
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Prediction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-emerald-200">
                AI + IoT Smart Waste Monitoring
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Vision-Based Waste Classification
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Organic vs Non-Organic Waste Detection for hygienic risk prediction and
                animal-deterrence research workflows.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[32rem]">
              <StatCard label="Mode" value="Live" detail="FastAPI inference" tone="emerald" />
              <StatCard label="Classes" value="2" detail="Waste categories" tone="cyan" />
              <StatCard label="Risk engine" value="AI" detail="Hygiene analytics" tone="amber" />
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <UploadPanel
            file={file}
            previewUrl={previewUrl}
            busy={busy}
            onSelectFile={onSelectFile}
            onPredict={onPredict}
          />
          <ResultPanel result={result} confidence={confidencePct} error={error} busy={busy} />
        </section>

        <SystemInfoPanel />
        <AnalyticsPanel history={history} />
      </div>
    </main>
  )
}

export default App
