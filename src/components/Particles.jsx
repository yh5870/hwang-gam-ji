import { useEffect, useRef } from 'react'

export default function Particles({ active }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    const initParticles = () => {
      particles = []
      const count = 100
      for (let i = 0; i < count; i++) {
        particles.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.8,
          y: canvas.height / 2 + (Math.random() - 0.5) * 300,
          vx: (Math.random() - 0.5) * 6,
          vy: -3 - Math.random() * 6,
          size: 2.5 + Math.random() * 5,
          hue: Math.random() * 80 + 260,
          life: 1,
          decay: 0.006 + Math.random() * 0.008,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        if (p.life <= 0) return

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`
        ctx.fill()

        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        p.life -= p.decay
      })

      const alive = particles.filter((p) => p.life > 0).length
      if (alive > 0) {
        animationId = requestAnimationFrame(draw)
      }
    }

    resize()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="particles-canvas"
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
