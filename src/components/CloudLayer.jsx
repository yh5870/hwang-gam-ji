/**
 * 날씨 상태별 구름 레이어 (Canvas)
 * 맑음       → 얇은 구름 2개, 투명하게
 * 구름많음   → 중형 구름 5개
 * 흐림       → 큰 구름 8개, 불투명
 * 비/눈      → 짙은 구름 7개 (어둡게)
 *
 * 낮: 흰색 구름 / 밤·일몰: 회색~어두운 구름
 */
import { useEffect, useRef } from 'react'
import { useWeather } from '../contexts/WeatherContext'

function makeCloud(id, canvasW, canvasH, idx, total) {
  return {
    id,
    x: (canvasW / total) * idx + Math.random() * (canvasW / total),
    y: canvasH * 0.04 + Math.random() * canvasH * 0.3,
    w: 90 + Math.random() * 130,
    h: 38 + Math.random() * 48,
    speed: 0.1 + Math.random() * 0.18,
    opacity: 0.28 + Math.random() * 0.32,
    phase: Math.random() * Math.PI * 2,
  }
}

function drawCloud(ctx, x, y, w, h, opacity, isDay, isDark) {
  ctx.save()
  ctx.globalAlpha = opacity

  // 3D 느낌의 방사 그라디언트
  const gx = x + w * 0.38
  const gy = y - h * 0.12
  const grd = ctx.createRadialGradient(gx, gy, 0, gx, y + h * 0.5, w * 0.65)

  if (isDay) {
    grd.addColorStop(0, 'rgba(255,255,255,0.98)')
    grd.addColorStop(0.5, 'rgba(230,244,255,0.85)')
    grd.addColorStop(1, 'rgba(186,230,253,0.45)')
  } else if (isDark) {
    grd.addColorStop(0, 'rgba(30,41,59,0.85)')
    grd.addColorStop(0.6, 'rgba(15,23,42,0.7)')
    grd.addColorStop(1, 'rgba(2,6,23,0.3)')
  } else {
    // sunset
    grd.addColorStop(0, 'rgba(100,70,50,0.75)')
    grd.addColorStop(0.5, 'rgba(60,30,20,0.55)')
    grd.addColorStop(1, 'rgba(30,10,5,0.2)')
  }

  ctx.fillStyle = grd

  // 구름 형태: 겹치는 원들
  const parts = [
    { dx: 0,       dy: 0,         r: h * 0.52 },
    { dx: w * 0.18, dy: -h * 0.18, r: h * 0.62 },
    { dx: w * 0.38, dy: -h * 0.14, r: h * 0.58 },
    { dx: w * 0.58, dy: -h * 0.08, r: h * 0.50 },
    { dx: w * 0.75, dy: -h * 0.12, r: h * 0.44 },
    { dx: w * 0.90, dy: 0,         r: h * 0.38 },
  ]

  // 클리핑: 구름의 아랫면을 수평으로 자름
  ctx.beginPath()
  ctx.rect(x - w * 0.05, -10000, w * 1.1, y + h * 0.55 + 10000)
  ctx.clip()

  parts.forEach(({ dx, dy, r }) => {
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

export default function CloudLayer() {
  const { timeOfDay, metrics } = useWeather()
  const canvasRef = useRef(null)

  const sky = metrics?.sky ?? ''
  const pty = String(metrics?.pty ?? '0')
  const isRain = ['1', '2', '4', '5', '6', '7'].includes(pty)
  const isDay = timeOfDay === 'before_sunset'
  const isDark = timeOfDay === 'after_sunset'

  const cloudCount =
    isRain ? 7
    : sky === '흐림' ? 8
    : sky === '구름많음' ? 5
    : sky === '맑음' ? 2
    : 3

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animId
    let clouds = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      clouds = Array.from({ length: cloudCount }, (_, i) =>
        makeCloud(i, canvas.width, canvas.height, i, cloudCount)
      )
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const t = Date.now() * 0.001
      clouds.forEach((c) => {
        // 부드러운 상하 흔들림
        const yOffset = Math.sin(t * 0.2 + c.phase) * 4

        c.x += c.speed
        if (c.x - c.w > canvas.width) {
          c.x = -c.w - 20
          c.y = canvas.height * 0.04 + Math.random() * canvas.height * 0.28
        }

        drawCloud(ctx, c.x, c.y + yOffset, c.w, c.h, c.opacity, isDay, isDark)
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
  }, [cloudCount, isDay, isDark])

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
