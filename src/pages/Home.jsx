import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWeather } from '../contexts/WeatherContext'
import Particles from '../components/Particles'
import Glitter from '../components/Glitter'
import DaySky from '../components/DaySky'
import './Home.css'

function formatTime() {
  const now = new Date()
  return now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function Home() {
  const navigate = useNavigate()
  const { metrics, analysis, loading, error, updatedAt, refresh, sunsetHHMM, timeOfDay } = useWeather()

  const visBasis =
    metrics?.visibility_source === 'observed_refined'
      ? `가시거리 24km 이상 확인 · 습도·하늘·먼지 예보로 ${metrics.visibility_km}km 추정.`
      : metrics?.visibility_source === 'observed'
        ? `가시거리 ${metrics.visibility_observed_km}km 실측을 반영했습니다.`
        : metrics?.visibility_source === 'estimated'
          ? '가시거리는 실측 부재 시 예보 기반 추정값을 썼습니다.'
          : ''
  const scoreBasisText = metrics
    ? `${visBasis ? `${visBasis} ` : ''}습도·미세먼지·하늘·일몰을 함께 반영한 종합 점수입니다.`
    : ''

  const [state, setState] = useState('initial')
  const [displayScore, setDisplayScore] = useState(0)
  const [currentTime, setCurrentTime] = useState(formatTime())

  const targetScore = analysis?.score ?? 0
  const maxScore = targetScore >= 10000 ? 10000 : targetScore >= 1000 ? 1000 : 100
  const isJackpot10k = analysis?.isJackpot && analysis.jackpotLevel === 2
  const isJackpot1k = analysis?.isJackpot && analysis.jackpotLevel === 1
  const showGlitter = state !== 'initial'
  const enhancedGlitterLevel =
    maxScore === 100 && displayScore >= 80
      ? displayScore >= 100
        ? 3
        : displayScore >= 90
          ? 2
          : 1
      : 0

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(formatTime()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (state !== 'success') return

    const duration = 1500
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(easeOut * targetScore))

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayScore(targetScore)
        if (isJackpot10k) setState('jackpot')
      }
    }
    requestAnimationFrame(step)
  }, [state, targetScore, isJackpot10k])

  useEffect(() => {
    if (analysis && !loading) {
      setState('initial')
      setDisplayScore(0)
      const t = setTimeout(() => setState('success'), 400)
      return () => clearTimeout(t)
    }
  }, [analysis?.score, loading])

  const handleScoreClick = () => {
    navigate('/detail')
  }

  if (!analysis && (loading || error)) {
    return (
      <div className="home">
        <div className="home-content">
          {loading ? (
            <div className="skeleton">
              <div className="skeleton-countdown" />
              <div className="skeleton-gauge" />
              <p className="loading-text">기상청 데이터를 불러오는 중...</p>
            </div>
          ) : (
            <div className="api-error">
              <p>{error}</p>
              <button type="button" className="btn glass" onClick={refresh}>
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const isBright = timeOfDay === 'before_sunset'

  return (
    <div className={`home ${state === 'jackpot' ? 'jackpot' : isJackpot1k ? 'jackpot-1k' : ''} ${enhancedGlitterLevel >= 1 ? 'glitter-active' : ''} ${isBright ? 'day' : ''}`}>
      <DaySky />
      <Particles active={state === 'jackpot'} />
      <Glitter active={showGlitter && !isBright} enhancedLevel={enhancedGlitterLevel} />

      <div className="home-content">
        {state === 'initial' ? (
          <div className="skeleton">
            <div className="skeleton-countdown" />
            <div className="skeleton-gauge" />
            <div className="skeleton-message" />
          </div>
        ) : (
          <>
            <header className="home-header">
              <h1 className="logo">황감지</h1>
              <div className="header-right">
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="데이터 새로고침"
                >
                  ↻
                </button>
                <span className="current-time">{currentTime}</span>
              </div>
            </header>

            <section className="gauge-section">
              <div
                className={`score-wrapper ${isJackpot10k ? 'jackpot' : isJackpot1k ? 'jackpot-1k' : ''}`}
                style={{ '--progress': displayScore / maxScore }}
                onClick={handleScoreClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleScoreClick()}
                aria-label="상세 보기로 이동"
              >
                <div className="score-glow">
                  {isJackpot10k && <div className="score-ring" aria-hidden />}
                  <div className="score-inner">
                    <span className="score-value">{displayScore.toLocaleString()}</span>
                    <span className="score-label">점</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="description-box" aria-label="점수 안내">
              {analysis?.isJackpot && (
                <div className={`jackpot-badge ${isJackpot10k ? 'rainbow' : 'gold'}`}>
                  잭팟 발생
                </div>
              )}
              <p className="main-message">{analysis?.message}</p>
              {scoreBasisText && (
                <p className="score-basis">{scoreBasisText}</p>
              )}
              {sunsetHHMM && (
                <p className="sunset-info">오늘 일몰 {sunsetHHMM}</p>
              )}
            </section>

            <nav className="quick-nav">
              <Link
                to="/detail"
                className="btn glass"
                state={{ metrics, analysis, updatedAt, sunsetHHMM }}
              >
                상세보기
              </Link>
              <Link to="/forecast" className="btn glass">
                예측
              </Link>
            </nav>
          </>
        )}
      </div>
    </div>
  )
}
