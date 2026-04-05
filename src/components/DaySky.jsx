/**
 * 낮 시간대 전용 배경 효과
 * - 황금빛 반짝이(sparkle) 천천히 위로 떠오름
 * - 태양 shimmer: 상단 중앙 방사형 빛 번짐
 * - 맑음(sky=맑음) 시 더 풍부하게, 흐림 시 약하게
 */
import { useEffect, useRef } from 'react'
import { useWeather } from '../contexts/WeatherContext'

export default function DaySky() {
  const { timeOfDay, metrics } = useWeather()
  const canvasRef = useRef(null)

  const active = timeOfDay === 'before_sunset'
  const sky = metrics?.sky
  const isClear = sky === '맑음'
  const isCloudy = sky === '구름많음' || sky === '흐림'

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animId
    let sparkles = []
    let sunPhase = 0

    const count = isClear ? 28 : isCloudy ? 10 : 18

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initSparkles()
    }

    const initSparkles = () => {
      sparkles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height * 0.2 + Math.random() * canvas.height * 0.75,
        vy: -(0.35 + Math.random() * 0.65),
        vx: 0,
        size: 1.5 + Math.random() * 2.8,
        life: Math.floor(Math.random() * 200),
        maxLife: 140 + Math.random() * 200,
        maxOpacity: isClear
          ? 0.35 + Math.random() * 0.35
          : 0.15 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        color: pickColor(),
      }))
    }

    function pickColor() {
      const palette = isClear
        ? ['#fbbf24', '#fde68a', '#f59e0b', '#67e8f9', '#fbbf24']
        : ['#bae6fd', '#e0f2fe', '#7dd3fc']
      return palette[Math.floor(Math.random() * palette.length)]
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      sunPhase += 0.008

      // ── 태양 shimmer (상단 중앙) ─────────────────────────────────────
      if (isClear) {
        const cx = canvas.width * 0.5
        const cy = 0
        const r = canvas.width * 0.55
        const shimmerAlpha = 0.04 + Math.sin(sunPhase) * 0.02
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `rgba(255, 245, 180, ${shimmerAlpha + 0.03})`)
        grad.addColorStop(0.4, `rgba(254, 215, 100, ${shimmerAlpha})`)
        grad.addColorStop(1, 'rgba(254, 215, 100, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // ── 황금 반짝이 ────────────────────────────────────────────────
      sparkles.forEach((s) => {
        s.life++
        s.y += s.vy
        s.x += Math.sin(s.life * 0.04 + s.phase) * 0.4

        const t = s.life / s.maxLife
        let opacity
        if (t < 0.18) opacity = (t / 0.18) * s.maxOpacity
        else if (t > 0.78) opacity = ((1 - t) / 0.22) * s.maxOpacity
        else opacity = s.maxOpacity

        if (s.life >= s.maxLife || s.y < -10) {
          s.x = Math.random() * canvas.width
          s.y = canvas.height * 0.65 + Math.random() * canvas.height * 0.4
          s.life = 0
          s.maxLife = 140 + Math.random() * 200
          s.maxOpacity = isClear
            ? 0.35 + Math.random() * 0.35
            : 0.15 + Math.random() * 0.2
          s.phase = Math.random() * Math.PI * 2
          s.color = pickColor()
          s.size = 1.5 + Math.random() * 2.8
        }

        if (opacity <= 0) return

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.shadowColor = s.color
        ctx.shadowBlur = s.size * 4
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, Math.max(0.4, s.size * 0.55), 0, Math.PI * 2)
        ctx.fill()

        // 십자 반짝임 (+)
        if (s.size > 2.5 && opacity > 0.3) {
          const arm = s.size * 2.2
          ctx.globalAlpha = opacity * 0.45
          ctx.fillRect(s.x - arm, s.y - 0.5, arm * 2, 1)
          ctx.fillRect(s.x - 0.5, s.y - arm, 1, arm * 2)
        }

        ctx.restore()
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
  }, [active, isClear, isCloudy])

  if (!active) return null

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
