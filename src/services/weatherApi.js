/**
 * 공공데이터포털 API 연동
 * ① 기상청 ASOS: 시정(가시거리)
 * ② 기상청 단기예보: SKY, PTY, REH(습도) - 황령산 격자(98,75)
 * ③ 부산광역시 대기질: 미세먼지(PM10), 초미세먼지(PM2.5) - 전포동 측정소 (황령산 봉수대 전포동 쪽)
 */

const DATA_GO_KR = 'https://apis.data.go.kr'

const ASOS_BASE = `${DATA_GO_KR}/1360000/AsosHourlyInfoService`
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

const BUSAN_STN = 159
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
 * ASOS 시간자료(Hourly) - 부산(159) 시정(가시거리) 조회
 * getWthrDataList + dateCd=HR = 시간자료 (실시간 Hourly)
 * ※ 매 시 15~20분 경에 직전 정각 관측값 업데이트됨
 * ※ 시정(vs) 단위: 10m → km 변환: vs/100
 *
 * [확정 전략] ASOS getWthrDataList(dateCd=HR)는 전날까지만 자료를 제공함.
 * - endDt=오늘로 요청하면 resultCode 99 ("전날 자료까지 제공됩니다") 에러 반환.
 * - 따라서 어제 날짜(00~23시) 하루치만 조회하고, 그 중 vs 값이 있는 최신 관측값을 사용.
 * - 어제 데이터이므로 asosStale 기준을 36h로 넓혀 하루 종일 실측값으로 표시.
 */
export async function fetchAsosVisibility(apiKey) {
  const now = nowKST()

  const formatDt = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const dateYesterday = formatDt(yesterday)

  // 어제 00~23시 하루치 조회 (오늘 날짜 포함 시 resultCode 99 반환됨)
  const result = await fetchAsosVisibilityRangeLatest(apiKey, dateYesterday, '00', dateYesterday, '23', 24)
  if (result?.value != null) return result

  const lastError = result?.error
  throw new Error(
    lastError
      ? `가시거리 데이터를 불러올 수 없습니다. (${lastError})`
      : '가시거리 데이터를 불러올 수 없습니다. 기상청 ASOS API에서 응답이 없습니다.',
  )
}

/** 2일 범위 조회 후 가장 최신(마지막) 관측값 반환 */
async function fetchAsosVisibilityRangeLatest(apiKey, startDt, startHh, endDt, endHh, numRows) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: 1,
    numOfRows: String(numRows ?? 72),
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'HR',
    startDt,
    startHh,
    endDt,
    endHh,
    stnIds: String(BUSAN_STN),
  })

  const url = `${ASOS_BASE}/getWthrDataList?${params}`
  let data
  try {
    data = await fetchDataGoKrJson(url)
  } catch (e) {
    console.warn('[ASOS] 네트워크/파싱 오류:', e?.message)
    return { value: null, error: `네트워크 오류: ${e?.message || '연결 실패'}` }
  }

  const header = data.response?.header
  const resultCode = String(header?.resultCode ?? '')
  const resultMsg = header?.resultMsg || ''
  console.info('[ASOS] resultCode:', resultCode, '| resultMsg:', resultMsg, '| 쿼리:', { startDt, startHh, endDt, endHh })

  if (resultCode !== '00' && resultCode !== '0') {
    if (resultCode === '03') {
      return { value: null, error: resultMsg || '해당 시간 데이터 없음 (NODATA_ERROR)' }
    }
    return { value: null, error: resultMsg || `API 오류 (코드: ${resultCode})` }
  }

  const items = data.response?.body?.items?.item
  if (!items || (Array.isArray(items) && items.length === 0)) {
    console.warn('[ASOS] 응답에 item 없음. body:', JSON.stringify(data.response?.body).slice(0, 300))
    return { value: null, error: '응답에 데이터 없음' }
  }

  const list = Array.isArray(items) ? items : [items]
  console.info('[ASOS] 수신 item 수:', list.length, '| vs 샘플:', list.slice(0, 3).map(i => ({ tm: i.tm, vs: i.vs })))

  const withVs = list
    .filter((it) => it != null && it.vs != null && it.vs !== '' && String(it.vs).trim() !== '')
    .sort((a, b) => (b.tm || '').localeCompare(a.tm || ''))

  console.info('[ASOS] vs 필터 후 count:', withVs.length, '| 최신:', withVs[0] ? { tm: withVs[0].tm, vs: withVs[0].vs } : null)

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
    fetchAsosVisibility(apiKey).catch(() => null),
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
  // ASOS는 전날까지만 자료를 제공하므로 최대 ~36시간 전 데이터까지 실측값으로 인정.
  const asosStale = hoursSinceObs != null && hoursSinceObs > 36

  const estimatedVis = estimateVisibilityFromForecast(vilage.sky, vilage.reh, dustLevel === 'Bad')
  const hasObserved = observedVisibilityKm != null
  const useEstimated = !hasObserved || (asosStale && vilage.reh != null)

  const visibilityKm = useEstimated ? estimatedVis : observedVisibilityKm
  const visibilitySource = useEstimated ? 'estimated' : 'observed'
  const visibilityAsosValue = observedVisibilityKm

  const fcstDate = vilage.fcstDate || null
  const fcstTime = vilage.fcstTime || null
  const fcstAt = fcstDate && fcstTime
    ? `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}시 예보`
    : null

  return {
    visibility_km: visibilityKm,
    visibility_source: visibilitySource,
    // New: expose both observed & estimated explicitly (UI can show both).
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
