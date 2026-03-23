import { useEffect } from 'react'
import { useWeather } from '../contexts/WeatherContext'

/**
 * 일몰 전/일몰/일몰 후에 따라 body에 data-time-of-day를 설정하여 배경 테마 분기
 */
export default function ThemeByTime() {
  const { timeOfDay } = useWeather()

  useEffect(() => {
    const value = timeOfDay || 'after_sunset'
    document.body.dataset.timeOfDay = value
    return () => {
      delete document.body.dataset.timeOfDay
    }
  }, [timeOfDay])

  return null
}
