import { PLAYER_PROFILES } from '../../shared/profiles'
import type { RunSettings } from './settings'
import {
  BUBBLE_START_RADIUS,
  type Bubble,
  type BubbleId,
  type ImpactEvent,
  type LevelData,
  MAX_PARTICLES,
  MAX_POP_BURSTS,
  type Particle,
  type PopBurst,
  type Spike,
  type WallSeg,
} from './types'

export type PhysicsOptions = {
  growthRate: number
  growthMultiplier: number
  mergeTemptation: boolean
  wallSpikes: boolean
  juicyPops: boolean
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function pushParticle(pool: Particle[], p: Particle) {
  if (pool.length >= MAX_PARTICLES) {
    pool.splice(0, pool.length - MAX_PARTICLES + 1)
  }
  pool.push(p)
}

function pushBurst(pool: PopBurst[], b: PopBurst) {
  if (pool.length >= MAX_POP_BURSTS) {
    pool.splice(0, pool.length - MAX_POP_BURSTS + 1)
  }
  pool.push(b)
}

export function createBubbles(level: LevelData, playerCount: number): Bubble[] {
  const count = Math.max(2, Math.min(6, playerCount))
  const profiles = PLAYER_PROFILES.slice(0, count)
  const cx = level.bounds.width / 2
  // Mid-upper arena: clear of top descending spike tips and most mid obstacles.
  const cy = level.bounds.height * 0.4
  // Pack nearly touching so growth immediately produces shoves.
  const gap = 4
  const chord = BUBBLE_START_RADIUS * 2 + gap
  const ring = count <= 1 ? 0 : chord / (2 * Math.sin(Math.PI / count))

  const bubbles = profiles.map((profile, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
    // Slight growth / pop desync so the pack doesn't sync-burst.
    const growthScale = 0.86 + (index * 0.047) % 0.28
    const popRadius = level.maxRadius * (0.9 + ((index * 0.07) % 0.2))
    return {
      id: profile.id,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring * 0.9,
      vx: Math.cos(angle + Math.PI / 2) * 28,
      vy: Math.sin(angle + Math.PI / 2) * 28,
      radius: BUBBLE_START_RADIUS,
      squashX: 1,
      squashY: 1,
      color: profile.color,
      alive: true,
      shovePulse: 0,
      wobble: index * 1.7,
      growthScale,
      popRadius,
    }
  })

  clearSpawnHazards(bubbles, level)
  return bubbles
}

/** Nudge bubbles clear of walls/spikes so matches never start with an instant pop. */
function clearSpawnHazards(bubbles: Bubble[], level: LevelData) {
  for (let pass = 0; pass < 8; pass++) {
    for (const bubble of bubbles) {
      for (const wall of level.walls) {
        const hit = circleRectResolve(bubble.x, bubble.y, bubble.radius + 4, wall)
        if (hit) {
          bubble.x += hit.nx * (hit.depth + 2)
          bubble.y += hit.ny * (hit.depth + 2)
        }
      }
      for (const s of level.spikes) {
        const tip = spikeTip(s)
        const mid = {
          x: s.x + Math.cos(s.angle) * s.length * 0.55,
          y: s.y + Math.sin(s.angle) * s.length * 0.55,
        }
        for (const p of [tip, mid, { x: s.x, y: s.y }]) {
          const dx = bubble.x - p.x
          const dy = bubble.y - p.y
          const dist = Math.hypot(dx, dy) || 0.0001
          const min = bubble.radius + 10
          if (dist < min) {
            const push = (min - dist) / dist
            bubble.x += dx * push
            bubble.y += dy * push
          }
        }
      }
      const m = level.margin + bubble.radius + 6
      bubble.x = clamp(bubble.x, m, level.bounds.width - m)
      bubble.y = clamp(bubble.y, m, level.bounds.height - m)
    }
  }
}

export function cloneSpikes(spikes: Spike[]): Spike[] {
  return spikes.map((s) => ({ ...s }))
}

export function spawnPopVfx(
  bubble: Bubble,
  particles: Particle[],
  bursts: PopBurst[],
  juicy: boolean,
) {
  const count = juicy ? 18 : 10
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4
    const speed = 80 + Math.random() * 220
    pushParticle(particles, {
      x: bubble.x,
      y: bubble.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color: bubble.color,
      size: 3 + Math.random() * 5,
    })
  }
  pushBurst(bursts, {
    x: bubble.x,
    y: bubble.y,
    life: juicy ? 0.42 : 0.28,
    maxLife: juicy ? 0.42 : 0.28,
    color: bubble.color,
    radius: bubble.radius * (juicy ? 1.8 : 1.35),
  })
}

function circleRectResolve(
  cx: number,
  cy: number,
  r: number,
  wall: WallSeg,
): { nx: number; ny: number; depth: number } | null {
  const left = wall.x
  const right = wall.x + wall.w
  const top = wall.y
  const bottom = wall.y + wall.h
  const nearestX = clamp(cx, left, right)
  const nearestY = clamp(cy, top, bottom)
  const dx = cx - nearestX
  const dy = cy - nearestY
  const distSq = dx * dx + dy * dy

  // Center inside the AABB — push out along the shallowest axis.
  if (distSq < 1e-8) {
    const toLeft = cx - left
    const toRight = right - cx
    const toTop = cy - top
    const toBottom = bottom - cy
    const minX = Math.min(toLeft, toRight)
    const minY = Math.min(toTop, toBottom)
    if (minX < minY) {
      return toLeft < toRight
        ? { nx: -1, ny: 0, depth: toLeft + r }
        : { nx: 1, ny: 0, depth: toRight + r }
    }
    return toTop < toBottom
      ? { nx: 0, ny: -1, depth: toTop + r }
      : { nx: 0, ny: 1, depth: toBottom + r }
  }

  if (distSq >= r * r) return null
  const dist = Math.sqrt(distSq)
  return { nx: dx / dist, ny: dy / dist, depth: r - dist }
}

function spikeTip(spike: Spike): { x: number; y: number } {
  return {
    x: spike.x + Math.cos(spike.angle) * spike.length,
    y: spike.y + Math.sin(spike.angle) * spike.length,
  }
}

function popBubble(
  bubble: Bubble,
  kind: ImpactEvent['kind'],
  events: ImpactEvent[],
  particles: Particle[],
  bursts: PopBurst[],
  juicy: boolean,
) {
  if (!bubble.alive) return
  bubble.alive = false
  events.push({
    bubbleId: bubble.id,
    kind,
    x: bubble.x,
    y: bubble.y,
    intensity: 1,
  })
  spawnPopVfx(bubble, particles, bursts, juicy)
}

export function stepPhysics(
  bubbles: Bubble[],
  walls: WallSeg[],
  spikes: Spike[],
  level: LevelData,
  dt: number,
  particles: Particle[],
  bursts: PopBurst[],
  options: PhysicsOptions,
): ImpactEvent[] {
  const events: ImpactEvent[] = []
  // Soft drag — keep motion lively so packs keep colliding.
  const damp = Math.pow(0.55, dt)
  const baseGrowth = options.growthRate * options.growthMultiplier * dt
  const arenaCx = level.bounds.width * 0.5
  const arenaCy = level.bounds.height * 0.45

  for (const bubble of bubbles) {
    if (!bubble.alive) continue

    bubble.wobble += dt * 3.2
    bubble.radius = Math.min(
      bubble.popRadius + 6,
      bubble.radius + baseGrowth * bubble.growthScale,
    )

    // Soft buoyancy + gentle wander + mild arena cohesion (keeps combat clustered)
    bubble.vy -= 18 * dt
    bubble.vx += Math.sin(bubble.wobble * 1.3 + bubble.x * 0.01) * 36 * dt
    bubble.vy += Math.cos(bubble.wobble * 0.9) * 22 * dt
    bubble.vx += (arenaCx - bubble.x) * 0.35 * dt
    bubble.vy += (arenaCy - bubble.y) * 0.28 * dt

    bubble.vx *= damp
    bubble.vy *= damp
    bubble.x += bubble.vx * dt
    bubble.y += bubble.vy * dt

    // Relax squash toward circle (slow so squash stays readable)
    bubble.squashX += (1 - bubble.squashX) * Math.min(1, dt * 3.2)
    bubble.squashY += (1 - bubble.squashY) * Math.min(1, dt * 3.2)
    if (bubble.shovePulse > 0) bubble.shovePulse = Math.max(0, bubble.shovePulse - dt * 4)

    // Overinflate: never pop the last survivor (they already won).
    if (bubble.radius >= bubble.popRadius) {
      const othersAlive = bubbles.some((b) => b.alive && b.id !== bubble.id)
      if (othersAlive) {
        popBubble(bubble, 'overinflate', events, particles, bursts, options.juicyPops)
      }
    }
  }

  // Bubble–bubble soft contacts
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i]
    if (!a.alive) continue
    for (let j = i + 1; j < bubbles.length; j++) {
      const b = bubbles[j]
      if (!b.alive) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.0001
      const minDist = a.radius + b.radius
      if (dist >= minDist) continue

      const nx = dx / dist
      const ny = dy / dist
      const overlap = minDist - dist

      // Soft resolve: leave residual overlap so squash reads on screen
      const sep = overlap * 0.18
      a.x -= nx * sep
      a.y -= ny * sep
      b.x += nx * sep
      b.y += ny * sep

      const relVx = b.vx - a.vx
      const relVy = b.vy - a.vy
      const closing = relVx * nx + relVy * ny
      // Inflate pressure + bounce on closing contacts
      const pressure = overlap * 36
      let impulse = -pressure * dt
      if (closing < 0) impulse += closing * 0.5
      a.vx += impulse * nx
      a.vy += impulse * ny
      b.vx -= impulse * nx
      b.vy -= impulse * ny

      // Mutual tether while overlapping keeps the pack fighting
      const tether = overlap * 10 * dt
      a.vx += nx * tether
      a.vy += ny * tether
      b.vx -= nx * tether
      b.vy -= ny * tether

      // Squash: any contact gets a readable floor, deeper overlap exaggerates
      const contactFloor = 1.22
      const squash = clamp(
        contactFloor + (overlap / Math.max(6, Math.min(a.radius, b.radius) * 0.35)) * 0.85,
        contactFloor,
        1.95,
      )
      const stretch = 1 / Math.sqrt(squash)
      const sx = clamp(stretch + Math.abs(nx) * (squash - stretch), 0.42, 2)
      const sy = clamp(stretch + Math.abs(ny) * (squash - stretch), 0.42, 2)
      a.squashX = a.squashX * 0.25 + sx * 0.75
      a.squashY = a.squashY * 0.25 + sy * 0.75
      b.squashX = b.squashX * 0.25 + sx * 0.75
      b.squashY = b.squashY * 0.25 + sy * 0.75

      const intensity = clamp(overlap / 8 + Math.abs(closing) / 160 + pressure / 80, 0.25, 1)
      a.shovePulse = Math.max(a.shovePulse, intensity)
      b.shovePulse = Math.max(b.shovePulse, intensity)

      events.push({
        bubbleId: a.id,
        kind: 'shove',
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        intensity,
        otherId: b.id,
      })

      // Merge temptation: similar size + deep overlap risk
      if (options.mergeTemptation) {
        const sizeDiff = Math.abs(a.radius - b.radius) / Math.max(a.radius, b.radius)
        const deep = overlap > Math.max(14, Math.min(a.radius, b.radius) * 0.55)
        if (sizeDiff < 0.1 && deep) {
          const victim = a.radius <= b.radius ? a : b
          const othersAlive = bubbles.some((x) => x.alive && x.id !== victim.id)
          if (othersAlive) {
            popBubble(victim, 'merge', events, particles, bursts, options.juicyPops)
          }
        }
      }
    }
  }

  // Walls
  for (const bubble of bubbles) {
    if (!bubble.alive) continue
    for (const wall of walls) {
      const hit = circleRectResolve(bubble.x, bubble.y, bubble.radius, wall)
      if (!hit) continue
      bubble.x += hit.nx * hit.depth
      bubble.y += hit.ny * hit.depth
      const vn = bubble.vx * hit.nx + bubble.vy * hit.ny
      if (vn < 0) {
        bubble.vx -= 1.65 * vn * hit.nx
        bubble.vy -= 1.65 * vn * hit.ny
      }
      const squash = clamp(1 + hit.depth / bubble.radius, 1, 1.6)
      bubble.squashX = clamp(1 / squash + Math.abs(hit.nx) * (squash - 1 / squash), 0.5, 1.75)
      bubble.squashY = clamp(1 / squash + Math.abs(hit.ny) * (squash - 1 / squash), 0.5, 1.75)

      // Crush only on deep embedding (not glancing wall contact)
      if (hit.depth > bubble.radius * 0.72) {
        const othersAlive = bubbles.some((b) => b.alive && b.id !== bubble.id)
        if (othersAlive) {
          popBubble(bubble, 'crush', events, particles, bursts, options.juicyPops)
        }
      } else if (Math.abs(vn) > 40 || hit.depth > 4) {
        events.push({
          bubbleId: bubble.id,
          kind: 'wall',
          x: bubble.x,
          y: bubble.y,
          intensity: clamp(Math.abs(vn) / 200 + hit.depth / 20, 0.1, 1),
        })
      }
    }

    // Keep inside soft arena bounds
    const m = level.margin + 4
    const maxX = level.bounds.width - m
    const maxY = level.bounds.height - m
    if (bubble.x - bubble.radius < m) {
      bubble.x = m + bubble.radius
      bubble.vx = Math.abs(bubble.vx) * 0.8
    }
    if (bubble.x + bubble.radius > maxX) {
      bubble.x = maxX - bubble.radius
      bubble.vx = -Math.abs(bubble.vx) * 0.8
    }
    if (bubble.y - bubble.radius < m) {
      bubble.y = m + bubble.radius
      bubble.vy = Math.abs(bubble.vy) * 0.8
    }
    if (bubble.y + bubble.radius > maxY) {
      bubble.y = maxY - bubble.radius
      bubble.vy = -Math.abs(bubble.vy) * 0.8
    }
  }

  // Spikes
  for (const bubble of bubbles) {
    if (!bubble.alive) continue
    for (const s of spikes) {
      if (!options.wallSpikes && !s.descending) continue
      const tip = spikeTip(s)
      // Check tip and mid-shaft
      const points = [
        tip,
        {
          x: s.x + Math.cos(s.angle) * s.length * 0.55,
          y: s.y + Math.sin(s.angle) * s.length * 0.55,
        },
      ]
      for (const p of points) {
        const dx = bubble.x - p.x
        const dy = bubble.y - p.y
        const hitR = bubble.radius * 0.88
        if (dx * dx + dy * dy <= hitR * hitR) {
          const othersAlive = bubbles.some((b) => b.alive && b.id !== bubble.id)
          if (othersAlive) {
            popBubble(bubble, 'spike', events, particles, bursts, options.juicyPops)
          }
          break
        }
      }
      if (!bubble.alive) break
    }
  }

  return events
}

export function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.96
    p.vy *= 0.96
    p.vy += 40 * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
}

export function updateBursts(bursts: PopBurst[], dt: number) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    bursts[i].life -= dt
    if (bursts[i].life <= 0) bursts.splice(i, 1)
  }
}

export function updateHazards(spikes: Spike[], dt: number, descendSpeed: number) {
  if (descendSpeed <= 0) return
  for (const s of spikes) {
    if (!s.descending) continue
    s.y += descendSpeed * dt
  }
}

export function rivalryIds(bubbles: Bubble[], enabled: boolean): BubbleId[] {
  if (!enabled) return []
  return [...bubbles]
    .filter((b) => b.alive)
    .sort((a, b) => b.radius - a.radius)
    .slice(0, 2)
    .map((b) => b.id)
}

export function settingsToPhysics(
  settings: RunSettings,
  growthRate: number,
  growthMultiplier: number,
): PhysicsOptions {
  return {
    growthRate,
    growthMultiplier,
    mergeTemptation: settings.mergeTemptation,
    wallSpikes: settings.wallSpikes,
    juicyPops: settings.juicyPops,
  }
}
