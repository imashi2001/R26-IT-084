import { useEffect, useMemo, useState } from 'react'
import { fetchMetrics, predictAnimal, predictWaste } from './api'

function App() {
  const [metrics, setMetrics] = useState(null)
  const [metricsErr, setMetricsErr] = useState('')

  const [wasteFile, setWasteFile] = useState(null)
  const [wastePreview, setWastePreview] = useState('')
  const [wasteBusy, setWasteBusy] = useState(false)
  const [wasteResult, setWasteResult] = useState(null)
  const [wasteErr, setWasteErr] = useState('')

  const [animalFile, setAnimalFile] = useState(null)
  const [animalPreview, setAnimalPreview] = useState('')
  const [animalBusy, setAnimalBusy] = useState(false)
  const [animalResult, setAnimalResult] = useState(null)
  const [animalErr, setAnimalErr] = useState('')

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .catch((e) => setMetricsErr(e?.message || 'Failed to load metrics'))
  }, [])

  const wasteConfidencePct = useMemo(() => {
    if (!wasteResult) return null
    const p = wasteResult.organic_probability
    const conf = wasteResult.predicted_label === 'organic' ? p : 1 - p
    return (conf * 100).toFixed(1)
  }, [wasteResult])

  function pickWaste(f) {
    if (!f) return
    setWasteFile(f)
    setWasteResult(null)
    setWasteErr('')
    setWastePreview((u) => {
      if (u) URL.revokeObjectURL(u)
      return URL.createObjectURL(f)
    })
  }

  function pickAnimal(f) {
    if (!f) return
    setAnimalFile(f)
    setAnimalResult(null)
    setAnimalErr('')
    setAnimalPreview((u) => {
      if (u) URL.revokeObjectURL(u)
      return URL.createObjectURL(f)
    })
  }

  async function runWaste() {
    if (!wasteFile) return
    setWasteBusy(true)
    setWasteErr('')
    setWasteResult(null)
    try {
      setWasteResult(await predictWaste(wasteFile))
    } catch (e) {
      setWasteErr(e?.response?.data?.detail || e?.message || 'Waste predict failed')
    } finally {
      setWasteBusy(false)
    }
  }

  async function runAnimal() {
    if (!animalFile) return
    setAnimalBusy(true)
    setAnimalErr('')
    setAnimalResult(null)
    try {
      setAnimalResult(await predictAnimal(animalFile))
    } catch (e) {
      setAnimalErr(e?.response?.data?.detail || e?.message || 'Animal predict failed')
    } finally {
      setAnimalBusy(false)
    }
  }

  const cardStyle = {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: 16,
    background: '#fff',
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <h1 style={{ marginTop: 0 }}>R26-IT-084 — Models check</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        Training metrics + quick inference for waste classification (MobileNetV2) and animal detection (YOLOv8).
      </p>

      <section style={{ ...cardStyle, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Reported accuracy (from training)</h2>
        {metricsErr ? (
          <p style={{ color: '#b91c1c' }}>{metricsErr}</p>
        ) : !metrics ? (
          <p style={{ color: '#64748b' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <strong>Waste (test accuracy)</strong>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {metrics.waste?.test_accuracy_percent ?? '—'}%
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{metrics.waste?.note}</div>
            </div>
            <div>
              <strong>Animal (val mAP@50)</strong>
              {metrics.animal ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {(metrics.animal.map50 * 100).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    P {(metrics.animal.precision * 100).toFixed(1)}% · R{' '}
                    {(metrics.animal.recall * 100).toFixed(1)}% · mAP@50–95{' '}
                    {(metrics.animal.map50_95 * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Epoch {metrics.animal.epoch} · {metrics.animal.source}
                  </div>
                </>
              ) : (
                <p style={{ color: '#b45309' }}>
                  No results.csv found — train animal_detection or check path.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>1. Waste classification</h3>
          <input type="file" accept="image/*" onChange={(e) => pickWaste(e.target.files?.[0])} />
          {wastePreview ? (
            <img alt="" src={wastePreview} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', marginTop: 10 }} />
          ) : null}
          <button
            type="button"
            disabled={!wasteFile || wasteBusy}
            onClick={runWaste}
            style={{ marginTop: 10, padding: '8px 14px', width: '100%', cursor: wasteFile && !wasteBusy ? 'pointer' : 'not-allowed' }}
          >
            {wasteBusy ? 'Running…' : 'Run waste model'}
          </button>
          {wasteErr ? <p style={{ color: '#b91c1c', fontSize: 14 }}>{wasteErr}</p> : null}
          {wasteResult ? (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              <div>
                <strong>Label:</strong> {wasteResult.predicted_label}
              </div>
              <div>
                <strong>Organic probability:</strong> {Number(wasteResult.organic_probability).toFixed(4)}
              </div>
              <div>
                <strong>Confidence:</strong> {wasteConfidencePct}%
              </div>
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>2. Animal detection</h3>
          <input type="file" accept="image/*" onChange={(e) => pickAnimal(e.target.files?.[0])} />
          {animalPreview ? (
            <img alt="" src={animalPreview} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', marginTop: 10 }} />
          ) : null}
          <button
            type="button"
            disabled={!animalFile || animalBusy}
            onClick={runAnimal}
            style={{ marginTop: 10, padding: '8px 14px', width: '100%', cursor: animalFile && !animalBusy ? 'pointer' : 'not-allowed' }}
          >
            {animalBusy ? 'Running…' : 'Run animal model'}
          </button>
          {animalErr ? <p style={{ color: '#b91c1c', fontSize: 14 }}>{animalErr}</p> : null}
          {animalResult ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                <strong>Detections:</strong> {animalResult.detection_count}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, maxHeight: 120, overflow: 'auto' }}>
                {animalResult.detections?.map((d, i) => (
                  <li key={`${d.class_name}-${i}`}>
                    {d.class_name} · {(d.confidence * 100).toFixed(1)}%
                  </li>
                ))}
              </ul>
              {animalResult.annotated_image_base64 ? (
                <img
                  alt="YOLO output"
                  src={`data:image/jpeg;base64,${animalResult.annotated_image_base64}`}
                  style={{ width: '100%', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 24 }}>
        API proxied from Vite as <code>/api/*</code>. Start backend:{' '}
        <code>uvicorn api:app --host 127.0.0.1 --port 8000</code> from <code>backend/</code>.
      </p>
    </div>
  )
}

export default App
