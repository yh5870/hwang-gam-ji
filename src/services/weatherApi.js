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
 * getWthrDataList + dateCd=HR = 시간자료
 * ※ 전일(D-1) 자료까지 제공, 전일 자료는 11시 이후 조회가능 (활용가이드)
 * ※ 시정(vs) 단위: 10m → km 변환: vs/100
 * ※ D-1 하루치 한 번에 조회 후 가장 최신 관측값 사용
 */
export async function fetchAsosVisibility(apiKey) {
  const now = new Date()
  const currentHour = now.getHours()
  const targetDate = new Date(now)
  if (currentHour < 11) {
    targetDate.setDate(targetDate.getDate() - 2)
  } else {
    targetDate.setDate(targetDate.getDate() - 1)
  }
  const y = targetDate.getFullYear()
  const m = String(targetDate.getMonth() + 1).padStart(2, '0')
  const d = String(targetDate.getDate()).padStart(2, '0')
  const date = `${y}${m}${d}`

  let result = await fetchAsosVisibilityDayRange(apiKey, date)
  if (result.value != null) return result

  const dayBefore = new Date(targetDate)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const yd = `${dayBefore.getFullYear()}${String(dayBefore.getMonth() + 1).padStart(2, '0')}${String(dayBefore.getDate()).padStart(2, '0')}`
  result = await fetchAsosVisibilityDayRange(apiKey, yd)
  if (result.value != null) return result

  for (const h of [23, 22, 20, 17, 14, 11, 8]) {
    result = await fetchAsosVisibilitySingle(apiKey, date, String(h).padStart(2, '0'))
    if (result.value != null) return result
  }
  result = await fetchAsosVisibilitySingle(apiKey, yd, '23')
  if (result.value != null) return result

  const lastError = result.error
  throw new Error(
    lastError
      ? `가시거리 데이터를 불러올 수 없습니다. (${lastError})`
      : '가시거리 데이터를 불러올 수 없습니다. 기상청 ASOS API에서 응답이 없습니다.',
  )
}

/** 단일 시각 조회 (폴백용) */
async function fetchAsosVisibilitySingle(apiKey, date, hour) {
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
  try {
    const res = await fetch(url)
    const data = await res.json()
    const header = data.response?.header
    const resultCode = String(header?.resultCode ?? '')
    if (resultCode !== '00' && resultCode !== '0') return { value: null, error: header?.resultMsg }
    const items = data.response?.body?.items?.item
    if (!items) return { value: null, error: '데이터 없음' }
    const item = Array.isArray(items) ? items[0] : items
    if (!item?.vs || item.vs === '') return { value: null, error: '시정 없음' }
    const vs = Number(item.vs)
    if (Number.isNaN(vs) || vs < 0) return { value: null, error: `잘못된 시정: ${item.vs}` }
    return {
      value: vs / 100,
      temperature: item.ta != null && item.ta !== '' ? Number(item.ta) : null,
      wind_speed: item.ws != null && item.ws !== '' ? Number(item.ws) : null,
      observedAt: item.tm || null,
      stationName: item.stnNm || '부산',
      error: null,
    }
  } catch (e) {
    return { value: null, error: e?.message || '네트워크 오류' }
  }
}

/** D-1 하루치 조회 후 가장 최신(마지막) 관측값 반환 */
async function fetchAsosVisibilityDayRange(apiKey, date) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 24,
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'HR',
    startDt: date,
    startHh: '00',
    endDt: date,
    endHh: '23',
    stnIds: String(BUSAN_STN),
  })

  const url = `${ASOS_BASE}/getWthrDataList?${params}`
  let res
  let data
  try {
    res = await fetch(url)
    data = await res.json()
  } catch (e) {
    return { value: null, error: `네트워크 오류: ${e?.message || '연결 실패'}` }
  }

  const header = data.response?.header
  const resultCode = String(header?.resultCode ?? '')
  const resultMsg = header?.resultMsg || ''

  if (resultCode !== '00' && resultCode !== '0') {
    if (resultCode === '03') {
      return { value: null, error: resultMsg || '해당 시간 데이터 없음 (NODATA_ERROR)' }
    }
    return { value: null, error: resultMsg || `API 오류 (코드: ${resultCode})` }
  }

  const items = data.response?.body?.items?.item
  if (!items || (Array.isArray(items) && items.length === 0)) {
    return { value: null, error: '응답에 데이터 없음' }
  }

  const list = Array.isArray(items) ? items : [items]
  const withVs = list
    .filter((it) => it != null && it.vs != null && it.vs !== '')
    .sort((a, b) => (b.tm || '').localeCompare(a.tm || ''))

  const item = withVs[0]
  if (!item) return { value: null, error: '시정(vs) 값 없음' }

  const vs = Number(item.vs)
  if (Number.isNaN(vs) || vs < 0) {
    return { value: null, error: `잘못된 시정 값: ${item.vs}` }
  }

  const ta = item.ta != null && item.ta !== '' ? Number(item.ta) : null
  const ws = item.ws != null && item.ws !== '' ? Number(item.ws) : null

  return {
    value: vs / 100,
    temperature: !Number.isNaN(ta) ? ta : null,
    wind_speed: !Number.isNaN(ws) ? ws : null,
    observedAt: item.tm || null,
    stationName: item.stnNm || '부산',
    error: null,
  }
}

/**
 * 단기예보 - 황령산 격자(98, 75) SKY, PTY, REH 조회
 * ※ 현재 시간에 해당하는 예보 슬롯을 사용 (14시 고정 아님)
 */
export async function fetchVilageFcst(apiKey) {
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

  const fcstResultCode = String(data.response?.header?.resultCode ?? '')
  if (fcstResultCode !== '00' && fcstResultCode !== '0') {
    throw new Error(data.response?.header?.resultMsg || '단기예보 API 오류')
  }

  const items = data.response?.body?.items?.item
  if (!items || !items.length) return null

  const bySlot = {}
  for (const it of items) {
    const key = `${it.fcstDate}-${it.fcstTime}`
    if (!bySlot[key]) bySlot[key] = {}
    bySlot[key][it.category] = it.fcstValue
  }

  const now = new Date()
  const slots = Object.entries(bySlot)
    .map(([key, vals]) => {
      const [d, t] = key.split('-')
      const h = parseInt(t.slice(0, 2), 10)
      const m = parseInt(t.slice(2, 4), 10) || 0
      const slotDate = new Date(parseInt(d.slice(0, 4), 10), parseInt(d.slice(4, 6), 10) - 1, parseInt(d.slice(6, 8), 10), h, m)
      return { key, vals, slotDate }
    })
    .sort((a, b) => a.slotDate - b.slotDate)

  const futureIdx = slots.findIndex((s) => s.slotDate > now)
  const currentSlot =
    futureIdx > 0 ? slots[futureIdx - 1] : futureIdx === 0 ? slots[0] : slots[slots.length - 1]
  const target = currentSlot || slots[0]
  const [fcstDate, fcstTime] = target.key.split('-')
  const byKey = target.vals

  return {
    sky: byKey.SKY,
    pty: byKey.PTY,
    reh: byKey.REH ? Number(byKey.REH) : null,
    tmp: byKey.TMP ? Number(byKey.TMP) : null,
    wsd: byKey.WSD ? Number(byKey.WSD) : null,
    fcstDate,
    fcstTime,
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
 * 필수: 가시거리(ASOS), 단기예보(습도/하늘) - 실패 시 에러 throw (fallback 사용 안 함)
 * 선택: 대기질 - 실패 시 Moderate 기본값
 */
export async function fetchHwangGamWeather(apiKey) {
  const [asosResult, vilage, air] = await Promise.all([
    fetchAsosVisibility(apiKey),
    fetchVilageFcst(apiKey),
    fetchAirQuality(apiKey).catch(() => null),
  ])

  if (!asosResult || asosResult.value == null) {
    throw new Error('가시거리 데이터를 불러올 수 없습니다.')
  }
  if (!vilage) {
    throw new Error('습도·하늘 데이터를 불러올 수 없습니다. 단기예보 API에서 응답이 없습니다.')
  }

  const dustLevel = air?.dust ?? 'Moderate'
  const dustValue = air?.pm25 ?? null
  const dustLabel = air?.dust_label ?? (dustLevel === 'Good' ? '좋음' : dustLevel === 'Bad' ? '나쁨' : '보통')
  const station = air?.station ?? null

  const tempFromVilage = vilage.tmp != null ? Number(vilage.tmp) : null
  const windFromVilage = vilage.wsd != null ? Number(vilage.wsd) : null

  const visibilityObservedAt = asosResult.observedAt || null
  const visibilityStation = asosResult.stationName || '부산 기상관측소'
  const fcstDate = vilage.fcstDate || null
  const fcstTime = vilage.fcstTime || null
  const fcstAt = fcstDate && fcstTime
    ? `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}시 예보`
    : null

  return {
    visibility_km: asosResult.value,
    visibility_observed_at: visibilityObservedAt,
    visibility_station: visibilityStation,
    fcst_at: fcstAt,
    humidity: vilage.reh ?? 50,
    dust: dustLevel,
    dust_value: dustValue,
    dust_label: dustLabel,
    station,
    sky: vilage ? skyToText(vilage.sky) : '정보없음',
    pty: vilage?.pty ?? '0',
    wind_speed: asosResult.wind_speed ?? windFromVilage ?? null,
    temperature: asosResult.temperature ?? tempFromVilage ?? null,
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

  const forecastResultCode = String(data.response?.header?.resultCode ?? '')
  if (forecastResultCode !== '00' && forecastResultCode !== '0') {
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

  const now = new Date()
  const sorted = Object.entries(byTime)
    .map(([key, vals]) => {
      const [fd, ft] = key.split('-')
      const h = parseInt(ft.slice(0, 2), 10)
      const slotDate = new Date(parseInt(fd.slice(0, 4), 10), parseInt(fd.slice(4, 6), 10) - 1, parseInt(fd.slice(6, 8), 10), h)
      return { key, vals, slotDate }
    })
    .sort((a, b) => a.slotDate - b.slotDate)
    .slice(0, 24)

  const futureIdx = sorted.findIndex((s) => s.slotDate > now)
  const currentIdx = futureIdx > 0 ? futureIdx - 1 : futureIdx === 0 ? 0 : sorted.length - 1
  const reordered = [...sorted.slice(currentIdx), ...sorted.slice(0, currentIdx)].slice(0, 24)

  return reordered.map((entry, i) => {
    const { key, vals } = entry
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
