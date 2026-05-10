import axios from 'axios'

export async function fetchMetrics() {
  const { data } = await axios.get('/api/metrics')
  return data
}

export async function fetchBins() {
  const { data } = await axios.get('/api/bins')
  return data
}

export async function fetchWeather(binId) {
  const { data } = await axios.get(`/api/weather/${encodeURIComponent(binId)}`)
  return data
}

export async function fetchRisk(binId) {
  const { data } = await axios.get(`/api/risk/${encodeURIComponent(binId)}`)
  return data
}

export async function fetchAnalyzeHistory() {
  const { data } = await axios.get('/api/analyze/history')
  return data
}

export async function analyzeCapture(file, opts = {}) {
  const form = new FormData()
  form.append('file', file)
  if (opts.binId) form.append('bin_id', opts.binId)
  if (opts.lat != null) form.append('lat', String(opts.lat))
  if (opts.lon != null) form.append('lon', String(opts.lon))
  if (opts.deviceId) form.append('device_id', opts.deviceId)
  if (opts.bridgeInstanceId) form.append('bridge_instance_id', opts.bridgeInstanceId)
  if (opts.esp32Id) form.append('esp32_id', opts.esp32Id)

  const { data } = await axios.post('/api/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function predictWaste(file, binId) {
  const form = new FormData()
  form.append('file', file)
  if (binId) form.append('bin_id', binId)

  const { data } = await axios.post('/api/predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function predictAnimal(file, binId) {
  const form = new FormData()
  form.append('file', file)
  if (binId) form.append('bin_id', binId)

  const { data } = await axios.post('/api/predict/animal', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
