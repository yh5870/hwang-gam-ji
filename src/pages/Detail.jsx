import { useLocation } from 'react-router-dom'
import { useWeather } from '../contexts/WeatherContext'
import './Detail.css'

export default function Detail() {
  const { metrics, analysis, loading, error, updatedAt } = useWeather()
  const { state } = useLocation()
  const fromNav = state?.metrics ?? metrics
  const displayAnalysis = state?.analysis ?? analysis

  if (loading && !fromNav) {
    return (
      <div className="detail-page">
        <p className="loading-text">데이터 불러오는 중...</p>
      </div>
    )
  }

  if (error && !fromNav) {
    return (
      <div className="detail-page">
        <p className="api-error-text">{error}</p>
      </div>
    )
  }

  if (!fromNav || !displayAnalysis) return null

  const m = fromNav
  const d = displayAnalysis.detail

  return (
    <div className="detail-page">
      <h1 className="page-title">상세 지표</h1>
      <p className="updated">최종 업데이트 {state?.updatedAt ?? updatedAt ?? '—'}</p>

      <div className="metrics-grid">
        <div className="metric-card glass primary">
          <span className="metric-label">가시거리</span>
          <span className="metric-value main">{m.visibility_km}</span>
          <span className="metric-unit">km</span>
        </div>

        <div className="metric-card glass">
          <span className="metric-label">초미세먼지</span>
          <span className="metric-value">{m.dust_label ?? m.dust ?? '—'}</span>
          <span className="metric-sub">
            PM2.5 {m.dust_value != null ? `${m.dust_value} ㎍/㎥` : '—'}
            {m.station ? ` (${m.station})` : ''}
          </span>
        </div>

        <div className="metric-card glass">
          <span className="metric-label">습도</span>
          <span className="metric-value">{m.humidity}</span>
          <span className="metric-unit">%</span>
        </div>

        <div className="metric-card glass">
          <span className="metric-label">풍속</span>
          <span className="metric-value">{m.wind_speed ?? '—'}</span>
          <span className="metric-unit">m/s</span>
        </div>

        <div className="metric-card glass">
          <span className="metric-label">기온</span>
          <span className="metric-value">{m.temperature ?? '—'}</span>
          <span className="metric-unit">°C</span>
        </div>

        <div className="metric-card glass">
          <span className="metric-label">하늘</span>
          <span className="metric-value">{m.sky ?? '—'}</span>
        </div>
      </div>

      <section className="analysis-section glass">
        <h2 className="analysis-title">{displayAnalysis.caseName} · {displayAnalysis.score}점</h2>
        <p className="analysis-message">{displayAnalysis.message}</p>

        <div className="analysis-detail">
          {d.clearRange && (
            <div className="detail-row clear">
              <span className="detail-label">선명하게 보이는 구간</span>
              <span className="detail-value">{d.clearRange}</span>
            </div>
          )}
          {d.blurryFrom && (
            <div className="detail-row blurry">
              <span className="detail-label">흐릿해지기 시작하는 곳</span>
              <span className="detail-value">{d.blurryFrom}</span>
            </div>
          )}
          <div className="detail-row reason">
            <span className="detail-label">이유</span>
            <p className="detail-reason">{d.reason}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
