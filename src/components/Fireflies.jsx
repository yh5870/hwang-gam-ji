import { useEffect, useRef } from 'react'
import { useWeather } from '../contexts/WeatherContext'

/**
 * 야경·반딧불이 느낌의 움직이는 빛
 * 일몰 전: 숨김, 일몰 시간: 따뜻한 색, 일몰 후: 기존 청록/보라
 */
export default function Fireflies() {
  const canvasRef = useRef(null)
  const { timeOfDay } = useWeather()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let fireflies = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initFireflies()
    }

    const initFireflies = () => {
      fireflies = []
      const count = Math.min(35, Math.floor((canvas.width * canvas.height) / 35000))
      const palette = timeOfDay === 'sunset'
        ? ['rgba(251, 146, 60, 0.65)', 'rgba(251, 191, 36, 0.6)', 'rgba(253, 230, 138, 0.5)', 'rgba(234, 88, 12, 0.55)']
        : ['rgba(34, 211, 238, 0.7)', 'rgba(167, 139, 250, 0.6)', 'rgba(241, 245, 249, 0.5)', 'rgba(103, 232, 249, 0.55)']
      for (let i = 0; i < count; i++) {
        fireflies.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.3 - 0.1,
          size: 1 + Math.random() * 2,
          color: palette[Math.floor(Math.random() * palette.length)],
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 2 + Math.random() * 3,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const t = Date.now() * 0.001

      fireflies.forEach((f) => {
        const twinkle = 0.35 + Math.sin(t * f.twinkleSpeed + f.phase) * 0.35
        const alpha = Math.max(0.15, twinkle)
        const baseColor = f.color.replace(/[\d.]+\)$/, `${alpha})`)
        const size = f.size * (0.8 + twinkle * 0.5)

        // 글로우 + 코어
        const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, size * 4)
        gradient.addColorStop(0, baseColor)
        gradient.addColorStop(0.4, baseColor.replace(/[\d.]+\)$/, `${alpha * 0.4})`))
        gradient.addColorStop(1, 'transparent')

        ctx.beginPath()
        ctx.arc(f.x, f.y, size * 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        ctx.beginPath()
        ctx.arc(f.x, f.y, Math.max(0.5, size), 0, Math.PI * 2)
        ctx.fillStyle = baseColor
        ctx.fill()

        f.x += f.vx
        f.y += f.vy
        if (f.x < 0 || f.x > canvas.width) f.vx *= -1
        if (f.y < 0 || f.y > canvas.height) f.vy *= -1
        f.x = Math.max(0, Math.min(canvas.width, f.x))
        f.y = Math.max(0, Math.min(canvas.height, f.y))
      })

      animationId = requestAnimationFrame(draw)
    }

    resize()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [timeOfDay])

  return (
    <canvas
      ref={canvasRef}
      className="fireflies-canvas"
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
