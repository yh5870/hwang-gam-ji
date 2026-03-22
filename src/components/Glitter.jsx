import { useEffect, useRef } from 'react'

export default function Glitter({ active, enhancedLevel = 0 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let sparkles = []

    const getConfig = () => {
      const baseCount = 22
      const extraPerLevel = { 0: 0, 1: 12, 2: 22, 3: 35 }
      const count = baseCount + (extraPerLevel[enhancedLevel] || 0)
      const baseOpacity = enhancedLevel >= 1 ? 0.4 : 0.28
      const twinkleRange = enhancedLevel >= 1 ? 0.5 : 0.35
      const baseSize = enhancedLevel >= 1 ? 1.4 : 1.0
      const sizeRange = enhancedLevel >= 1 ? 1.4 : 1.0
      return { count, baseOpacity, twinkleRange, baseSize, sizeRange }
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initSparkles()
    }

    const initSparkles = () => {
      sparkles = []
      const { count, baseOpacity, twinkleRange, baseSize, sizeRange } = getConfig()
      const cx = canvas.width / 2
      const cy = canvas.height / 2 - 30
      const colors = ['#fbbf24', '#22d3ee', '#a78bfa', '#fef08a', '#67e8f9']

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8
        const dist = 85 + Math.random() * (enhancedLevel >= 1 ? 120 : 95)
        sparkles.push({
          baseAngle: angle,
          dist,
          size: baseSize + Math.random() * sizeRange,
          color: colors[Math.floor(Math.random() * colors.length)],
          phase: Math.random() * Math.PI * 2,
          speed: 0.015 + Math.random() * 0.025,
          twinkle: twinkleRange + Math.random() * 0.4,
          baseOpacity,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const t = Date.now() * 0.001
      const cx = canvas.width / 2
      const cy = canvas.height / 2 - 30

      sparkles.forEach((s) => {
        const angle = s.baseAngle + t * s.speed + s.phase * 0.5
        const x = cx + Math.cos(angle) * s.dist
        const y = cy + Math.sin(angle) * s.dist
        const opacity = s.baseOpacity + Math.sin(t * 5 + s.phase) * s.twinkle * 0.45
        const size = s.size * (0.85 + Math.sin(t * 6 + s.phase * 2) * 0.25)

        const hex = s.color
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)

        ctx.beginPath()
        ctx.arc(x, y, Math.max(0.6, size), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0.15, opacity)})`
        ctx.fill()
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
  }, [active, enhancedLevel])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="glitter-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
