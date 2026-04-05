/**
 * 일몰 → 밤 전환 시 오로라 스윕 연출 (one-shot)
 * timeOfDay가 'sunset' 또는 'before_sunset'에서 'after_sunset'으로 바뀌는 순간 발동
 * 보라·청록·남색 사선 띠가 화면을 가로질러 지나감 (2.8초)
 */
import { useEffect, useRef, useState } from 'react'
import { useWeather } from '../contexts/WeatherContext'

export default function AuroraSweep() {
  const { timeOfDay } = useWeather()
  const prevRef = useRef(timeOfDay)
  // ── 테스트용: 마운트 즉시 발동 ──
  const [active, setActive] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setActive(false), 3200)
    return () => clearTimeout(t)
  }, [])

  // eslint-disable-next-line no-unused-vars
  const _prevRef = prevRef   // 원래 로직 참조 보존

  if (!active) return null

  return (
    <div
      aria-hidden="true"
      className="aurora-sweep-overlay"
    >
      <div className="aurora-sweep-bands" />
    </div>
  )
}
