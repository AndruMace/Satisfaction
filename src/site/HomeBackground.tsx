import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

const COLORS = [
  'rgba(59, 139, 255, 0.72)',
  'rgba(255, 59, 59, 0.68)',
  'rgba(126, 240, 216, 0.65)',
  'rgba(255, 176, 32, 0.62)',
  'rgba(167, 139, 250, 0.68)',
  'rgba(255, 140, 200, 0.62)',
]

function createParticles(width: number, height: number): Particle[] {
  const area = width * height
  const count = Math.min(48, Math.max(18, Math.round(area / 28000)))
  const particles: Particle[] = []

  for (let i = 0; i < count; i += 1) {
    const radius = 4 + Math.random() * 10
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      radius,
      color: COLORS[i % COLORS.length]!,
    })
  }

  return particles
}

function drawStaticFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
) {
  ctx.clearRect(0, 0, width, height)
  for (const particle of particles) {
    ctx.beginPath()
    ctx.fillStyle = particle.color
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function HomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pointer = { x: -9999, y: -9999, active: false }
    let particles: Particle[] = []
    let width = 0
    let height = 0
    let dpr = 1
    let frameId = 0
    let running = true

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (particles.length === 0) {
        particles = createParticles(width, height)
      } else {
        for (const particle of particles) {
          particle.x = Math.min(Math.max(particle.radius, particle.x), width - particle.radius)
          particle.y = Math.min(Math.max(particle.radius, particle.y), height - particle.radius)
        }
      }

      if (prefersReducedMotion.matches) {
        drawStaticFrame(ctx, width, height, particles)
      }
    }

    const step = () => {
      if (!running) return

      if (prefersReducedMotion.matches) {
        drawStaticFrame(ctx, width, height, particles)
        return
      }

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]!

        if (pointer.active) {
          const dx = particle.x - pointer.x
          const dy = particle.y - pointer.y
          const dist = Math.hypot(dx, dy) || 1
          if (dist < 140) {
            const force = ((140 - dist) / 140) * 0.085
            particle.vx += (dx / dist) * force
            particle.vy += (dy / dist) * force
          }
        }

        particle.vx *= 0.995
        particle.vy *= 0.995
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < particle.radius) {
          particle.x = particle.radius
          particle.vx = Math.abs(particle.vx)
        } else if (particle.x > width - particle.radius) {
          particle.x = width - particle.radius
          particle.vx = -Math.abs(particle.vx)
        }

        if (particle.y < particle.radius) {
          particle.y = particle.radius
          particle.vy = Math.abs(particle.vy)
        } else if (particle.y > height - particle.radius) {
          particle.y = height - particle.radius
          particle.vy = -Math.abs(particle.vy)
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j]!
          const dx = other.x - particle.x
          const dy = other.y - particle.y
          const dist = Math.hypot(dx, dy) || 1
          const minDist = particle.radius + other.radius

          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.5
            const nx = dx / dist
            const ny = dy / dist
            particle.x -= nx * overlap
            particle.y -= ny * overlap
            other.x += nx * overlap
            other.y += ny * overlap

            const dvx = particle.vx - other.vx
            const dvy = particle.vy - other.vy
            const impact = dvx * nx + dvy * ny
            if (impact > 0) {
              particle.vx -= impact * nx
              particle.vy -= impact * ny
              other.vx += impact * nx
              other.vy += impact * ny
            }
          }
        }

        ctx.beginPath()
        ctx.fillStyle = particle.color
        ctx.shadowColor = particle.color
        ctx.shadowBlur = 12
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
      frameId = window.requestAnimationFrame(step)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = true
    }

    const onPointerLeave = () => {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    const onMotionChange = () => {
      window.cancelAnimationFrame(frameId)
      if (prefersReducedMotion.matches) {
        drawStaticFrame(ctx, width, height, particles)
      } else {
        frameId = window.requestAnimationFrame(step)
      }
    }

    resize()
    if (!prefersReducedMotion.matches) {
      frameId = window.requestAnimationFrame(step)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)
    prefersReducedMotion.addEventListener('change', onMotionChange)

    return () => {
      running = false
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      prefersReducedMotion.removeEventListener('change', onMotionChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="home__background"
      aria-hidden="true"
    />
  )
}
