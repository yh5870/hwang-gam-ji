import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchHwangGamWeather, fetchForecast } from '../services/weatherApi'
import { getHwangGamAnalysis } from '../utils/hwangGamAnalysis'
import { getSunsetForDate, getTimeOfDay } from '../utils/sunset'

const WeatherContext = createContext(null)

export function WeatherProvider({ children }) {
  const { sunsetStr, sunsetHHMM } = getSunsetForDate()
  const [timeOfDay, setTimeOfDay] = useState(() => getTimeOfDay())

  useEffect(() => {
    const tick = () => setTimeOfDay(getTimeOfDay())
    const id = setInterval(tick, 60 * 1000)
    return () => clearInterval(id)
  }, [])
  const [metrics, setMetrics] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // Optional: In production on Vercel, API key can live server-side as KMA_API_KEY.
  // Keeping VITE_KMA_API_KEY still supports local dev without serverless functions.
  const apiKey = (import.meta.env.VITE_KMA_API_KEY || '').trim()

  const load = useCallback(async () => {
    // If apiKey is empty, the /api proxy may still inject KMA_API_KEY server-side (production).

    setLoading(true)
    setError(null)
    try {
      const [weatherData, forecastData] = await Promise.all([
        fetchHwangGamWeather(apiKey),
        fetchForecast(apiKey),
      ])
      setMetrics(weatherData)
      const analysisForNow = getHwangGamAnalysis({
        visibility_km: weatherData.visibility_km,
        humidity: weatherData.humidity,
        dust: weatherData.dust,
        sky: weatherData.sky,
        sunsetStr,
        sunsetHHMM,
        timeOfDay,
      })
      if (forecastData?.length && analysisForNow) {
        forecastData[0].score = analysisForNow.score
        forecastData[0].visibility_km = weatherData.visibility_km
      }
      setForecast(forecastData)
      setUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }))
    } catch (err) {
      setError(err?.message || '데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [apiKey, sunsetStr, sunsetHHMM, timeOfDay])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!apiKey) return
    // KMA updates are hourly-ish; poll often enough to catch new data.
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [apiKey, load])

  const analysis = metrics ? getHwangGamAnalysis({
    visibility_km: metrics.visibility_km,
    humidity: metrics.humidity,
    dust: metrics.dust,
    sky: metrics.sky,
    sunsetStr,
    sunsetHHMM,
    timeOfDay,
  }) : null

  return (
    <WeatherContext.Provider value={{
      metrics,
      forecast,
      analysis,
      loading,
      error,
      updatedAt,
      refresh: load,
      hasApiKey: !!apiKey,
      sunsetStr,
      sunsetHHMM,
      timeOfDay,
    }}>
      {children}
    </WeatherContext.Provider>
  )
}

export function useWeather() {
  const ctx = useContext(WeatherContext)
  if (!ctx) throw new Error('useWeather must be used within WeatherProvider')
  return ctx
}
