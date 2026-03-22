/**
 * 황감지 핵심 알고리즘
 * 가시거리, 습도, 미세먼지 조합별 조망 상태 및 상세 멘트 산출
 *
 * Dust 레벨: 'excellent' | 'good' | 'moderate' | 'bad'
 * - excellent/good: 좋음 (PM2.5 ~15 이하)
 * - moderate: 보통 (PM2.5 16~35)
 * - bad: 나쁨 (PM2.5 36+)
 */

const DUST_GOOD = ['excellent', 'good', 'clean']
const DUST_MODERATE = ['moderate', 'fair']
const DUST_BAD = ['bad', 'poor']

/**
 * @param {Object} input
 * @param {number} input.visibility_km - 가시거리 (km)
 * @param {number} input.humidity - 습도 (%)
 * @param {string} input.dust - 미세먼지 상태 (Excellent, Good, Clean, Moderate, Bad 등)
 * @returns {Object} 분석 결과
 */
export function getHwangGamAnalysis({ visibility_km, humidity, dust }) {
  const vis = visibility_km ?? 0
  const hum = humidity ?? 50
  const dustLower = String(dust ?? '').toLowerCase().trim()

  const dustGood = DUST_GOOD.some((d) => dustLower.includes(d))
  const dustModerate = DUST_MODERATE.some((d) => dustLower.includes(d))
  const dustBad = DUST_BAD.some((d) => dustLower.includes(d))

  // 6. 곰탕 날씨: 가시거리 5km 이하 또는 습도 포화
  if (vis <= 5 || (vis <= 10 && hum >= 95)) {
    return {
      caseId: 6,
      caseName: '곰탕 날씨',
      score: 10,
      isJackpot: false,
      jackpotLevel: 0,
      message: '앞산도 안 보여요. 집에서 쉬는 게 상책이에요.',
      detail: {
        clearRange: null,
        blurryFrom: '전 구간',
        reason:
          '낮은 구름이나 안개가 황령산을 덮고 있어요. 습도가 포화 상태라 가시거리 수치가 의미 없을 정도예요.',
        condition: '절망',
        conditionKey: 'fog',
      },
    }
  }

  // 습도 보정: 가시거리 20km 이상인데 습도 80% 초과 → "축축한 맑음"
  if (vis >= 20 && hum > 80) {
    const blurryFrom = hum >= 90 ? '광안대교(3.5km) 너머' : '해운대 LCT(7.5km) 근처부터'
    return {
      caseId: 4,
      caseName: '해무의 습격',
      score: Math.min(60, Math.round(40 + (vis - 15) * 2)),
      isJackpot: false,
      jackpotLevel: 0,
      message: '공기는 맑은데 습도가 높아서 멀리 있는 풍경은 우유를 탄 듯 흐릿해요.',
      detail: {
        clearRange: '광안대교·마린시티까지 선명',
        blurryFrom,
        reason:
          '미 산란(Mie Scattering) 현상 때문이에요. 수증기 입자가 빛을 사방으로 흩뿌려서 멀리 있는 물체의 대비(Contrast)를 낮춰요. 가까운 건 잘 보이지만 먼 산은 하얀 필터를 낀 듯 흐릿해져요.',
        condition: '축축한 맑음',
        conditionKey: 'humid_clear',
      },
    }
  }

  // 미세먼지 나쁨 + 습도 낮음 → "퍽퍽한 시야"
  if (dustBad && hum <= 50) {
    return {
      caseId: 5,
      caseName: '회색 도시',
      score: Math.min(40, Math.round(20 + vis)),
      isJackpot: false,
      jackpotLevel: 0,
      message: '먼지 필터가 끼어 있네요. 형태는 보이지만 예쁜 야경을 기대하긴 어려워요.',
      detail: {
        clearRange: '가까운 서면 일대 빌딩 형태는 뚜렷',
        blurryFrom: '중거리 산줄기부터',
        reason:
          '미세먼지 알갱이가 빛을 산란시키는 게 아니라 흡수해버려요. 하늘 색깔이 파랗지 않고 회색이나 주황색 빛을 띠며, 먼 산의 경계선이 회색으로 뭉개져요.',
        condition: '퍽퍽한 시야',
        conditionKey: 'dusty',
      },
    }
  }

  // 1. 신의 영역: 70km↑, 습도 30%↓, 좋음
  if (vis >= 70 && hum <= 30 && dustGood) {
    return {
      caseId: 1,
      caseName: '신의 영역',
      score: 10000,
      isJackpot: true,
      jackpotLevel: 2,
      message: '10,000점 잭팟! 우주에서도 보일 조망입니다. 당장 카메라 들고 뛰어가세요!',
      detail: {
        clearRange: '대마도 남단까지 선명',
        blurryFrom: null,
        reason:
          '대기가 매우 건조하고 깨끗해요. 수증기에 의한 빛 산란이 없어 대마도 산등성이 눈앞에 있는 듯 보여요. 대기 중 방해물이 거의 없어 빛이 직진으로 꽂히는 진공 상태급 조망이에요.',
        condition: '진공 상태급 조망',
        conditionKey: 'god_tier',
      },
    }
  }

  // 70km↑ but 습도 높음 → 보정 (잭팟은 아니지만 1000pt 수준)
  if (vis >= 70 && hum > 30 && hum <= 45) {
    return {
      caseId: 1,
      caseName: '신의 영역 (약간 습함)',
      score: 10000,
      isJackpot: true,
      jackpotLevel: 2,
      message: '대마도까지 보여요! 습도가 조금 있지만 조망은 최상이에요.',
      detail: {
        clearRange: '대마도 남단, 거제도 선명',
        blurryFrom: null,
        reason: '가시거리는 충분하지만 습도가 30%를 넘어 아주 칼날 같은 선명도는 아니에요. 그래도 대마도 산줄기는 뚜렷하게 보여요.',
        condition: '역대급 조망',
        conditionKey: 'god_tier_slight_humid',
      },
    }
  }

  // 2. 잭팟: 50km↑, 습도 40%↓, 좋음
  if (vis >= 50 && hum <= 40 && dustGood) {
    return {
      caseId: 2,
      caseName: '잭팟',
      score: 1000,
      isJackpot: true,
      jackpotLevel: 1,
      message: '60km 잭팟! 황금의 순간이에요.',
      detail: {
        clearRange: '대마도 북단 식별 가능, 거제도 산줄기 입체적',
        blurryFrom: null,
        reason:
          '초고기압 영향권이에요. 거제도 산줄기가 입체적으로 보이고, 수평선 너머 대마도가 그림자처럼 보여요.',
        condition: '황금의 순간',
        conditionKey: 'jackpot',
      },
    }
  }

  // 70km↑ but 습도 45% 초과 → 1000pt로 보정 (잭팟 유지하되 설명 변경)
  if (vis >= 70 && hum > 45) {
    return {
      caseId: 2,
      caseName: '잭팟 (습도 보정)',
      score: 1000,
      isJackpot: true,
      jackpotLevel: 1,
      message: '가시거리는 최상인데 습도가 높아 멀리 대마도는 흐릿할 수 있어요.',
      detail: {
        clearRange: '거제도·기장·가덕도 선명',
        blurryFrom: '대마도 방향',
        reason:
          '가시거리 70km 이상이지만 습도가 45%를 넘어 수증기 산란이 있어요. 가까운 거제도·기장은 선명하고, 수평선 너머 대마도는 흐릿할 수 있어요.',
        condition: '습도 보정 잭팟',
        conditionKey: 'jackpot_humid',
      },
    }
  }

  // 50km↑ but 습도 40~55% → 100pt 수준으로 보정
  if (vis >= 50 && hum > 40 && hum <= 55) {
    return {
      caseId: 3,
      caseName: '청명한 부산',
      score: 100,
      isJackpot: false,
      jackpotLevel: 0,
      message: '가시거리는 나오지만 습도 때문에 멀리는 살짝 뿌옇게 느껴질 수 있어요.',
      detail: {
        clearRange: '가덕도·기장·해운대 일대 선명',
        blurryFrom: '수평선 근처 대마도 쪽',
        reason:
          '가시거리 수치는 좋은데 습도가 40%를 넘어 수증기 산란이 조금 있어요. 가까운 건 매우 선명하고, 멀리 대마도는 흐릿할 수 있어요.',
        condition: '습한 청명',
        conditionKey: 'clear_humid',
      },
    }
  }

  // 3. 청명한 부산: 30km 전후, 습도 50%↓, 보통
  if (vis >= 25 && vis < 50 && hum <= 55) {
    const score = Math.min(100, Math.round(60 + (vis - 25) * 1.6))
    return {
      caseId: 3,
      caseName: '청명한 부산',
      score: dustBad ? Math.round(score * 0.6) : score,
      isJackpot: false,
      jackpotLevel: 0,
      message: dustBad
        ? '먼지 때문에 선명도가 떨어져요.'
        : '지금 나가면 야경 보기 좋아요!',
      detail: {
        clearRange: '가덕도·기장·해운대 LCT 창문 하나하나까지 선명',
        blurryFrom: dustBad ? '중거리부터' : null,
        reason: dustBad
          ? '미세먼지가 빛을 흡수해 채도가 낮아 보여요.'
          : '부산 전역이 깨끗해요. 공기가 맑아 야경 빛 갈라짐이 날카로워요.',
        condition: dustBad ? '먼지 낀 청명' : '청명',
        conditionKey: dustBad ? 'clear_dusty' : 'clear',
      },
    }
  }

  // 4. 해무 (습도 60~80): 가시거리 나오지만 습도 보정
  if (vis >= 15 && hum > 60 && hum <= 80) {
    const score = Math.round(50 + (vis - 15) - (hum - 60) * 0.5)
    return {
      caseId: 4,
      caseName: '해무의 습격',
      score: Math.max(30, Math.min(65, score)),
      isJackpot: false,
      jackpotLevel: 0,
      message: '습도가 높아서 멀리 있는 풍경은 우유를 탄 듯 흐릿해요.',
      detail: {
        clearRange: '광안대교·마린시티·해운대 앞바다',
        blurryFrom: 'LCT 빌딩부터',
        reason:
          '수증기 입자(미 산란)가 빛을 흩뿌려 멀리 있는 물체의 대비를 낮춰요. 가까운 마린시티는 보이지만 먼 산은 하얀 필터를 낀 듯 흐릿해요.',
        condition: '축축한 맑음',
        conditionKey: 'humid_clear',
      },
    }
  }

  // 5. 회색 (15km 전후, 미세먼지 나쁨)
  if (vis >= 10 && vis < 25 && dustBad) {
    return {
      caseId: 5,
      caseName: '회색 도시',
      score: Math.round(25 + vis),
      isJackpot: false,
      jackpotLevel: 0,
      message: '먼지 필터가 끼어 있네요. 형태는 보이지만 예쁜 야경은 어려워요.',
      detail: {
        clearRange: '서면·해운대 인근 빌딩 형태',
        blurryFrom: '산줄기·수평선',
        reason:
          '미세먼지가 빛을 흡수해 하늘이 회색이나 주황색으로 보여요. 먼 산 경계가 뭉개져요.',
        condition: '퍽퍽한 시야',
        conditionKey: 'dusty',
      },
    }
  }

  // 중간 구간: 10~25km, 일반
  if (vis >= 10 && vis < 25) {
    const score = Math.round(35 + vis * 1.5)
    return {
      caseId: vis >= 20 ? 4 : 5,
      caseName: vis >= 20 ? '해무 근접' : '보통',
      score: Math.min(65, score),
      isJackpot: false,
      jackpotLevel: 0,
      message: '조망은 가능한 수준이에요. 기대만큼 선명하진 않을 수 있어요.',
      detail: {
        clearRange: '가덕도·광안대교 일대',
        blurryFrom: '기장 방향 산줄기부터',
        reason: '가시거리와 습도가 보통 수준이에요. 가까운 건 보이지만 멀리는 흐릿할 수 있어요.',
        condition: '보통',
        conditionKey: 'normal',
      },
    }
  }

  // 5~10km
  return {
    caseId: 6,
    caseName: '아쉬운 날',
    score: Math.round(10 + vis),
    isJackpot: false,
    jackpotLevel: 0,
    message: '조망이 많이 제한돼요. 내일을 기다려 보는 게 좋아요.',
    detail: {
      clearRange: '광안대교·마린시티 근처',
      blurryFrom: '그 너머 전 구간',
      reason: '가시거리가 짧아 멀리 있는 풍경을 보기 어려워요.',
      condition: '제한적',
      conditionKey: 'limited',
    },
  }
}
