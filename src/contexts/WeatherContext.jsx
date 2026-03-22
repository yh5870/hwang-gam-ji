import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchHwangGamWeather, fetchForecast } from '../services/weatherApi'
import { getHwangGamAnalysis } from '../utils/hwangGamAnalysis'

const WeatherContext = createContext(null)

export function WeatherProvider({ children }) {
  const [metrics, setMetrics] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const apiKey = (import.meta.env.VITE_KMA_API_KEY || '').trim()

  const load = useCallback(async () => {
    if (!apiKey) {
      setError('API 키가 설정되지 않았습니다. .env에 VITE_KMA_API_KEY를 추가하세요.')
      setLoading(false)
      return
    }

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
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  const analysis = metrics ? getHwangGamAnalysis({
    visibility_km: metrics.visibility_km,
    humidity: metrics.humidity,
    dust: metrics.dust,
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
