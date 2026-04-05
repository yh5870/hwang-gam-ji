import { useLocation } from 'react-router-dom'
import { useWeather } from '../contexts/WeatherContext'
import './Detail.css'

function formatObservedAt(tm) {
  if (!tm) return ''
  const m = tm.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2})(?::(\d{2}))?/)
  if (!m) return tm
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}시 관측`
}

function getClothingRecommendation({ temperature, wind_speed, pty }) {
  const temp = temperature != null ? Number(temperature) : null
  const wind = wind_speed != null ? Number(wind_speed) : null
  const isRain = pty && ['1', '2', '4', '5', '6', '7'].includes(String(pty))
  const isSnow = pty === '3'

  if (temp == null || Number.isNaN(temp)) {
    return '기온 정보가 없어 옷차림 추천이 어렵습니다.'
  }

  const windTip = wind != null && wind >= 5 ? ' 바람 불면 바람막이 추천해요.' : ''
  const rainTip = isRain ? ' 우산·우비 챙기세요.' : ''
  const snowTip = isSnow ? ' 방한·미끄럼 주의하세요.' : ''

  if (temp >= 25) {
    return `추천: 반팔·반바지, 썬크림.${windTip}${rainTip}`
  }
  if (temp >= 20) {
    return `추천: 긴팔 가볍게, 얇은 자켓 준비.${windTip}${rainTip}`
  }
  if (temp >= 15) {
    return `추천: 긴팔 + 가벼운 겉옷. 황령산은 바닷바람 있어요.${windTip}${rainTip}`
  }
  if (temp >= 10) {
    return `추천: 니트·자켓. 산 위는 더 추울 수 있어요.${windTip}${rainTip}${snowTip}`
  }
  if (temp >= 5) {
    return `추천: 코트·패딩. 체감온도 낮을 수 있어요.${windTip}${rainTip}${snowTip}`
  }
  return `추천: 두꺼운 패딩·내복. 꽁꽁 얼어요!${windTip}${rainTip}${snowTip}`
}

export default function Detail() {
  const { metrics, analysis, loading, error, updatedAt, sunsetHHMM } = useWeather()
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
      <p className="updated">
        최종 업데이트 {state?.updatedAt ?? updatedAt ?? '—'}
        {(state?.sunsetHHMM ?? sunsetHHMM) && (
          <span className="sunset-badge"> · 오늘 일몰 {state?.sunsetHHMM ?? sunsetHHMM}</span>
        )}
      </p>

      <div className="metrics-grid">
        <div className="metric-card glass primary">
          <span className="metric-label">가시거리</span>
          <span className="metric-value main">
            {m.visibility_at_cap ? '24+' : m.visibility_km}
          </span>
          <span className="metric-unit">km</span>
          <span className="metric-sub metric-source">
            <>
              {m.visibility_observed_km != null ? (
                <>
                  {m.visibility_at_cap
                    ? `Open-Meteo 24km+ 확인 · 예보 보정값`
                    : `실측 ${m.visibility_observed_km}km · ${m.visibility_station || 'Open-Meteo'}`}
                  {m.visibility_observed_at && !m.visibility_at_cap
                    ? ` · ${formatObservedAt(m.visibility_observed_at)}`
                    : ''}
                </>
              ) : (
                <>실측값 없음</>
              )}
              {m.visibility_estimated_km != null && (
                <>
                  <br />
                  추정 {m.visibility_estimated_km}km · {m.fcst_at || '현재 시간대 예보'} (습도·하늘·먼지 반영)
                </>
              )}
            </>
          </span>
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
          {m.fcst_at && <span className="metric-sub metric-source">{m.fcst_at}</span>}
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
          {m.fcst_at && <span className="metric-sub metric-source">{m.fcst_at}</span>}
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

        <p className="clothing-tip">{getClothingRecommendation(m)}</p>
      </section>
    </div>
  )
}
