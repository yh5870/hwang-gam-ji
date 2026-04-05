/**
 * 날씨 상태별 구름 레이어 (Canvas)
 * 맑음     → 얇은 권운형 구름 2개
 * 구름많음 → 중형 적운 4개
 * 흐림     → 큰 층운 6개, 화면 가득
 * 비/눈    → 짙은 난층운 5개
 *
 * 낮: 흰 뭉게구름 / 일몰: 주황빛 / 밤: 짙은 남색
 */
import { useEffect, useRef } from 'react'
import { useWeather } from '../contexts/WeatherContext'

/* ─── 구름 데이터 생성 ─────────────────────────────── */
function makeCloud(idx, total, canvasW, canvasH, sky, isRain) {
  // 구름이 넓고 화면을 꽉 채우도록 화면 너비 기준으로 배치
  const baseW = canvasW * (isRain || sky === '흐림' ? 0.55 : sky === '구름많음' ? 0.45 : 0.38)
  const spread = idx / Math.max(1, total - 1)

  return {
    // 처음엔 화면 전체에 고르게 분포
    x: spread * (canvasW + baseW) - baseW * 0.3,
    // 화면 상단 10~40% 구간에 위치
    y: canvasH * (0.06 + Math.random() * 0.28),
    w: baseW * (0.75 + Math.random() * 0.5),
    h: 0,             // drawCloud 시 w 기반으로 계산
    speed: 0.08 + Math.random() * 0.14,
    opacity: isRain ? 0.55 + Math.random() * 0.2
           : sky === '흐림' ? 0.5 + Math.random() * 0.2
           : sky === '구름많음' ? 0.38 + Math.random() * 0.2
           : 0.28 + Math.random() * 0.18,
    phase: Math.random() * Math.PI * 2,
    // 구름마다 약간 다른 종횡비
    aspect: 0.32 + Math.random() * 0.18,
    // 구름 형태 변형용 시드
    seed: Math.random(),
  }
}

/* ─── 구름 그리기 ──────────────────────────────────── */
function drawCloud(ctx, x, y, w, aspect, opacity, isDay, isDark, seed) {
  const h = w * aspect
  ctx.save()

  // ── 아랫면 그림자 (실제 구름처럼 아랫부분이 약간 어두움) ──
  if (isDay) {
    const shadowGrd = ctx.createLinearGradient(x, y, x, y + h * 0.6)
    shadowGrd.addColorStop(0, 'rgba(200,220,255,0)')
    shadowGrd.addColorStop(1, 'rgba(160,195,230,0.18)')
    ctx.fillStyle = shadowGrd
    ctx.beginPath()
    ctx.ellipse(x + w * 0.5, y + h * 0.4, w * 0.52, h * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── 구름 형태 결정 (seed 기반으로 고정된 덩어리 배치) ──
  const bumps = [
    // 주 몸통
    { dx: w * 0.08,  dy: h * 0.22,  rx: w * 0.24, ry: h * 0.52 },
    { dx: w * 0.22,  dy: h * 0.04,  rx: w * 0.30, ry: h * 0.62 },
    { dx: w * 0.40,  dy: h * 0.00,  rx: w * 0.32, ry: h * 0.68 },  // 정상
    { dx: w * 0.58,  dy: h * 0.06,  rx: w * 0.28, ry: h * 0.62 },
    { dx: w * 0.74,  dy: h * 0.16,  rx: w * 0.25, ry: h * 0.54 },
    { dx: w * 0.88,  dy: h * 0.26,  rx: w * 0.18, ry: h * 0.44 },
    // 보조 작은 덩어리 (구름마다 다름)
    { dx: w * (0.30 + seed * 0.18), dy: h * (-0.12 - seed * 0.1), rx: w * 0.16, ry: h * 0.30 },
    { dx: w * (0.52 + seed * 0.12), dy: h * (-0.08 - seed * 0.14), rx: w * 0.14, ry: h * 0.26 },
  ]

  // ── 메인 그라디언트 (상단 밝음 → 하단 약간 어두움) ──
  const topY = y + bumps[2].dy          // 가장 높은 지점
  const botY = y + h * 0.7
  const mainGrd = ctx.createLinearGradient(x + w * 0.5, topY, x + w * 0.5, botY)

  if (isDay) {
    mainGrd.addColorStop(0,   'rgba(255,255,255,1.0)')
    mainGrd.addColorStop(0.35,'rgba(248,252,255,0.97)')
    mainGrd.addColorStop(0.7, 'rgba(220,238,255,0.88)')
    mainGrd.addColorStop(1,   'rgba(190,218,248,0.70)')
  } else if (isDark) {
    mainGrd.addColorStop(0,   'rgba(40,52,74,0.88)')
    mainGrd.addColorStop(0.5, 'rgba(22,35,55,0.80)')
    mainGrd.addColorStop(1,   'rgba(8,15,30,0.55)')
  } else {
    // sunset
    mainGrd.addColorStop(0,   'rgba(255,210,140,0.82)')
    mainGrd.addColorStop(0.4, 'rgba(220,130,80,0.72)')
    mainGrd.addColorStop(1,   'rgba(120,50,30,0.45)')
  }

  ctx.fillStyle = mainGrd
  ctx.globalAlpha = opacity

  // 아랫면 클리핑 (구름 바닥이 평평하게)
  ctx.beginPath()
  ctx.rect(x - 10, -99999, w + 20, y + h * 0.48 + 99999)
  ctx.clip()

  // 각 덩어리를 타원으로 그리기
  bumps.forEach(({ dx, dy, rx, ry }) => {
    ctx.beginPath()
    ctx.ellipse(x + dx, y + dy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

/* ─── 컴포넌트 ─────────────────────────────────────── */
export default function CloudLayer() {
  const { timeOfDay, metrics } = useWeather()
  const canvasRef = useRef(null)

  const sky  = metrics?.sky ?? ''
  const pty  = String(metrics?.pty ?? '0')
  const isRain = ['1', '2', '4', '5', '6', '7'].includes(pty)
  const isDay  = timeOfDay === 'before_sunset'
  const isDark = timeOfDay === 'after_sunset'

  const cloudCount =
    isRain            ? 5
    : sky === '흐림'    ? 6
    : sky === '구름많음' ? 4
    : sky === '맑음'    ? 2
    : 3

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animId
    let clouds = []

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      clouds = Array.from({ length: cloudCount }, (_, i) =>
        makeCloud(i, cloudCount, canvas.width, canvas.height, sky, isRain)
      )
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const t = Date.now() * 0.001
      clouds.forEach((c) => {
        // 부드럽고 느린 상하 흔들림
        const yOff = Math.sin(t * 0.12 + c.phase) * 7

        c.x += c.speed
        // 화면 오른쪽 밖으로 나가면 왼쪽 끝에서 다시 등장
        if (c.x > canvas.width + c.w) {
          c.x = -c.w * 1.1
          c.y = canvas.height * (0.06 + Math.random() * 0.26)
        }

        drawCloud(
          ctx,
          c.x, c.y + yOff,
          c.w, c.aspect,
          c.opacity,
          isDay, isDark,
          c.seed,
        )
      })

      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animId)
    }
  }, [cloudCount, isDay, isDark, sky, isRain])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
