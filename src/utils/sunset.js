/**
 * 황령산(부산) 기준 일몰 시간 계산
 * 위경도: 35.18°N, 129.08°E (황령산 봉수대)
 */
import SunCalc from 'suncalc'

const HWANGNYEONG_LAT = 35.18
const HWANGNYEONG_LNG = 129.08

/**
 * @param {Date} [date] - 기준일 (기본: 오늘)
 * @returns {{ sunset: Date, sunsetStr: string, sunsetHHMM: string }}
 */
export function getSunsetForDate(date = new Date()) {
  const times = SunCalc.getTimes(date, HWANGNYEONG_LAT, HWANGNYEONG_LNG)
  const sunset = times.sunset
  const h = sunset.getHours()
  const m = sunset.getMinutes()
  const sunsetHHMM = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const sunsetStr = `${h}시 ${m}분`
  return { sunset, sunsetStr, sunsetHHMM }
}

/**
 * 현재 시각과 일몰 비교
 * @returns {'before_sunset' | 'sunset' | 'after_sunset'}
 */
export function getTimeOfDay() {
  const now = new Date()
  const times = SunCalc.getTimes(now, HWANGNYEONG_LAT, HWANGNYEONG_LNG)
  const sunrise = times.sunrise
  const sunset = times.sunset
  const sunsetStart = new Date(sunset)
  sunsetStart.setMinutes(sunsetStart.getMinutes() - 30)
  const sunsetEnd = new Date(sunset)
  sunsetEnd.setMinutes(sunsetEnd.getMinutes() + 30)

  // 자정~일출 전은 야간으로 본다.
  if (now < sunrise) return 'after_sunset'
  if (now < sunsetStart) return 'before_sunset'
  if (now <= sunsetEnd) return 'sunset'
  return 'after_sunset'
}
