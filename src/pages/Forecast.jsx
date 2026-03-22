import { useWeather } from '../contexts/WeatherContext'
import './Forecast.css'

export default function Forecast() {
  const { forecast, loading, error } = useWeather()

  if (loading) {
    return (
      <div className="forecast-page">
        <h1 className="page-title">24시간 예측</h1>
        <p className="loading-text">데이터 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="forecast-page">
        <h1 className="page-title">24시간 예측</h1>
        <p className="api-error-text">{error}</p>
      </div>
    )
  }

  if (!forecast?.length) {
    return (
      <div className="forecast-page">
        <h1 className="page-title">24시간 예측</h1>
        <p className="loading-text">예보 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="forecast-page">
      <h1 className="page-title">24시간 예측</h1>
      <p className="forecast-note">습도·하늘 예보 기반 예상 점수 (가시거리 실측은 현재 시각만 적용)</p>

      <div className="forecast-list">
        {forecast.map((h, i) => (
          <div key={i} className="forecast-item glass">
            <div className="forecast-time">
              <span className="hour">{h.hour}</span>
              {h.label && <span className="badge">{h.label}</span>}
            </div>
            <div className="forecast-score">
              <span className="score">{h.score.toLocaleString()}</span>
              <span className="unit">점</span>
            </div>
            <div className="forecast-visibility">
              {h.visibility_km != null ? `가시거리 ${h.visibility_km} km` : '예상'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
