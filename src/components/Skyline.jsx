/**
 * 부산 스카이라인 실루엣
 * 광안대교 케이블 타워, 마린시티, LCT 쌍둥이 타워를 포함한 야경 실루엣
 * - 낮: 하늘색 반투명 실루엣
 * - 일몰: 어두운 보라 실루엣
 * - 밤: 짙은 네이비 + 창문 불빛
 */
import { useMemo } from 'react'
import { useWeather } from '../contexts/WeatherContext'

const W = 1440
const H = 200

/** 창문 위치: SVG 좌표 기준 (1440×200) */
function buildWindows() {
  const wins = []
  // LCT 타워1 (x 357-373, y 8-165)
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 4; col++) {
      wins.push({ x: 359 + col * 4, y: 12 + row * 8, warm: (row + col) % 3 !== 0 })
    }
  }
  // LCT 타워2 (x 380-394, y 12-162)
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 3; col++) {
      wins.push({ x: 382 + col * 4, y: 16 + row * 8, warm: (row + col) % 4 !== 1 })
    }
  }
  // 마린시티 고층 (x 292-348, y 22-65)
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 9; col++) {
      wins.push({ x: 293 + col * 7, y: 24 + row * 7, warm: col % 3 !== 2 })
    }
  }
  // 일반 고층 (x 200-285, y 45-120)
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 7; col++) {
      wins.push({ x: 205 + col * 12, y: 50 + row * 8, warm: (row * col) % 5 !== 0 })
    }
  }
  return wins
}

const WINDOWS = buildWindows()

/** 시간대별 색상 */
function getColors(timeOfDay) {
  if (timeOfDay === 'before_sunset') {
    return {
      mountain: 'rgba(125,211,252,0.18)',
      buildings: 'rgba(56,189,248,0.28)',
      showWindows: false,
    }
  }
  if (timeOfDay === 'sunset') {
    return {
      mountain: 'rgba(30,27,75,0.45)',
      buildings: 'rgba(20,17,50,0.72)',
      showWindows: false,
    }
  }
  // after_sunset (night)
  return {
    mountain: 'rgba(10,14,30,0.60)',
    buildings: 'rgba(8,12,28,0.92)',
    showWindows: true,
  }
}

export default function Skyline() {
  const { timeOfDay } = useWeather()
  const colors = getColors(timeOfDay)

  /* 창문 SVG circles — 메모이제이션으로 리렌더 방지 */
  const windowDots = useMemo(() => WINDOWS.map((w, i) => (
    <circle
      key={i}
      cx={w.x}
      cy={w.y}
      r={1.4}
      fill={w.warm ? '#fde68a' : '#93c5fd'}
      style={{
        animation: `win-blink ${2.5 + (i % 9) * 0.4}s ${(i * 0.29) % 6}s infinite`,
      }}
    />
  )), [])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '140px',
        pointerEvents: 'none',
        zIndex: 0,
        transition: 'opacity 1.2s ease',
      }}
    >
      {/* ── 산 / 구릉 레이어 (뒤) ── */}
      <path
        fill={colors.mountain}
        d={`M0,${H} L0,132 Q180,108 360,118 Q540,128 720,115 Q900,102 1080,112 Q1260,122 1440,116 L1440,${H} Z`}
      />

      {/* ── 빌딩 실루엣 레이어 (앞) ── */}
      <path
        fill={colors.buildings}
        d={[
          `M0,${H}`,
          // 좌측 저층부
          'L0,158 L12,158 L12,148 L20,148 L20,138 L28,138 L28,148 L36,148 L36,136',
          'L44,136 L44,124 L52,124 L52,136 L60,136 L60,126 L68,126 L68,114 L76,114',
          // 광안대교 케이블 타워 구간
          'L76,165 L84,165 L84,80 L88,80 L88,75 L93,75 L93,165',
          'L100,165 Q112,150 124,148 Q136,146 148,148 L148,165',
          'L155,165 L155,78 L159,78 L159,72 L164,72 L164,165',
          // 교량 이후 중층 빌딩
          'L170,158 L178,158 L178,142 L186,142 L186,128 L194,128 L194,118 L202,118',
          'L202,128 L210,128 L210,115 L218,115 L218,128 L226,128 L226,138 L234,138',
          'L234,122 L242,122 L242,108 L250,108 L250,118 L258,118 L258,128 L266,128',
          // 마린시티 고층 클러스터
          'L270,165 L275,165 L275,58 L280,58 L280,42 L284,42 L284,28 L288,28',
          'L288,18 L291,18 L291,28 L295,28 L295,42 L299,42 L299,58 L302,58',
          'L302,42 L306,42 L306,28 L310,28 L310,16 L314,16 L314,28 L318,28',
          'L318,42 L321,42 L321,60 L325,60 L325,44 L329,44 L329,32 L332,32',
          'L332,22 L336,22 L336,32 L340,32 L340,44 L344,44 L344,62',
          // LCT 쌍둥이 타워 (최고층)
          'L348,165 L355,165 L355,6 L360,6 L360,3 L365,3 L365,8 L370,8 L370,162',
          'L376,162 L376,8 L381,8 L381,4 L386,4 L386,9 L391,9 L391,162',
          // 우측 하강
          'L396,162 L400,155 L408,155 L408,140 L416,140 L416,128 L424,128 L424,140',
          'L432,140 L432,152 L445,152 L445,138 L458,138 L458,148 L472,148 L472,158',
          'L490,158 L510,162 L560,165 L640,168 L720,170 L900,170 L1100,168',
          'L1300,165 L1440,162',
          `L1440,${H} Z`,
        ].join(' ')}
      />

      {/* ── 밤 창문 불빛 ── */}
      {colors.showWindows && windowDots}
    </svg>
  )
}
