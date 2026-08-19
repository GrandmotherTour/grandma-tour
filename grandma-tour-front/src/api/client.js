const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`)

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.message || '요청을 처리하지 못했습니다.'
    throw new Error(message)
  }

  return data
}
