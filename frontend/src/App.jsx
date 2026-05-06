import { useMemo, useState } from 'react'
import './App.css'
import { predictWaste } from './api'

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const confidencePct = useMemo(() => {
    if (!result) return null
    const p = result.organic_probability
    const conf = result.predicted_label === 'organic' ? p : 1 - p
    return (conf * 100).toFixed(2)
  }, [result])

  async function onPredict() {
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const json = await predictWaste(file)
      setResult(json)
    } catch (e) {
      setError(e?.message || 'Prediction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ marginBottom: 6 }}>Waste Classification (Organic vs Non-organic)</h1>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Upload an image to get an <b>organic probability</b> and predicted label.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setFile(f)
                setResult(null)
                setError('')
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(f ? URL.createObjectURL(f) : '')
              }}
            />

            {previewUrl ? (
              <div style={{ marginTop: 12 }}>
                <img
                  src={previewUrl}
                  alt="preview"
                  style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 8 }}
                />
              </div>
            ) : (
              <div style={{ marginTop: 12, opacity: 0.7 }}>Choose an image to preview.</div>
            )}

            <button
              type="button"
              onClick={onPredict}
              disabled={!file || busy}
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.14)',
                background: busy ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)',
                cursor: !file || busy ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
            >
              {busy ? 'Predicting…' : 'Predict'}
            </button>
          </div>

          <div style={{ padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Result</label>

            {error ? (
              <div style={{ color: '#ffb4b4', whiteSpace: 'pre-wrap' }}>{error}</div>
            ) : null}

            {!result ? (
              <div style={{ opacity: 0.7 }}>
                {busy ? 'Running model…' : 'Upload an image and click Predict.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ opacity: 0.75 }}>Predicted label</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{result.predicted_label}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.75 }}>Organic probability</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {Number(result.organic_probability).toFixed(4)}
                  </div>
                </div>

                <div>
                  <div style={{ opacity: 0.75 }}>Confidence</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{confidencePct}%</div>
                </div>

                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  Threshold: {result.threshold} • class_names: [{result.class_names?.join(', ')}]
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
          Backend URL: <code>/api</code> (proxied to FastAPI on <code>127.0.0.1:8000</code>)
        </div>
      </section>
    </>
  )
}

export default App
