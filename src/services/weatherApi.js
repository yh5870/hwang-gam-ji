/**
 * 공공데이터포털 API 연동
 * ① 가시거리: Google Maps Platform Weather API (실시간, 황령산 좌표 기준)
 * ② 기상청 단기예보: SKY, PTY, REH(습도) - 황령산 격자(98,75)
 * ③ 부산광역시 대기질: 미세먼지(PM10), 초미세먼지(PM2.5) - 전포동 측정소
 * ※ 기상청 ASOS(전날 확정값)는 부정확하여 제거. 2시간 이상 지난 데이터는 사용하지 않음.
 */

const DATA_GO_KR = 'https://apis.data.go.kr'

const VILAGE_BASE = `${DATA_GO_KR}/1360000/VilageFcstInfoService_2.0`
const AIR_QUALITY_BASE = `${DATA_GO_KR}/6260000/AirQualityInfoService`

function buildProxyUrl(absoluteUrl) {
  const u = new URL('/api/proxy', 'http://local.invalid')
  u.searchParams.set('url', absoluteUrl)
  return `${u.pathname}${u.search}`
}

async function fetchDataGoKrJson(absoluteUrl) {
  const res = await fetch(import.meta.env.PROD ? buildProxyUrl(absoluteUrl) : absoluteUrl)
  const text = await res.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    throw new Error('공공데이터포털 프록시가 HTML을 반환했습니다. (배포/라우팅 문제 가능)')
  }
  const lower = text.toLowerCase()
  if (res.status === 429 || lower.includes('rate limit') || lower.includes('traffic overload')) {
    throw new Error(
      '기상·대기질 API 호출 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요. (하루 무료 호출 수 제한)',
    )
  }
  try {
    return JSON.parse(text)
  } catch {
    const hint = text.slice(0, 200)
    if (hint.toLowerCase().includes('rate limit')) {
      throw new Error(
        '기상·대기질 API 호출 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요. (하루 무료 호출 수 제한)',
      )
    }
    throw new Error(hint || '공공데이터포털 응답 파싱 실패')
  }
}

/** 전포동 측정소 검색 키워드 (황령산 봉수대 전포동 쪽) */
const JEONPO_STATION_KEYWORDS = ['전포', '전포동', '부산진구']

const HWANGNYEONG_NX = 98
const HWANGNYEONG_NY = 75

/**
 * 현재 시각 기준 가장 최근 단기예보 base_time 계산
 * 발표시각: 02, 05, 08, 11, 14, 17, 20, 23 (KST)
 * 데이터는 발표 후 30~40분 정도에 제공됨
 */
function nowKST() {
  // KMA publish times are KST. Use KST consistently regardless of user locale/timezone.
  const d = new Date()
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + 9 * 60 * 60 * 1000)
}

function getLatestBaseTime() {
  const now = nowKST()
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
 * 가시거리 조회 - Open-Meteo (무료·키 불필요·한국 지원·1시간 단위 실시간)
 * Google Weather API는 현재 미국만 지원하여 사용 불가.
 * 실패 시 null 반환 → fetchHwangGamWeather에서 예보 기반 추정으로 자동 전환.
 */
export async function fetchAsosVisibility() {
  return fetchOpenMeteoVisibility()
}

/**
 * Open-Meteo 현재 날씨 API - 부산(황령산 인근) 가시거리 조회
 * https://api.open-meteo.com — 무료, API 키 불필요, CORS 허용
 * visibility 단위: m → km 변환
 */
async function fetchOpenMeteoVisibility() {
  const lat = 35.158
  const lng = 129.064
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=visibility,temperature_2m,wind_speed_10m&timezone=Asia%2FSeoul`

  let data
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[Open-Meteo] HTTP 오류:', res.status)
      return { value: null, error: `Open-Meteo HTTP ${res.status}` }
    }
    data = await res.json()
  } catch (e) {
    console.warn('[Open-Meteo] 네트워크 오류:', e?.message)
    return { value: null, error: `Open-Meteo 연결 실패: ${e?.message}` }
  }

  const visM = data?.current?.visibility
  if (visM == null || Number.isNaN(Number(visM))) {
    console.warn('[Open-Meteo] visibility 필드 없음')
    return { value: null, error: 'Open-Meteo visibility 없음' }
  }

  const visKm = Math.round(Number(visM) / 100) / 10  // m → km (소수점 1자리)
  const tempC = data?.current?.temperature_2m ?? null
  // Open-Meteo wind_speed_10m 단위: km/h → m/s 변환
  const windKph = data?.current?.wind_speed_10m ?? null
  const windMs = windKph != null ? Math.round((windKph / 3.6) * 10) / 10 : null
  // Open-Meteo time은 이미 KST (timezone=Asia/Seoul 지정)
  const observedAt = data?.current?.time ? data.current.time.replace('T', ' ') : null

  console.info('[Open-Meteo] 가시거리:', visKm, 'km | 기온:', tempC, '°C | 관측(KST):', observedAt)

  return {
    value: visKm,
    temperature: tempC != null ? Number(tempC) : null,
    wind_speed: windMs,
    observedAt,
    stationName: '부산 (Open-Meteo)',
    source: 'openmeteo',
    error: null,
  }
}


/** 동일 시각에 단기예보 HTTP를 1번만 쓰기 위한 in-flight 공유 (홈+예보 중복 제거) */
let vilageItemsInflight = null

async function loadVilageFcstItemsRaw(apiKey) {
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
  const data = await fetchDataGoKrJson(url)
  const fcstResultCode = String(data.response?.header?.resultCode ?? '')
  if (fcstResultCode !== '00' && fcstResultCode !== '0') {
    const raw = data.response?.header?.resultMsg || '단기예보 API 오류'
    const msg = /rate limit|traffic overload/i.test(String(raw))
      ? '기상·대기질 API 호출 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요. (일일 무료 호출 제한)'
      : raw
    throw new Error(msg)
  }
  const items = data.response?.body?.items?.item
  if (!items || !items.length) return []
  return Array.isArray(items) ? items : [items]
}

async function getVilageFcstItemsShared(apiKey) {
  if (!vilageItemsInflight) {
    vilageItemsInflight = loadVilageFcstItemsRaw(apiKey).finally(() => {
      vilageItemsInflight = null
    })
  }
  return vilageItemsInflight
}

function parseCurrentVilageFromItems(items) {
  if (!items || !items.length) return null
  const bySlot = {}
  for (const it of items) {
    const key = `${it.fcstDate}-${it.fcstTime}`
    if (!bySlot[key]) bySlot[key] = {}
    bySlot[key][it.category] = it.fcstValue
  }
  const now = nowKST()
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
 * 단기예보 - 황령산 격자(98, 75) SKY, PTY, REH 조회
 * ※ 현재 시간에 해당하는 예보 슬롯을 사용 (14시 고정 아님)
 */
export async function fetchVilageFcst(apiKey) {
  const items = await getVilageFcstItemsShared(apiKey)
  return parseCurrentVilageFromItems(items)
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
  const now = nowKST()
  // 공공데이터는 정각 후 약 15~20분 뒤 업데이트 → 현재 시각 -1시간이 가장 안전한 확정 데이터
  const target = new Date(now.getTime() - 60 * 60 * 1000)
  const yyyy = target.getFullYear()
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const dd = String(target.getDate()).padStart(2, '0')
  const hh = String(target.getHours()).padStart(2, '0')
  const controlnumber = `${yyyy}${mm}${dd}${hh}`

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: 100,
    resultType: 'json',
    controlnumber,
  })

  const url = `${AIR_QUALITY_BASE}/getAirQualityInfoClassifiedByStation?${params}`
  const data = await fetchDataGoKrJson(url)

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

/** observedAt(tm) 파싱 → 경과 시간(시간) 반환. tm 형식: "YYYY-MM-DD HH" 또는 "YYYY-MM-DD HH:MM" */
function getHoursSinceObservation(tm) {
  if (!tm) return null
  let m = tm.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) m = tm.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2})/)
  if (!m) return null
  const min = m[5] != null ? parseInt(m[5], 10) : 0
  // ASOS tm is effectively KST local time. Compare in KST to avoid timezone drift.
  const obsKst = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), min)
  const now = nowKST()
  return (now.getTime() - obsKst.getTime()) / (1000 * 60 * 60)
}

/**
 * 예보(SKY, REH) 기반 가시거리 추정 (Plan B: ASOS 비어있거나 12h+ 오래됐을 때)
 * Est = (100-REH)/100 × SKY_Factor × 50
 * SKY_Factor: 맑음 1.0, 구름많음 0.7, 흐림 0.4
 */
function estimateVisibilityFromForecast(sky, reh, dustBad) {
  const s = Number(sky) || 1
  const r = Math.max(0, Math.min(100, Number(reh) || 50))
  const skyFactor = s === 1 ? 1.0 : s === 3 ? 0.7 : s === 4 ? 0.4 : 0.6
  let est = ((100 - r) / 100) * skyFactor * 50
  if (dustBad) est *= 0.75
  return Math.round(Math.max(5, Math.min(50, est)) * 10) / 10
}

/**
 * 황감지용 통합 날씨 데이터 조회
 * 필수: 가시거리(ASOS), 단기예보(습도/하늘) - 실패 시 에러 throw (fallback 사용 안 함)
 * 선택: 대기질 - 실패 시 Moderate 기본값
 */
export async function fetchHwangGamWeather(apiKey) {
  const [asosResult, vilage, air] = await Promise.all([
    fetchAsosVisibility().catch(() => null),
    fetchVilageFcst(apiKey),
    fetchAirQuality(apiKey).catch(() => null),
  ])

  if (!vilage) {
    throw new Error('습도·하늘 데이터를 불러올 수 없습니다. 단기예보 API에서 응답이 없습니다.')
  }

  const dustLevel = air?.dust ?? 'Moderate'
  const dustValue = air?.pm25 ?? null
  const dustLabel = air?.dust_label ?? (dustLevel === 'Good' ? '좋음' : dustLevel === 'Bad' ? '나쁨' : '보통')
  const station = air?.station ?? null

  const tempFromVilage = vilage.tmp != null ? Number(vilage.tmp) : null
  const windFromVilage = vilage.wsd != null ? Number(vilage.wsd) : null

  const visibilityObservedAt = asosResult?.observedAt || null
  const visibilityStation = asosResult?.stationName || '부산 기상관측소'
  const observedVisibilityKm = asosResult?.value ?? null
  const hoursSinceObs = getHoursSinceObservation(visibilityObservedAt)
  // Google Weather는 실시간 데이터. 2시간 이상 지난 값은 신뢰하지 않고 추정으로 전환.
  const asosStale = hoursSinceObs != null && hoursSinceObs > 2

  const estimatedVis = estimateVisibilityFromForecast(vilage.sky, vilage.reh, dustLevel === 'Bad')
  const hasObserved = observedVisibilityKm != null
  const useEstimated = !hasObserved || (asosStale && vilage.reh != null)

  const visibilityKm = useEstimated ? estimatedVis : observedVisibilityKm
  const visibilitySource = useEstimated ? 'estimated' : 'observed'
  const visibilityAsosValue = observedVisibilityKm
  // Open-Meteo 상한(24.14km) 도달 시 실제로는 그 이상일 수 있음을 표시
  const visibilityAtCap = !useEstimated && observedVisibilityKm != null && observedVisibilityKm >= 24.0

  const fcstDate = vilage.fcstDate || null
  const fcstTime = vilage.fcstTime || null
  const fcstAt = fcstDate && fcstTime
    ? `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}시 예보`
    : null

  return {
    visibility_km: visibilityKm,
    visibility_source: visibilitySource,
    visibility_at_cap: visibilityAtCap,
    visibility_observed_km: observedVisibilityKm,
    visibility_estimated_km: estimatedVis,
    visibility_asos_km: visibilityAsosValue,
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
    wind_speed: asosResult?.wind_speed ?? windFromVilage ?? null,
    temperature: asosResult?.temperature ?? tempFromVilage ?? null,
  }
}

function buildForecastListFromItems(items) {
  if (!items || !items.length) return []
  const byTime = {}
  for (const it of items) {
    const key = `${it.fcstDate}-${it.fcstTime}`
    if (!byTime[key]) byTime[key] = {}
    byTime[key][it.category] = it.fcstValue
  }
  const now = nowKST()
  const sortedAll = Object.entries(byTime)
    .map(([key, vals]) => {
      const [fd, ft] = key.split('-')
      const h = parseInt(ft.slice(0, 2), 10)
      const slotDate = new Date(parseInt(fd.slice(0, 4), 10), parseInt(fd.slice(4, 6), 10) - 1, parseInt(fd.slice(6, 8), 10), h)
      return { key, vals, slotDate }
    })
    .sort((a, b) => a.slotDate - b.slotDate)

  if (!sortedAll.length) return []

  const futureIdx = sortedAll.findIndex((s) => s.slotDate > now)
  const currentIdx = futureIdx > 0 ? futureIdx - 1 : futureIdx === 0 ? 0 : sortedAll.length - 1
  const reordered = [...sortedAll.slice(currentIdx), ...sortedAll.slice(0, currentIdx)].slice(0, 24)

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

/**
 * 24시간 예보 (단기예보 REH, SKY 기반 예상 점수)
 * ※ getVilageFcstItemsShared 로 홈과 동일 단기예보 응답 재사용
 */
export async function fetchForecast(apiKey) {
  const items = await getVilageFcstItemsShared(apiKey)
  return buildForecastListFromItems(items)
}

function estimateScoreFromForecast(reh, sky) {
  if (sky === 4) return Math.max(10, 50 - reh * 0.5)
  if (sky === 3) return Math.max(20, 70 - reh * 0.6)
  if (reh >= 80) return Math.max(30, 80 - reh)
  if (reh >= 60) return Math.max(50, 100 - reh)
  return Math.min(100, 50 + (100 - reh) * 0.5)
}
