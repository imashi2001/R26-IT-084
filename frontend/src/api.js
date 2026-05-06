export async function predictWaste(file) {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch('/api/predict', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }

  return await res.json()
}

