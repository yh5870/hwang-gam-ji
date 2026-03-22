/**
 * 공공데이터포털 API 연동
 * ① 기상청 ASOS: 시정(가시거리)
 * ② 기상청 단기예보: SKY, PTY, REH(습도) - 황령산 격자(98,75)
 * ③ 부산광역시 대기질: 미세먼지(PM10), 초미세먼지(PM2.5) - 전포동 측정소 (황령산 봉수대 전포동 쪽)
 */

const API_BASE =
  import.meta.env.DEV ? '/api/kma/1360000' : 'https://apis.data.go.kr/1360000'
const BUSAN_AIR_BASE =
  import.meta.env.DEV ? '/api/busan/6260000' : 'https://apis.data.go.kr/6260000'

const ASOS_BASE = `${API_BASE}/AsosHourlyInfoService`
const VILAGE_BASE = `${API_BASE}/VilageFcstInfoService_2.0`
const AIR_QUALITY_BASE = `${BUSAN_AIR_BASE}/AirQualityInfoService`

/** 전포동 측정소 검색 키워드 (황령산 봉수대 전포동 쪽) */
const JEONPO_STATION_KEYWORDS = ['전포', '전포동', '부산진구']

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
 * ASOS 시간자료(Hourly) - 부산(159) 시정(가시거리) 조회
 * getWthrDataList + dateCd=HR = 시간자료 (실시간)
 * ※ 데이터 15~20분 지연 → 현재 시각보다 1시간 전 요청 (확정된 데이터)
 */
export async function fetchAsosVisibility(apiKey) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const date = `${y}${m}${d}`
  const currentHour = now.getHours()
  const hourToRequest = Math.max(0, currentHour - 1)
  const hour = String(hourToRequest).padStart(2, '0')

  let result = await fetchAsosVisibilityWithTime(apiKey, date, hour)
  if (result != null) return result

  for (let offset = 2; offset <= 5; offset++) {
    const h = Math.max(0, currentHour - offset)
    if (h === hourToRequest) continue
    result = await fetchAsosVisibilityWithTime(apiKey, date, String(h).padStart(2, '0'))
    if (result != null) return result
  }

  if (currentHour < 3) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yy = yesterday.getFullYear()
    const ym = String(yesterday.getMonth() + 1).padStart(2, '0')
    const yd = String(yesterday.getDate()).padStart(2, '0')
    result = await fetchAsosVisibilityWithTime(apiKey, `${yy}${ym}${yd}`, '23')
    if (result != null) return result
  }
  return null
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

  if (data.response?.header?.resultCode !== '00' && data.response?.header?.resultCode !== '03') {
    return null
  }

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
 * PM2.5 수치 → 황감지 dust 레벨 (hwangGamAnalysis 호환)
 * - excellent/good: 15 이하
 * - moderate: 16~35
 * - bad: 36+
 */
function pm25ToDustLevel(pm25) {
  if (pm25 == null || Number.isNaN(pm25)) return null
  const v = Number(pm25)
  if (v <= 15) return 'Good'
  if (v <= 35) return 'Moderate'
  return 'Bad'
}

/**
 * PM2.5 수치 → 한글 등급 (UI 표시용)
 */
function pm25ToDustLabel(pm25) {
  if (pm25 == null || Number.isNaN(pm25)) return null
  const v = Number(pm25)
  if (v <= 15) return '좋음'
  if (v <= 35) return '보통'
  if (v <= 75) return '나쁨'
  return '매우나쁨'
}

/**
 * 부산광역시 대기질 정보 조회 - 전포동 측정소 기준
 * (황령산 봉수대가 전포동 쪽이므로 전포동 날씨·대기질 사용)
 * 공공데이터포털 부산광역시_대기질 정보 조회 API
 * ※ API는 전날 자료까지 제공 → controlnumber로 어제 23시 사용
 */
export async function fetchAirQuality(apiKey) {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yyyy = yesterday.getFullYear()
  const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
  const dd = String(yesterday.getDate()).padStart(2, '0')
  const controlnumber = `${yyyy}${mm}${dd}23`

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 100,
    resultType: 'json',
    controlnumber,
  })

  const url = `${AIR_QUALITY_BASE}/getAirQualityInfoClassifiedByStation?${params}`
  const res = await fetch(url)
  const data = await res.json()

  const header = data.response?.header ?? data.getAirQualityInfoClassifiedByStationResponse?.header ?? data.header
  const resultCode = header?.resultCode ?? data.resultCode
  if (resultCode && resultCode !== '00' && resultCode !== '0' && resultCode !== '03') {
    throw new Error(header?.resultMsg ?? data.resultMsg ?? '대기질 API 오류')
  }

  const body = data.response?.body ?? data.getAirQualityInfoClassifiedByStationResponse?.body ?? data.body
  const rawItems = body?.items ?? body?.item
  if (!rawItems) return null

  const itemList = rawItems.item ?? rawItems
  const items = Array.isArray(itemList) ? itemList : (itemList && typeof itemList === 'object' ? [itemList] : [])
  if (!items.length) return null

  const siteMatch = (site) => {
    const s = String(site ?? '').trim()
    return JEONPO_STATION_KEYWORDS.some((kw) => s.includes(kw))
  }

  const jeonpoItems = items.filter((it) => siteMatch(it.site ?? it.측정소명 ?? it.stationName ?? it.areaName))
  const targets = jeonpoItems.length > 0 ? jeonpoItems : items

  let pm25 = null
  let pm10 = null
  let stationName = '전포동'

  for (const it of targets) {
    const site = it.site ?? it.측정소명 ?? it.stationName ?? it.areaName
    if (site) stationName = site
    const repItem = String(it.repItem ?? '').toLowerCase()
    const repVal = parsePmValue(it.repVal)
    pm25 = pm25 ?? parsePmValue(it.pm25Value ?? it.pm25 ?? it.pm2_5 ?? it.초미세먼지 ?? ((repItem.includes('pm25') || repItem.includes('pm2.5') || repItem.includes('초미세')) ? repVal : null))
    pm10 = pm10 ?? parsePmValue(it.pm10Value ?? it.pm10 ?? it.미세먼지 ?? (repItem.includes('pm10') || (repItem.includes('미세') && !repItem.includes('초')) ? repVal : null))
  }

  return {
    pm25: pm25 ?? null,
    pm10: pm10 ?? null,
    dust: pm25 != null ? pm25ToDustLevel(pm25) : null,
    dust_label: pm25 != null ? pm25ToDustLabel(pm25) : null,
    station: stationName,
  }
}

function parsePmValue(v) {
  if (v == null || v === '' || v === '-') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/**
 * 황감지용 통합 날씨 데이터 조회
 */
export async function fetchHwangGamWeather(apiKey) {
  const [visibilityKm, vilage, air] = await Promise.all([
    fetchAsosVisibility(apiKey),
    fetchVilageFcst(apiKey),
    fetchAirQuality(apiKey).catch(() => null),
  ])

  const dustLevel = air?.dust ?? 'Moderate'
  const dustValue = air?.pm25 ?? null
  const dustLabel = air?.dust_label ?? (dustLevel === 'Good' ? '좋음' : dustLevel === 'Bad' ? '나쁨' : '보통')
  const station = air?.station ?? null

  return {
    visibility_km: visibilityKm ?? 10,
    humidity: vilage?.reh ?? 50,
    dust: dustLevel,
    dust_value: dustValue,
    dust_label: dustLabel,
    station,
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
