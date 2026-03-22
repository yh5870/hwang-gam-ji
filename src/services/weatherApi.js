/**
 * 기상청 API 연동
 * ① ASOS 시간자료: 시정(가시거리)
 * ② 단기예보: SKY, PTY, REH(습도)
 */

const API_BASE =
  import.meta.env.DEV ? '/api/kma/1360000' : 'http://apis.data.go.kr/1360000'
const ASOS_BASE = `${API_BASE}/AsosHourlyInfoService`
const VILAGE_BASE = `${API_BASE}/VilageFcstInfoService_2.0`

const BUSAN_STN = 159
const HWANGNYEONG_NX = 98
const HWANGNYEONG_NY = 75

/**
 * 현재 시각 기준 가장 최근 단기예보 base_time 계산
 * 발표시각: 02, 05, 08, 11, 14, 17, 20, 23 (KST)
 * 데이터는 발표 후 30~40분 정도에 제공됨
 */
function getLatestBaseTime() {
  const now = new Date()
  const hours = [23, 20, 17, 14, 11, 8, 5, 2]
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()

  let baseHour = 2
  for (const h of hours) {
    if (currentHour > h || (currentHour === h && currentMin >= 30)) {
      baseHour = h
      break
    }
  }

  const baseDate = new Date(now)
  if (baseHour > currentHour || (baseHour === currentHour && currentMin < 30)) {
    baseDate.setDate(baseDate.getDate() - 1)
  }

  const yyyy = baseDate.getFullYear()
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0')
  const dd = String(baseDate.getDate()).padStart(2, '0')
  const hh = String(baseHour).padStart(2, '0')

  return { base_date: `${yyyy}${mm}${dd}`, base_time: `${hh}00` }
}

/**
 * ASOS 시간자료 - 부산(159) 시정(가시거리) 조회
 * vs 단위: m (미터). 50000 = 50km
 */
export async function fetchAsosVisibility(apiKey) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const date = `${y}${m}${d}`
  const hour = String(now.getHours()).padStart(2, '0')

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 1,
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'HR',
    startDt: date,
    startHh: hour,
    endDt: date,
    endHh: hour,
    stnIds: String(BUSAN_STN),
  })

  const url = `${ASOS_BASE}/getWthrDataList?${params}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.response?.header?.resultCode !== '00') {
    throw new Error(data.response?.header?.resultMsg || 'ASOS API 오류')
  }

  const items = data.response?.body?.items?.item
  if (!items || (Array.isArray(items) ? items.length === 0 : !items.vs)) {
    const prevHour = now.getHours() - 1
    if (prevHour < 0) return null
    return fetchAsosVisibilityWithTime(apiKey, date, String(prevHour).padStart(2, '0'))
  }

  const item = Array.isArray(items) ? items[0] : items
  const vs = Number(item.vs)

  if (Number.isNaN(vs) || vs < 0) return null

  return vs / 1000
}

async function fetchAsosVisibilityWithTime(apiKey, date, hour) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 1,
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'HR',
    startDt: date,
    startHh: hour,
    endDt: date,
    endHh: hour,
    stnIds: String(BUSAN_STN),
  })

  const url = `${ASOS_BASE}/getWthrDataList?${params}`
  const res = await fetch(url)
  const data = await res.json()

  const items = data.response?.body?.items?.item
  if (!items || (Array.isArray(items) ? items.length === 0 : !items.vs)) return null

  const item = Array.isArray(items) ? items[0] : items
  const vs = Number(item.vs)
  return Number.isNaN(vs) ? null : vs / 1000
}

/**
 * 단기예보 - 황령산 격자(98, 75) SKY, PTY, REH 조회
 */
export async function fetchVilageFcst(apiKey) {
  const { base_date, base_time } = getLatestBaseTime()

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 100,
    dataType: 'JSON',
    base_date,
    base_time,
    nx: String(HWANGNYEONG_NX),
    ny: String(HWANGNYEONG_NY),
  })

  const url = `${VILAGE_BASE}/getVilageFcst?${params}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.response?.header?.resultCode !== '00') {
    throw new Error(data.response?.header?.resultMsg || '단기예보 API 오류')
  }

  const items = data.response?.body?.items?.item
  if (!items || !items.length) return null

  const fcstDate = items[0].fcstDate
  const fcstTime = items[0].fcstTime
  const byKey = {}
  for (const it of items) {
    if (it.fcstDate === fcstDate && it.fcstTime === fcstTime) {
      byKey[it.category] = it.fcstValue
    }
  }

  return {
    sky: byKey.SKY,
    pty: byKey.PTY,
    reh: byKey.REH ? Number(byKey.REH) : null,
  }
}

/**
 * SKY 코드 → 하늘 상태 텍스트
 */
function skyToText(sky) {
  const m = { 1: '맑음', 3: '구름많음', 4: '흐림' }
  return m[Number(sky)] ?? '정보없음'
}

/**
 * 황감지용 통합 날씨 데이터 조회
 */
export async function fetchHwangGamWeather(apiKey) {
  const [visibilityKm, vilage] = await Promise.all([
    fetchAsosVisibility(apiKey),
    fetchVilageFcst(apiKey),
  ])

  return {
    visibility_km: visibilityKm ?? 10,
    humidity: vilage?.reh ?? 50,
    dust: 'Moderate',
    dust_value: null,
    sky: vilage ? skyToText(vilage.sky) : '정보없음',
    pty: vilage?.pty ?? '0',
    wind_speed: null,
    temperature: null,
  }
}

/**
 * 24시간 예보 (단기예보 REH, SKY 기반 예상 점수)
 */
export async function fetchForecast(apiKey) {
  const { base_date, base_time } = getLatestBaseTime()

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 500,
    dataType: 'JSON',
    base_date,
    base_time,
    nx: String(HWANGNYEONG_NX),
    ny: String(HWANGNYEONG_NY),
  })

  const url = `${VILAGE_BASE}/getVilageFcst?${params}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.response?.header?.resultCode !== '00') {
    throw new Error(data.response?.header?.resultMsg || '단기예보 API 오류')
  }

  const items = data.response?.body?.items?.item
  if (!items || !items.length) return []

  const byTime = {}
  for (const it of items) {
    const key = `${it.fcstDate}-${it.fcstTime}`
    if (!byTime[key]) byTime[key] = {}
    byTime[key][it.category] = it.fcstValue
  }

  const sorted = Object.entries(byTime)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 24)

  return sorted.map(([key, vals], i) => {
    const [, ft] = key.split('-')
    const reh = Number(vals.REH) || 50
    const sky = Number(vals.SKY) || 1
    const hour = ft.slice(0, 2)
    const score = estimateScoreFromForecast(reh, sky)
    return {
      hour: `${hour}:00`,
      score,
      visibility_km: null,
      label: i === 0 ? '지금' : '',
    }
  })
}

function estimateScoreFromForecast(reh, sky) {
  if (sky === 4) return Math.max(10, 50 - reh * 0.5)
  if (sky === 3) return Math.max(20, 70 - reh * 0.6)
  if (reh >= 80) return Math.max(30, 80 - reh)
  if (reh >= 60) return Math.max(50, 100 - reh)
  return Math.min(100, 50 + (100 - reh) * 0.5)
}
