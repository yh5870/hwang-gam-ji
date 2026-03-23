/**
 * 황감지 핵심 알고리즘
 * ※ 점수 체계: 10의 자리 = 가시거리, 1의 자리 = 습도·미세먼지
 * ※ timeOfDay: 일몰 전(before_sunset) / 일몰 시간(sunset ±30분) / 일몰 후(after_sunset)
 *
 * Dust 레벨: 'excellent' | 'good' | 'moderate' | 'bad'
 */

const DUST_GOOD = ['excellent', 'good', 'clean']
const DUST_MODERATE = ['moderate', 'fair']
const DUST_BAD = ['bad', 'poor']

/** 1의 자리 (0-9): 습도·미세먼지가 좋을수록 높음 */
function getOnesDigit(hum, dustBad, dustModerate) {
  let ones = 9
  if (dustBad) ones -= 5
  else if (dustModerate) ones -= 2
  if (hum > 85) ones -= 4
  else if (hum > 70) ones -= 3
  else if (hum > 55) ones -= 2
  else if (hum > 40) ones -= 1
  return Math.max(0, Math.min(9, Math.round(ones)))
}

/**
 * 가시거리별 점수 구간 (사용자 체감 반영)
 * - 50km+ → 90-99
 * - 40-49km → 80-89
 * - 30-39km → 70-79
 * - 20-29km → 70-79
 * - 0-20km → 0-69 (가시거리에 비례 분포, 1의 자리는 습도·먼지)
 */
function getBaseScoreFromVisibility(vis, ones) {
  if (vis >= 50) return 90 + ones
  if (vis >= 40) return 80 + ones
  if (vis >= 20) return 70 + ones
  const visBase = Math.round((vis / 20) * 60)
  const onesImpact = Math.round(ones * (vis / 20))
  return Math.min(69, Math.max(0, visBase + onesImpact))
}

/** sky: 맑음/구름많음/흐림/정보없음 */
function isSkyClear(sky) {
  return sky && (sky.includes('맑음') || sky === '맑음')
}

function isSkyCloudy(sky) {
  return sky && (sky.includes('흐림') || sky === '흐림')
}

/**
 * @param {Object} input
 * @param {number} input.visibility_km - 가시거리 (km)
 * @param {number} input.humidity - 습도 (%)
 * @param {string} input.dust - 미세먼지 상태
 * @param {string} [input.sky] - 하늘 상태 (맑음/구름많음/흐림)
 * @param {string} [input.sunsetStr] - 일몰 시각 "N시 M분"
 * @param {string} [input.sunsetHHMM] - 일몰 시각 "HH:MM"
 * @param {'before_sunset'|'sunset'|'after_sunset'} [input.timeOfDay]
 * @returns {Object} 분석 결과
 */
export function getHwangGamAnalysis({ visibility_km, humidity, dust, sky = '', sunsetStr = '', sunsetHHMM = '', timeOfDay = 'after_sunset' }) {
  const vis = visibility_km ?? 0
  const hum = humidity ?? 50
  const dustLower = String(dust ?? '').toLowerCase().trim()

  const dustGood = DUST_GOOD.some((d) => dustLower.includes(d))
  const dustModerate = DUST_MODERATE.some((d) => dustLower.includes(d))
  const dustBad = DUST_BAD.some((d) => dustLower.includes(d))

  const ones = getOnesDigit(hum, dustBad, dustModerate)
  const baseScore = getBaseScoreFromVisibility(vis, ones)

  const t = timeOfDay
  const clearSky = isSkyClear(sky)
  const cloudySky = isSkyCloudy(sky)

  const msg = (before, sunset, after) => (t === 'before_sunset' ? before : t === 'sunset' ? sunset : after)

  const appendSunset = (s) => (sunsetHHMM ? `${s} (오늘 일몰 ${sunsetHHMM})` : s)

  const buildResult = (obj) => ({ ...obj, sunsetStr, sunsetHHMM })

  // 잭팟: 70km↑ + 좋은 조건
  if (vis >= 70 && hum <= 30 && dustGood) {
    return buildResult({
      caseId: 1,
      caseName: '신의 영역',
      score: 10000,
      isJackpot: true,
      jackpotLevel: 2,
      message: msg(
        '10,000점 잭팟! 우주에서도 보일 조망이에요. 지금이 포착 타이밍!',
        clearSky ? '10,000점 잭팟! 하늘이 맑아서 일몰이 환상적일 거예요!' : '10,000점 잭팟! 오늘 일몰·야경 모두 기대해도 돼요.',
        '10,000점 잭팟! 우주에서도 보일 야경이에요. 당장 카메라 들고 뛰어가세요!',
      ),
      detail: {
        clearRange: '대마도 남단까지 선명',
        blurryFrom: null,
        reason: '대기가 매우 건조하고 깨끗해요. 수증기에 의한 빛 산란이 없어 대마도 산등성이 눈앞에 있는 듯 보여요.',
        condition: '진공 상태급 조망',
        conditionKey: 'god_tier',
      },
    })
  }

  if (vis >= 70 && hum <= 45) {
    return buildResult({
      caseId: 1,
      caseName: '신의 영역 (약간 습함)',
      score: 10000,
      isJackpot: true,
      jackpotLevel: 2,
      message: msg(
        '대마도까지 보여요! 조망 최상이에요.',
        clearSky ? '하늘이 맑아서 일몰이 예쁠 거예요. 대마도도 보여요!' : '가시거리 좋아요. 일몰·야경 모두 기대해도 돼요.',
        '대마도까지 보여요! 습도가 조금 있지만 야경은 최상이에요.',
      ),
      detail: {
        clearRange: '대마도 남단, 거제도 선명',
        blurryFrom: null,
        reason: '가시거리는 충분하지만 습도가 있어 아주 칼날 같은 선명도는 아니에요. 그래도 대마도 산줄기는 뚜렷해요.',
        condition: '역대급 조망',
        conditionKey: 'god_tier_slight_humid',
      },
    })
  }

  if (vis >= 50 && hum <= 40 && dustGood) {
    return buildResult({
      caseId: 2,
      caseName: '잭팟',
      score: 1000,
      isJackpot: true,
      jackpotLevel: 1,
      message: msg(
        '60km 잭팟! 황금의 순간이에요. 조망이 환상적이에요.',
        clearSky ? '60km 잭팟! 하늘이 맑아서 오늘 일몰 정말 이쁠 거예요!' : '60km 잭팟! 일몰·야경 모두 기대해도 돼요.',
        '60km 잭팟! 황금의 순간이에요. 야경이 환상적이에요.',
      ),
      detail: {
        clearRange: '대마도 북단 식별 가능, 거제도 산줄기 입체적',
        blurryFrom: null,
        reason: '초고기압 영향권이에요. 거제도 산줄기가 입체적으로 보이고, 수평선 너머 대마도가 그림자처럼 보여요.',
        condition: '황금의 순간',
        conditionKey: 'jackpot',
      },
    })
  }

  if (vis >= 70 && hum > 45) {
    return buildResult({
      caseId: 2,
      caseName: '잭팟 (습도 보정)',
      score: 1000,
      isJackpot: true,
      jackpotLevel: 1,
      message: msg(
        '가시거리는 최상이에요. 멀리 대마도는 흐릿할 수 있어요.',
        clearSky ? '하늘이 맑아서 일몰은 이쁠 거예요. 멀리 대마도는 흐릿할 수 있어요.' : '가시거리 좋아요. 일몰은 기대해도 돼요.',
        '가시거리는 최상인데 습도가 높아 멀리 대마도는 흐릿할 수 있어요.',
      ),
      detail: {
        clearRange: '거제도·기장·가덕도 선명',
        blurryFrom: '대마도 방향',
        reason: '가시거리 70km 이상이지만 습도가 있어 수증기 산란이 있어요.',
        condition: '습도 보정 잭팟',
        conditionKey: 'jackpot_humid',
      },
    })
  }

  const score = Math.max(1, Math.min(99, baseScore))

  if (vis <= 5 || (vis <= 10 && hum >= 95)) {
    return buildResult({
      caseId: 6,
      caseName: '곰탕 날씨',
      score: Math.max(5, score),
      isJackpot: false,
      jackpotLevel: 0,
      message: '앞산도 안 보여요. 집에서 쉬는 게 상책이에요.',
      detail: {
        clearRange: null,
        blurryFrom: '전 구간',
        reason: '낮은 구름이나 안개가 황령산을 덮고 있어요. 습도가 포화 상태라 가시거리 수치가 의미 없을 정도예요.',
        condition: '절망',
        conditionKey: 'fog',
      },
    })
  }

  if (vis >= 20 && hum > 80) {
    const blurryFrom = hum >= 90 ? '광안대교(3.5km) 너머' : '해운대 LCT(7.5km) 근처부터'
    return buildResult({
      caseId: 4,
      caseName: '해무의 습격',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '공기는 맑은데 습도가 높아서 멀리 풍경은 흐릿해요.',
        cloudySky ? '습도가 높아서 일몰이 흐릿하게 보일 수 있어요.' : '습도가 높아서 멀리 풍경은 우유 탄 듯 흐릿해요.',
        '공기는 맑은데 습도가 높아서 멀리 야경은 흐릿해요.',
      ),
      detail: {
        clearRange: '광안대교·마린시티까지 선명',
        blurryFrom,
        reason: '수증기 입자가 빛을 흩뿌려 멀리 있는 물체의 대비를 낮춰요.',
        condition: '축축한 맑음',
        conditionKey: 'humid_clear',
      },
    })
  }

  if (dustBad && hum <= 50) {
    return buildResult({
      caseId: 5,
      caseName: '회색 도시',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '먼지 필터가 끼어 있네요. 형태는 보이지만 선명한 조망은 어려워요.',
        cloudySky ? '먼지와 구름 때문에 일몰이 아쉬울 수 있어요.' : '먼지 필터가 끼어 있네요. 일몰·야경 모두 아쉬울 수 있어요.',
        '먼지 필터가 끼어 있네요. 형태는 보이지만 예쁜 야경은 어려워요.',
      ),
      detail: {
        clearRange: '가까운 서면 일대 빌딩 형태는 뚜렷',
        blurryFrom: '중거리 산줄기부터',
        reason: '미세먼지가 빛을 흡수해 하늘이 회색이나 주황색 빛을 띠며, 먼 산의 경계선이 뭉개져요.',
        condition: '퍽퍽한 시야',
        conditionKey: 'dusty',
      },
    })
  }

  if (vis >= 25 && hum <= 55) {
    return buildResult({
      caseId: 3,
      caseName: '청명한 부산',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: dustBad
        ? msg('먼지 때문에 선명도가 떨어져요.', '먼지 때문에 일몰이 아쉬울 수 있어요.', '먼지 때문에 선명도가 떨어져요.')
        : msg(
            '조망·풍경 보기 좋은 날이에요!',
            clearSky ? appendSunset('하늘이 맑아서 일몰이 예쁠 거예요!') : '일몰 시간대예요. 하늘 상태 확인해보세요.',
            '지금 나가면 야경 보기 좋아요!',
          ),
      detail: {
        clearRange: '가덕도·기장·해운대 LCT 창문 하나하나까지 선명',
        blurryFrom: dustBad ? '중거리부터' : null,
        reason: dustBad ? '미세먼지가 빛을 흡수해 채도가 낮아 보여요.' : '부산 전역이 깨끗해요. 공기가 맑아 시야가 선명해요.',
        condition: dustBad ? '먼지 낀 청명' : '청명',
        conditionKey: dustBad ? 'clear_dusty' : 'clear',
      },
    })
  }

  if (vis >= 15 && hum > 60 && hum <= 80) {
    return buildResult({
      caseId: 4,
      caseName: '해무의 습격',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '습도가 높아서 멀리 풍경은 흐릿해요.',
        cloudySky ? '습도가 높아 일몰이 흐릿하게 보일 수 있어요.' : '습도가 높아서 멀리 풍경은 우유 탄 듯 흐릿해요.',
        '습도가 높아서 멀리 야경은 흐릿해요.',
      ),
      detail: {
        clearRange: '광안대교·마린시티·해운대 앞바다',
        blurryFrom: 'LCT 빌딩부터',
        reason: '수증기 입자가 빛을 흩뿌려 멀리 있는 물체의 대비를 낮춰요.',
        condition: '축축한 맑음',
        conditionKey: 'humid_clear',
      },
    })
  }

  if (vis >= 10 && vis < 25 && dustBad) {
    return buildResult({
      caseId: 5,
      caseName: '회색 도시',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '먼지 필터가 끼어 있네요. 선명한 조망은 어려워요.',
        '먼지 때문에 일몰이 아쉬울 수 있어요.',
        '먼지 필터가 끼어 있네요. 예쁜 야경은 어려워요.',
      ),
      detail: {
        clearRange: '서면·해운대 인근 빌딩 형태',
        blurryFrom: '산줄기·수평선',
        reason: '미세먼지가 빛을 흡수해 하늘이 회색이나 주황색으로 보여요.',
        condition: '퍽퍽한 시야',
        conditionKey: 'dusty',
      },
    })
  }

  if (vis >= 10 && vis < 25) {
    return buildResult({
      caseId: vis >= 20 ? 4 : 5,
      caseName: vis >= 20 ? '해무 근접' : '보통',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '조망은 가능한 수준이에요. 기대만큼 선명하진 않을 수 있어요.',
        '가시거리 보통이에요. 일몰은 하늘 상태에 따라 다를 수 있어요.',
        '조망은 가능한 수준이에요. 야경은 기대만큼 선명하진 않을 수 있어요.',
      ),
      detail: {
        clearRange: '가덕도·광안대교 일대',
        blurryFrom: '기장 방향 산줄기부터',
        reason: '가시거리와 습도가 보통 수준이에요.',
        condition: '보통',
        conditionKey: 'normal',
      },
    })
  }

  if (vis < 10) {
    return buildResult({
      caseId: 6,
      caseName: '아쉬운 날',
      score,
      isJackpot: false,
      jackpotLevel: 0,
      message: msg(
        '조망이 많이 제한돼요. 내일을 기다려 보는 게 좋아요.',
        '가시거리가 짧아서 일몰이 흐릿하게 보일 수 있어요.',
        '조망이 많이 제한돼요. 야경은 내일을 기다려 보는 게 좋아요.',
      ),
      detail: {
        clearRange: '광안대교·마린시티 근처',
        blurryFrom: '그 너머 전 구간',
        reason: '가시거리가 짧아 멀리 있는 풍경을 보기 어려워요.',
        condition: '제한적',
        conditionKey: 'limited',
      },
    })
  }

  return buildResult({
    caseId: 3,
    caseName: '청명한 부산',
    score,
    isJackpot: false,
    jackpotLevel: 0,
    message: msg(
      '가시거리는 나오지만 습도 때문에 멀리는 뿌옇게 느껴질 수 있어요.',
      clearSky ? '습도가 있지만 하늘이 맑아서 일몰은 괜찮을 거예요.' : '가시거리 좋은데 습도 때문에 멀리는 뿌옇게 보일 수 있어요.',
      '가시거리는 나오지만 습도 때문에 멀리 야경은 뿌옇게 느껴질 수 있어요.',
    ),
    detail: {
      clearRange: '가덕도·기장·해운대 일대 선명',
      blurryFrom: '수평선 근처 대마도 쪽',
      reason: '가시거리 수치는 좋은데 습도가 있어 수증기 산란이 조금 있어요.',
      condition: '습한 청명',
      conditionKey: 'clear_humid',
    },
  })
}
