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
  const [active, setActive] = useState(false)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = timeOfDay

    if (prev !== 'after_sunset' && timeOfDay === 'after_sunset') {
      setActive(true)
      const t = setTimeout(() => setActive(false), 3200)
      return () => clearTimeout(t)
    }
  }, [timeOfDay])

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
