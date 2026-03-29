import { useWeather } from '../contexts/WeatherContext'
import './Forecast.css'

function buildCompareLine(forecast) {
  if (!forecast?.length) return null
  const nowScore = forecast[0]?.score
  const nextSlots = forecast.slice(1, 4)
  const scores = nextSlots.map((h) => h.score).filter((s) => typeof s === 'number')
  const avgNext = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const parts = []
  if (typeof nowScore === 'number') {
    parts.push(`지금 ${nowScore.toLocaleString()}점(홈과 동일)`)
  }
  if (avgNext != null) {
    parts.push(`이후 3시간 평균 ${avgNext.toLocaleString()}점(습도·하늘 예보만)`)
  } else if (forecast.length === 1) {
    parts.push('이후 구간 예보가 짧아 비교는 생략했습니다.')
  }

  let hint = ''
  if (avgNext != null && typeof nowScore === 'number') {
    const d = nowScore - avgNext
    if (d > 8) hint = '지금이 예보상 조금 더 나은 편이에요.'
    else if (d < -8) hint = '이후 몇 시간이 예보상 조금 더 나을 수 있어요. (가시거리·먼지는 지금 시각 값만 반영)'
    else hint = '지금과 비슷한 흐름이에요.'
  }

  const line = parts.join(' · ')
  if (!line) return null
  return { line, hint }
}

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

  const compare = buildCompareLine(forecast)

  return (
    <div className="forecast-page">
      <h1 className="page-title">24시간 예측</h1>
      <p className="forecast-note">
        첫 줄 &quot;지금&quot;은 홈 점수와 같은 기준입니다. 그 아래는 습도·하늘 예보만으로 추정한 점수예요. 가시거리 실측은 현재 시각 칸에만 반영됩니다.
      </p>
      {compare && (
        <p className="forecast-compare" role="status">
          <span className="forecast-compare-line">{compare.line}</span>
          {compare.hint && <span className="forecast-compare-hint">{compare.hint}</span>}
        </p>
      )}

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
