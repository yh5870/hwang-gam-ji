const STORAGE_KEY = 'hwgj_local_map_pins_v1'

function safeParse(raw) {
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || !Array.isArray(data.pins)) return null
    return data
  } catch {
    return null
  }
}

export function getLocalPins() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = safeParse(raw)
    return data?.pins ?? []
  } catch {
    return []
  }
}

export function setLocalPins(pins) {
  if (typeof window === 'undefined') return
  const payload = { version: 1, pins }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent('hwgj-local-pins-changed', { detail: pins }))
}

export function addLocalPin({ lat, lng, title }) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `local-${crypto.randomUUID()}`
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const next = [
    ...getLocalPins(),
    {
      id,
      lat: Number(lat),
      lng: Number(lng),
      title: String(title || '내 촬영 스팟').slice(0, 80),
      createdAt: new Date().toISOString(),
    },
  ]
  setLocalPins(next)
  return id
}

export function removeLocalPin(id) {
  const next = getLocalPins().filter((p) => p.id !== id)
  setLocalPins(next)
}

export function updateLocalPinPosition(id, lat, lng) {
  const pins = getLocalPins()
  const idx = pins.findIndex((p) => p.id === id)
  if (idx < 0) return
  const next = [...pins]
  next[idx] = {
    ...next[idx],
    lat: Number(lat),
    lng: Number(lng),
  }
  setLocalPins(next)
}
