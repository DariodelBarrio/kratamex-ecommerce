'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  r: number
  opacity: number
  color: string
}

const COLORS = [
  'rgba(52,211,153,',
  'rgba(99,102,241,',
  'rgba(52,211,153,',
  'rgba(16,185,129,',
]

function rnd(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
}

function makeParticles(w: number, h: number, n = 70): Particle[] {
  return Array.from({ length: n }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    vx: (rnd() - 0.5) * 0.42,
    vy: (rnd() - 0.5) * 0.42,
    r: rnd() * 1.6 + 0.4,
    opacity: rnd() * 0.5 + 0.2,
    color: COLORS[Math.floor(rnd() * COLORS.length)],
  }))
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: Particle[] = []
    let animId: number
    let w = 0, h = 0

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect()
      w = canvas.width = rect.width
      h = canvas.height = rect.height
      particles = makeParticles(w, h)
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.opacity})`
        ctx.fill()
      }

      const MAX_DIST = 130
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.18
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(52,211,153,${alpha})`
            ctx.lineWidth = 0.7
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="hero-particles" />
}
