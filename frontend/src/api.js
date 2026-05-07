import axios from 'axios'

export async function predictWaste(file) {
  const form = new FormData()
  form.append('file', file)

  const { data } = await axios.post('/api/predict', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}

