import { PLAYER_PROFILES } from '../../shared/profiles'
import {
  ARENA_CX,
  ARENA_CY,
  ARENA_RADIUS,
  type CourseData,
  type Dodger,
  type DodgerId,
  HIT_HALF_WIDTH_PAD,
  HUB_SAFE_DEFAULT,
  HUB_SAFE_FLOOR,
  type LaserBeam,
  type LaserEvent,
  NEAR_MISS_PAD,
  type Particle,
  RACER_RADIUS,
  SPAWN_RADIUS,
  TRAIL_LENGTH,
  type Vec2,
} from './types'

const TAU = Math.PI * 2
const BEAM_COLORS = ['#ff2d95', '#00f0ff', '#ff4d6d', '#b197fc', '#ffe066', '#69db7c']

/** Beams grow in so spawn isn't instantly lethal. */
const BEAM_SPAWN_LENGTH = 0.32
const BEAM_LETHAL_LENGTH = 0.8
const DODGER_SPAWN_GRACE = 0.7
const MAX_SPEED = 280
const DASH_SPEED = 420
const FRICTION = 2.2
const ACCEL = 720

export function normalizeAngle(a: number): number {
  let x = a % TAU
  if (x < 0) x += TAU
  return x
}

/** Smallest signed angular distance a→b. */
export function angleDelta(a: number, b: number): number {
  let d = normalizeAngle(a) - normalizeAngle(b)
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function clampMag(x: number, y: number, max: number): Vec2 {
  const m = Math.hypot(x, y)
  if (m <= max || m < 1e-6) return { x, y }
  const s = max / m
  return { x: x * s, y: y * s }
}

export function createBeams(
  course: CourseData,
  beamCountOverride?: number,
): LaserBeam[] {
  const source = course.beams
  const count = Math.max(1, Math.min(6, beamCountOverride ?? source.length))
  const hubClear = course.hubClear ?? HUB_SAFE_DEFAULT
  const beams: LaserBeam[] = []
  for (let i = 0; i < count; i++) {
    const template = source[i % source.length]
    const extra = i >= source.length
    const targetLength = template.length
    beams.push({
      id: i + 1,
      angle: extra
        ? normalizeAngle(template.angle + (TAU * i) / count + 0.3)
        : template.angle,
      angularSpeed: extra
        ? template.angularSpeed * (i % 2 === 0 ? 1.08 : -0.95)
        : template.angularSpeed,
      halfWidth: template.halfWidth,
      length: Math.min(BEAM_SPAWN_LENGTH, targetLength),
      targetLength,
      hubClear,
      color: BEAM_COLORS[i % BEAM_COLORS.length],
      pulse: 0.55,
      telegraph: 0.8,
    })
  }
  return beams
}

/** Place racers in safe spawn band between hub and rim, spread by angle. */
export function createDodgers(
  playerCount: number,
  skillScale: number,
  beams: LaserBeam[] = [],
): Dodger[] {
  const n = Math.max(2, Math.min(6, playerCount))
  const hubR = ARENA_RADIUS * (beams[0]?.hubClear ?? HUB_SAFE_DEFAULT)
  const spawnR = Math.min(
    SPAWN_RADIUS,
    (hubR + ARENA_RADIUS - RACER_RADIUS) * 0.55,
  )
  // Prefer angles farthest from beams
  const starts = pickSpawnAngles(n, beams)

  const dodgers: Dodger[] = []
  for (let i = 0; i < n; i++) {
    const profile = PLAYER_PROFILES[i]
    const angle = starts[i] ?? (TAU * i) / n + Math.PI / 2
    const r = spawnR + (i % 2) * 12
    dodgers.push({
      id: profile.id,
      color: profile.color,
      x: ARENA_CX + Math.cos(angle) * r,
      y: ARENA_CY + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      radius: RACER_RADIUS,
      skill: Math.max(0.5, Math.min(1.3, skillScale * (0.9 + (i % 3) * 0.06))),
      alive: true,
      grace: DODGER_SPAWN_GRACE,
      nearMissCooldown: 0,
      stun: 0,
      dash: 0,
      dashCooldown: 0.4 + i * 0.05,
      trail: [],
    })
  }
  return dodgers
}

function pickSpawnAngles(count: number, beams: LaserBeam[]): number[] {
  if (beams.length === 0) {
    return Array.from({ length: count }, (_, i) => (TAU * i) / count)
  }
  const samples = 48
  const scored: Array<{ a: number; score: number }> = []
  for (let i = 0; i < samples; i++) {
    const a = (TAU * i) / samples
    let minGap = Infinity
    for (const beam of beams) {
      const d = Math.abs(angleDelta(a, beam.angle)) - beam.halfWidth
      if (d < minGap) minGap = d
    }
    scored.push({ a, score: minGap })
  }
  scored.sort((a, b) => b.score - a.score)

  const picks: number[] = []
  for (const s of scored) {
    if (picks.length >= count) break
    if (picks.every((p) => Math.abs(angleDelta(p, s.a)) > 0.32)) {
      picks.push(s.a)
    }
  }
  while (picks.length < count) {
    picks.push((TAU * picks.length) / count)
  }
  return picks
}

/** Snapshot beams advanced by `ahead` seconds. */
export function projectBeams(
  beams: LaserBeam[],
  ahead: number,
  speedScale: number,
): LaserBeam[] {
  return beams.map((beam) => ({
    ...beam,
    angle: normalizeAngle(beam.angle + beam.angularSpeed * speedScale * ahead),
    length: Math.min(
      beam.targetLength,
      beam.length + Math.max(0, ahead) * 0.5,
    ),
    telegraph: Math.max(0, beam.telegraph - ahead),
  }))
}

export function currentHubClear(beams: LaserBeam[]): number {
  if (beams.length === 0) return HUB_SAFE_DEFAULT
  return Math.min(...beams.map((b) => b.hubClear))
}

/**
 * Lethal if outside hub, within beam length, and inside angular wedge.
 * Growing beams below lethal length are not deadly.
 */
export function beamDangerAt(
  x: number,
  y: number,
  beams: LaserBeam[],
  opts?: { ignoreLength?: boolean; nearMiss?: boolean },
): { lethal: boolean; near: boolean; clearance: number } {
  const dx = x - ARENA_CX
  const dy = y - ARENA_CY
  const r = Math.hypot(dx, dy)
  const ang = Math.atan2(dy, dx)
  let lethal = false
  let near = false
  let worst = Infinity

  for (const beam of beams) {
    const hubR = ARENA_RADIUS * beam.hubClear
    if (r < hubR) continue
    if (!opts?.ignoreLength && beam.length < BEAM_LETHAL_LENGTH) continue
    if (r > ARENA_RADIUS * beam.length + 6) continue

    const half = beam.halfWidth + HIT_HALF_WIDTH_PAD
    const d = Math.abs(angleDelta(ang, beam.angle))
    const clearance = d - half
    if (clearance < worst) worst = clearance
    if (d <= half) lethal = true
    else if (opts?.nearMiss !== false && d <= half + NEAR_MISS_PAD) near = true
  }

  return {
    lethal,
    near,
    clearance: Number.isFinite(worst) ? worst : Math.PI,
  }
}

function threatScore(x: number, y: number, beams: LaserBeam[]): number {
  const d = beamDangerAt(x, y, beams, { ignoreLength: true })
  if (d.lethal) return 1
  // Broader awareness cone so racers turn before the blade is on them
  return Math.max(0, 1 - d.clearance / 0.65)
}

export function stepBeams(
  beams: LaserBeam[],
  dt: number,
  speedScale: number,
): void {
  for (const beam of beams) {
    beam.angle = normalizeAngle(
      beam.angle + beam.angularSpeed * speedScale * dt,
    )
    // Slow creep keeps single-blade arenas contestable over time.
    beam.angularSpeed *= 1 + dt * 0.012
    if (beam.length < beam.targetLength) {
      // Slightly longer telegraph before lethal, then firm growth.
      const grow =
        beam.length < BEAM_LETHAL_LENGTH * 0.92 ? dt * 0.16 : dt * 0.35
      beam.length = Math.min(beam.targetLength, beam.length + grow)
    }
    if (beam.pulse > 0) beam.pulse = Math.max(0, beam.pulse - dt * 2.5)
    if (beam.telegraph > 0) beam.telegraph = Math.max(0, beam.telegraph - dt)
  }
}

/** Steering AI + integrate desire into acceleration. */
export function stepAi(
  dodger: Dodger,
  beams: LaserBeam[],
  dt: number,
  aggression: number,
  mistakeBias: number,
  pressure: number,
  speedScale = 1,
  peers: Dodger[] = [],
): void {
  if (!dodger.alive) return
  if (dodger.grace > 0) dodger.grace = Math.max(0, dodger.grace - dt)
  if (dodger.stun > 0) dodger.stun = Math.max(0, dodger.stun - dt)
  if (dodger.dash > 0) dodger.dash = Math.max(0, dodger.dash - dt)
  if (dodger.dashCooldown > 0) {
    dodger.dashCooldown = Math.max(0, dodger.dashCooldown - dt)
  }

  const lookAhead = 0.45 + aggression * 0.25
  const future = projectBeams(beams, lookAhead, speedScale)
  const nearFuture = projectBeams(beams, 0.2, speedScale)

  const here = threatScore(dodger.x, dodger.y, nearFuture)
  const ahead = threatScore(dodger.x, dodger.y, future)
  const nowDanger = beamDangerAt(dodger.x, dodger.y, nearFuture)
  const threat = Math.max(here, ahead * 0.85)
  // React early — don't wait until clearance is already tiny
  const urgent = threat > 0.28 || nowDanger.clearance < 0.22
  const panicking = threat > 0.55 || nowDanger.clearance < 0.1

  const alivePeers = peers.filter((p) => p.alive && p.id !== dodger.id)
  const aliveCount = alivePeers.length + 1

  let ax = 0
  let ay = 0

  // --- Primary: sprint away from beams (dominates when threatened)
  const flee = fleeFromBeams(dodger.x, dodger.y, future, nearFuture)
  const fleeW = panicking ? 3.2 : urgent ? 2.4 : 1.15
  ax += flee.x * fleeW
  ay += flee.y * fleeW

  // Hub only as last-ditch escape when about to eat a wedge
  const toHubX = ARENA_CX - dodger.x
  const toHubY = ARENA_CY - dodger.y
  const hubDist = Math.hypot(toHubX, toHubY)
  if (panicking && nowDanger.clearance < 0.08 && hubDist > 1) {
    ax += (toHubX / hubDist) * 1.6
    ay += (toHubY / hubDist) * 1.6
  }

  // Strong personal space — packs are boring
  for (const peer of alivePeers) {
    const dx = dodger.x - peer.x
    const dy = dodger.y - peer.y
    const d = Math.hypot(dx, dy)
    const soft = dodger.radius + peer.radius + 42
    if (d > 0.001 && d < soft) {
      const push = ((soft - d) / soft) * (urgent ? 0.9 : 1.35)
      ax += (dx / d) * push
      ay += (dy / d) * push
    }
  }

  // Hunt only when clearly safe — never when it would form a blob
  const canHunt = !urgent && threat < 0.18 && aliveCount <= 4
  if (canHunt && alivePeers.length > 0) {
    let nearest: Dodger | null = null
    let nearestD = Infinity
    for (const peer of alivePeers) {
      const d = dist(dodger.x, dodger.y, peer.x, peer.y)
      if (d < nearestD) {
        nearestD = d
        nearest = peer
      }
    }
    const crowded = alivePeers.filter(
      (p) => dist(dodger.x, dodger.y, p.x, p.y) < 70,
    ).length
    if (nearest && crowded <= 1) {
      const huntW =
        aggression *
        (aliveCount <= 2 ? 1.1 : aliveCount <= 3 ? 0.75 : 0.4)
      const outwardX = nearest.x - ARENA_CX
      const outwardY = nearest.y - ARENA_CY
      const om = Math.hypot(outwardX, outwardY) || 1
      const aimX = nearest.x + (outwardX / om) * 40
      const aimY = nearest.y + (outwardY / om) * 40
      const dx = aimX - dodger.x
      const dy = aimY - dodger.y
      const dm = Math.hypot(dx, dy) || 1
      ax += (dx / dm) * huntW
      ay += (dy / dm) * huntW
    }
  }

  // Keep moving when safe — patrol open arcs, not the hub
  if (!urgent) {
    const t = performance.now() * 0.001 + dodger.skill * 12
    ax += Math.sin(t * 2.1 + dodger.x * 0.015) * 0.7
    ay += Math.cos(t * 1.6 + dodger.y * 0.015) * 0.7
    // Prefer ring-tangent cruising so they look fast between threats
    const ang = Math.atan2(dodger.y - ARENA_CY, dodger.x - ARENA_CX)
    const cruise = ang + Math.PI / 2 * (dodger.skill > 1 ? 1 : -1)
    ax += Math.cos(cruise) * 0.85
    ay += Math.sin(cruise) * 0.85
  }

  // Steer toward a safer sample (stronger when threatened)
  const sample = sampleSaferPoint(dodger, future, urgent || panicking, alivePeers)
  if (sample) {
    const dx = sample.x - dodger.x
    const dy = sample.y - dodger.y
    const dm = Math.hypot(dx, dy) || 1
    const w = panicking ? 2.0 : urgent ? 1.5 : 0.55
    ax += (dx / dm) * w
    ay += (dy / dm) * w
  }

  // Mistakes rarer under threat so they actually dodge
  const mistakeChance =
    mistakeBias * (urgent ? 0.12 : 0.35) +
    pressure * 0.06 * (1.15 - dodger.skill)
  if (Math.random() < mistakeChance * dt) {
    if (Math.random() < 0.4) {
      dodger.stun = 0.05 + Math.random() * 0.08
    } else {
      ax += (Math.random() - 0.5) * 1.4
      ay += (Math.random() - 0.5) * 1.4
    }
  }

  // Dash out of impending hits — prefer tangential flee
  if (
    (urgent || panicking) &&
    dodger.dashCooldown <= 0 &&
    dodger.stun <= 0 &&
    (threat > 0.45 || nowDanger.clearance < 0.14)
  ) {
    const landing = sampleSaferPoint(dodger, future, true, alivePeers, 16)
    if (landing) {
      const dx = landing.x - dodger.x
      const dy = landing.y - dodger.y
      const dm = Math.hypot(dx, dy) || 1
      let dirX = dx / dm
      let dirY = dy / dm
      if (Math.hypot(flee.x, flee.y) > 0.2) {
        dirX = dirX * 0.35 + flee.x * 0.65
        dirY = dirY * 0.35 + flee.y * 0.65
        const nm = Math.hypot(dirX, dirY) || 1
        dirX /= nm
        dirY /= nm
      }
      dodger.vx = dirX * DASH_SPEED
      dodger.vy = dirY * DASH_SPEED
      dodger.dash = 0.14
      dodger.dashCooldown = 0.95 + Math.random() * 0.35
      dodger.grace = Math.max(dodger.grace, 0.1)
    }
  }

  // Don't normalize away urgency — let flee overwhelm other terms
  const desireCap = panicking ? 2.4 : urgent ? 1.8 : 1.15
  const desire = clampMag(ax, ay, desireCap)
  let accel =
    (ACCEL + aggression * 260) *
    dodger.skill *
    (panicking ? 1.55 : urgent ? 1.35 : 1)
  if (dodger.stun > 0) accel *= 0.35
  if (dodger.dash > 0) accel *= 1.25

  dodger.vx += desire.x * accel * dt
  dodger.vy += desire.y * accel * dt

  const damp = Math.exp(-FRICTION * dt)
  dodger.vx *= damp
  dodger.vy *= damp

  const maxSp =
    dodger.dash > 0
      ? DASH_SPEED
      : MAX_SPEED * (0.88 + dodger.skill * 0.28) * (urgent ? 1.08 : 1)
  const capped = clampMag(dodger.vx, dodger.vy, maxSp)
  dodger.vx = capped.x
  dodger.vy = capped.y

  dodger.x += dodger.vx * dt
  dodger.y += dodger.vy * dt
  constrainToArena(dodger)

  dodger.trail.push({ x: dodger.x, y: dodger.y })
  if (dodger.trail.length > TRAIL_LENGTH) dodger.trail.shift()
}

/**
 * Flee along the safer tangent away from approaching beams.
 * Hub cut only when already deep inside the lethal wedge.
 */
function fleeFromBeams(
  x: number,
  y: number,
  future: LaserBeam[],
  near: LaserBeam[],
): Vec2 {
  const dx = x - ARENA_CX
  const dy = y - ARENA_CY
  const r = Math.hypot(dx, dy) || 1
  const ang = Math.atan2(dy, dx)
  let fx = 0
  let fy = 0

  const beams = future.length ? future : near
  for (let i = 0; i < beams.length; i++) {
    const beam = beams[i]
    const nearBeam = near[i] ?? beam
    const hubR = ARENA_RADIUS * beam.hubClear
    if (r < hubR * 0.7) continue

    const half = beam.halfWidth + HIT_HALF_WIDTH_PAD
    const dNow = Math.abs(angleDelta(ang, nearBeam.angle))
    const dFut = Math.abs(angleDelta(ang, beam.angle))
    const closing = dFut < dNow
    const d = Math.min(dNow, dFut)
    if (d > half + 0.55) continue

    const side = Math.sign(angleDelta(ang, nearBeam.angle)) || 1
    const rot = Math.sign(nearBeam.angularSpeed) || 1
    // Escape opposite the sweep so we don't run into the blade
    let escapeSide = -rot
    if (!closing) escapeSide = side
    const fleeAng = ang + escapeSide * (Math.PI / 2)

    const proximity = Math.max(0, 1 - d / (half + 0.55))
    const urgencyBoost = closing ? 1.45 : 1
    const strength = (0.35 + proximity * 1.4) * urgencyBoost

    fx += Math.cos(fleeAng) * strength
    fy += Math.sin(fleeAng) * strength

    // Dive hub only if already inside the wedge
    if (d < half * 0.85 && r > hubR) {
      fx += ((ARENA_CX - x) / r) * (1.1 + proximity)
      fy += ((ARENA_CY - y) / r) * (1.1 + proximity)
    } else if (d < half + 0.15 && r < SPAWN_RADIUS) {
      fx += (dx / r) * 0.45
      fy += (dy / r) * 0.45
    }
  }

  return clampMag(fx, fy, 2.2)
}

function sampleSaferPoint(
  dodger: Dodger,
  beams: LaserBeam[],
  urgent: boolean,
  peers: Dodger[] = [],
  samples = 18,
): Vec2 | null {
  let best: Vec2 | null = null
  let bestScore = -Infinity
  const reach = urgent ? 95 : 110

  for (let i = 0; i < samples; i++) {
    const a = (TAU * i) / samples + dodger.skill * 0.7
    const distR = reach * (0.4 + (i % 4) * 0.18)
    const x = dodger.x + Math.cos(a) * distR
    const y = dodger.y + Math.sin(a) * distR
    if (!pointInArena(x, y, dodger.radius + 2)) continue

    const danger = threatScore(x, y, beams)
    const hubClear = currentHubClear(beams)
    const hubR = ARENA_RADIUS * hubClear
    const r = dist(x, y, ARENA_CX, ARENA_CY)

    let hubBonus = 0
    if (urgent && danger > 0.5 && r < hubR * 1.05) hubBonus = 0.4
    else if (r < hubR * 0.85) hubBonus = -0.35

    let crowdPen = 0
    for (const p of peers) {
      if (!p.alive) continue
      const pd = dist(x, y, p.x, p.y)
      if (pd < 55) crowdPen += (55 - pd) / 55
    }

    const floorBonus = 1 - Math.abs(r - SPAWN_RADIUS) / ARENA_RADIUS
    const score = -danger * 4.2 + hubBonus + floorBonus * 0.25 - crowdPen * 0.9
    if (score > bestScore) {
      bestScore = score
      best = { x, y }
    }
  }

  if (urgent) {
    // Tangential escape around current radius — don't collapse to hub
    const ang = Math.atan2(dodger.y - ARENA_CY, dodger.x - ARENA_CX)
    const rr = Math.max(
      ARENA_RADIUS * currentHubClear(beams) + 20,
      Math.min(ARENA_RADIUS - 20, dist(dodger.x, dodger.y, ARENA_CX, ARENA_CY)),
    )
    for (const sign of [-1, 1] as const) {
      const a = ang + sign * 0.55
      const x = ARENA_CX + Math.cos(a) * rr
      const y = ARENA_CY + Math.sin(a) * rr
      const danger = threatScore(x, y, beams)
      const score = -danger * 4.5 + 0.5
      if (score > bestScore) {
        bestScore = score
        best = { x, y }
      }
    }
  }

  return best
}

function pointInArena(x: number, y: number, pad = 0): boolean {
  return dist(x, y, ARENA_CX, ARENA_CY) <= ARENA_RADIUS - pad
}

export function constrainToArena(dodger: Dodger): void {
  const dx = dodger.x - ARENA_CX
  const dy = dodger.y - ARENA_CY
  const r = Math.hypot(dx, dy)
  const maxR = ARENA_RADIUS - dodger.radius - 2
  if (r > maxR && r > 1e-6) {
    const s = maxR / r
    dodger.x = ARENA_CX + dx * s
    dodger.y = ARENA_CY + dy * s
    // Bounce outward velocity inward
    const nx = dx / r
    const ny = dy / r
    const vn = dodger.vx * nx + dodger.vy * ny
    if (vn > 0) {
      dodger.vx -= vn * nx * 1.4
      dodger.vy -= vn * ny * 1.4
    }
  }
}

/** Hard disc–disc collision with push impulses. */
export function resolveRacerCollisions(dodgers: Dodger[]): void {
  const alive = dodgers.filter((d) => d.alive)
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]
      const b = alive[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      const minD = a.radius + b.radius
      if (d >= minD || d < 1e-5) continue

      const nx = dx / d
      const ny = dy / d
      const overlap = minD - d
      // Positional separation
      const push = overlap * 0.55
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push

      // Relative velocity along normal
      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const velN = rvx * nx + rvy * ny
      if (velN >= 0) {
        // Already separating — still add shove from dash
      } else {
        const restitution = 0.35
        const jImp = (-(1 + restitution) * velN) / 2
        const dashBoost =
          (a.dash > 0 ? 1.35 : 1) * (b.dash > 0 ? 1.35 : 1)
        const impulse = jImp * dashBoost * (0.85 + (a.skill + b.skill) * 0.2)
        a.vx -= impulse * nx
        a.vy -= impulse * ny
        b.vx += impulse * nx
        b.vy += impulse * ny
      }

      // Contact shove — stronger when either racer is dashing / faster
      const relSp = Math.hypot(a.vx, a.vy) + Math.hypot(b.vx, b.vy)
      const shove =
        55 +
        relSp * 0.08 +
        (a.dash > 0 || b.dash > 0 ? 70 : 0)
      a.vx -= nx * shove * 0.045
      a.vy -= ny * shove * 0.045
      b.vx += nx * shove * 0.045
      b.vy += ny * shove * 0.045

      constrainToArena(a)
      constrainToArena(b)
    }
  }
}

export function detectHits(
  dodgers: Dodger[],
  beams: LaserBeam[],
  dt: number,
  particles: Particle[],
): LaserEvent[] {
  const events: LaserEvent[] = []
  const pending: { dodger: Dodger; clearance: number }[] = []

  for (const dodger of dodgers) {
    if (!dodger.alive) continue
    if (dodger.nearMissCooldown > 0) {
      dodger.nearMissCooldown = Math.max(0, dodger.nearMissCooldown - dt)
    }

    const sample = beamDangerAt(dodger.x, dodger.y, beams, { nearMiss: true })
    let hit = sample.lethal
    let near = sample.near

    if (hit && (dodger.grace > 0 || dodger.dash > 0)) {
      hit = false
      near = true
    }

    if (hit) {
      pending.push({ dodger, clearance: sample.clearance })
      continue
    }

    if (near && dodger.nearMissCooldown <= 0) {
      dodger.nearMissCooldown = 0.5
      events.push({
        kind: 'nearMiss',
        dodgerId: dodger.id,
        x: dodger.x,
        y: dodger.y,
      })
    }
  }

  const aliveBefore = dodgers.filter((d) => d.alive).length
  let toKill = pending
  if (pending.length > 0 && pending.length >= aliveBefore) {
    toKill = [...pending]
      .sort((a, b) => a.clearance - b.clearance)
      .slice(0, Math.max(0, aliveBefore - 1))
  }

  for (const { dodger } of toKill) {
    dodger.alive = false
    dodger.vx = 0
    dodger.vy = 0
    spawnBurst(particles, dodger.x, dodger.y, dodger.color, 20)
    events.push({ kind: 'zap', dodgerId: dodger.id, x: dodger.x, y: dodger.y })
    events.push({ kind: 'elim', dodgerId: dodger.id, x: dodger.x, y: dodger.y })
  }

  return events
}

export function spawnBurst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU
    const sp = 40 + Math.random() * 180
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
      size: 2 + Math.random() * 4,
    })
  }
}

export function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.98
    p.vy *= 0.98
    if (p.life <= 0) particles.splice(i, 1)
  }
}

export function spawnExtraBeam(
  beams: LaserBeam[],
  hubClear?: number,
): LaserBeam | null {
  if (beams.length >= 6) return null
  const id = beams.reduce((m, b) => Math.max(m, b.id), 0) + 1
  const sign = Math.random() < 0.5 ? -1 : 1
  const hub =
    hubClear ??
    (beams[0]?.hubClear ?? HUB_SAFE_DEFAULT)
  const beam: LaserBeam = {
    id,
    angle: Math.random() * TAU,
    angularSpeed: sign * (0.7 + Math.random() * 0.5),
    halfWidth: 0.038,
    length: BEAM_SPAWN_LENGTH * 0.5,
    targetLength: 1,
    hubClear: hub,
    color: BEAM_COLORS[id % BEAM_COLORS.length],
    pulse: 1,
    telegraph: 1,
  }
  beams.push(beam)
  return beam
}

export function reverseBeams(beams: LaserBeam[]) {
  for (const beam of beams) {
    beam.angularSpeed *= -1
    beam.pulse = 1
    beam.telegraph = 0.55
  }
}

export function narrowBeams(beams: LaserBeam[], factor = 0.82) {
  for (const beam of beams) {
    beam.halfWidth = Math.min(0.11, beam.halfWidth / factor)
    beam.pulse = 0.7
  }
}

/** Shrink safe hub toward floor — never seal completely. */
export function shrinkHub(beams: LaserBeam[], factor = 0.82): void {
  for (const beam of beams) {
    beam.hubClear = Math.max(HUB_SAFE_FLOOR, beam.hubClear * factor)
    beam.pulse = 0.75
    beam.telegraph = 0.4
  }
}

export function spikeBeamSpeed(beams: LaserBeam[], factor = 1.55) {
  for (const beam of beams) {
    beam.angularSpeed *= factor
    beam.pulse = 0.85
  }
}

export function dodgerRadius(): number {
  return RACER_RADIUS
}

export function arenaEdge(): number {
  return ARENA_RADIUS
}

export type { DodgerId }
