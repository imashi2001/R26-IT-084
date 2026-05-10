import { useRef, useState } from 'react'
import { DashboardCard } from './DashboardCard'

export function UploadPanel({ file, previewUrl, busy, onSelectFile, onPredict }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function selectFirstFile(fileList) {
    const nextFile = fileList?.[0]
    if (nextFile) onSelectFile(nextFile)
  }

  return (
    <DashboardCard
      eyebrow="Image intake"
      title="Upload Waste Sample"
      className="relative overflow-hidden"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
      <div
        className={`relative flex min-h-80 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition duration-300 ${
          isDragging
            ? 'border-emerald-300 bg-emerald-300/10'
            : 'border-white/15 bg-slate-950/40 hover:border-emerald-300/50 hover:bg-slate-900/70'
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          selectFirstFile(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*"
          onChange={(event) => selectFirstFile(event.target.files)}
        />

        {previewUrl ? (
          <div className="w-full">
            <div className="relative mx-auto max-h-80 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src={previewUrl}
                alt="Selected waste sample preview"
                className="mx-auto max-h-80 w-full object-contain"
              />
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                  <div className="h-24 w-24 animate-ping rounded-full border border-emerald-300/50" />
                  <div className="absolute h-16 w-16 rounded-full border-2 border-emerald-300/70" />
                  <span className="absolute text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">
                    Scanning
                  </span>
                </div>
              )}
            </div>
            <p className="mt-4 truncate text-sm text-slate-300">{file?.name}</p>
          </div>
        ) : (
          <div>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/10 text-4xl ring-1 ring-emerald-300/25">
              AI
            </div>
            <p className="mt-5 text-lg font-semibold text-white">Drag and drop an image here</p>
            <p className="mt-2 text-sm text-slate-400">
              Upload a waste sample for organic vs non-organic classification.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          Choose Image
        </button>
        <button
          type="button"
          disabled={!file || busy}
          onClick={onPredict}
          className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/20 transition hover:scale-[1.02] hover:shadow-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {busy ? 'Analyzing Sample...' : 'Run AI Prediction'}
        </button>
      </div>
    </DashboardCard>
  )
}
