import { PLAYER_PROFILES } from '../../shared/profiles'
import {
  ARENA_CX,
  ARENA_CY,
  ARENA_RADIUS,
  type CourseData,
  type Dodger,
  type DodgerId,
  DODGER_SIZE,
  HIT_HALF_WIDTH_PAD,
  type LaserBeam,
  type LaserEvent,
  NEAR_MISS_PAD,
  type Particle,
  RING_RADIUS,
  TRAIL_LENGTH,
} from './types'

const TAU = Math.PI * 2
const BEAM_COLORS = ['#ff2d95', '#00f0ff', '#ff4d6d', '#b197fc', '#ffe066', '#69db7c']

export function normalizeAngle(a: number): number {
  let x = a % TAU
  if (x < 0) x += TAU
  return x
}

/** Smallest absolute angular distance. */
export function angleDelta(a: number, b: number): number {
  let d = normalizeAngle(a) - normalizeAngle(b)
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function ringPoint(angle: number): { x: number; y: number } {
  return {
    x: ARENA_CX + Math.cos(angle) * RING_RADIUS,
    y: ARENA_CY + Math.sin(angle) * RING_RADIUS,
  }
}

/** Beams grow in so spawn isn't instantly lethal; visual from frame 1. */
const BEAM_SPAWN_LENGTH = 0.42
const BEAM_LETHAL_LENGTH = 0.72
const DODGER_SPAWN_GRACE = 0.45

export function createBeams(course: CourseData, beamCountOverride?: number): LaserBeam[] {
  const source = course.beams
  const count = Math.max(
    1,
    Math.min(6, beamCountOverride ?? source.length),
  )
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
      color: BEAM_COLORS[i % BEAM_COLORS.length],
      pulse: 0.55,
    })
  }
  return beams
}

/** Midpoints + usable width of safe arcs between beams. */
export function safeGapSlots(
  beams: LaserBeam[],
): Array<{ mid: number; width: number; start: number }> {
  if (beams.length === 0) {
    return [{ mid: Math.PI / 2, width: TAU * 0.9, start: 0 }]
  }
  const sorted = [...beams].sort(
    (a, b) => normalizeAngle(a.angle) - normalizeAngle(b.angle),
  )
  const slots: Array<{ mid: number; width: number; start: number }> = []
  for (let i = 0; i < sorted.length; i++) {
    const a = normalizeAngle(sorted[i].angle)
    const b = normalizeAngle(sorted[(i + 1) % sorted.length].angle)
    const span = normalizeAngle(b - a)
    const pad =
      sorted[i].halfWidth +
      sorted[(i + 1) % sorted.length].halfWidth +
      HIT_HALF_WIDTH_PAD * 2
    const width = Math.max(0, span - pad)
    if (width > 0.08) {
      const start = normalizeAngle(a + pad / 2)
      slots.push({
        mid: normalizeAngle(a + span / 2),
        width,
        start,
      })
    }
  }
  if (slots.length > 0) return slots
  return sorted.map((beam, i) => ({
    mid: normalizeAngle(
      beam.angle + Math.PI / Math.max(2, sorted.length) + i * 0.01,
    ),
    width: 0.4,
    start: normalizeAngle(beam.angle + beam.halfWidth + HIT_HALF_WIDTH_PAD),
  }))
}

/** Midpoints of safe arcs between beams, ordered around the circle. */
export function safeGapHomes(beams: LaserBeam[]): number[] {
  return safeGapSlots(beams).map((s) => s.mid)
}

/**
 * Spread `count` occupants evenly across a gap's usable arc
 * (not all jammed on the midpoint).
 */
function slotAnglesInGap(
  gap: { mid: number; width: number; start: number },
  count: number,
): number[] {
  if (count <= 1) return [gap.mid]
  const usable = Math.max(0.12, gap.width * 0.82)
  const step = usable / (count + 1)
  const angles: number[] = []
  for (let i = 0; i < count; i++) {
    angles.push(normalizeAngle(gap.start + step * (i + 1)))
  }
  return angles
}

/** Place contestants in the widest safe mid-gaps between beams. */
export function placeSafeAngles(count: number, beams: LaserBeam[]): number[] {
  const n = Math.max(1, count)
  const gaps = safeGapSlots(beams)
  if (gaps.length === 0) {
    return Array.from({ length: n }, (_, i) => (TAU * i) / n + Math.PI / 2)
  }

  // Prefer unique gaps first; overflow spreads inside the widest gaps
  const sorted = [...gaps].sort((a, b) => b.width - a.width)
  const assignment: number[][] = sorted.map(() => [])
  for (let i = 0; i < n; i++) {
    assignment[i % sorted.length].push(i)
  }

  const slots: number[] = new Array(n)
  for (let g = 0; g < sorted.length; g++) {
    const occupants = assignment[g]
    if (occupants.length === 0) continue
    const angles = slotAnglesInGap(sorted[g], occupants.length)
    for (let k = 0; k < occupants.length; k++) {
      slots[occupants[k]] = angles[k]
    }
  }
  return slots
}

/**
 * Assign each alive dodger a unique home in the current safe gaps so they
 * spread out instead of stacking on one midpoint.
 */
export function assignHomes(dodgers: Dodger[], beams: LaserBeam[]): void {
  const gaps = safeGapSlots(beams)
  if (gaps.length === 0) return
  const alive = [...dodgers]
    .filter((d) => d.alive)
    .sort((a, b) => a.id.localeCompare(b.id))

  const sorted = [...gaps].sort((a, b) => b.width - a.width)
  const assignment: Dodger[][] = sorted.map(() => [])
  for (let i = 0; i < alive.length; i++) {
    assignment[i % sorted.length].push(alive[i])
  }

  for (let g = 0; g < sorted.length; g++) {
    const group = assignment[g]
    if (group.length === 0) continue
    const angles = slotAnglesInGap(sorted[g], group.length)
    for (let k = 0; k < group.length; k++) {
      group[k].homeAngle = angles[k]
    }
  }
}

export function createDodgers(
  playerCount: number,
  skillScale: number,
  beams: LaserBeam[] = [],
): Dodger[] {
  const n = Math.max(2, Math.min(6, playerCount))
  const angles = placeSafeAngles(n, beams)
  const dodgers: Dodger[] = []
  for (let i = 0; i < n; i++) {
    const profile = PLAYER_PROFILES[i]
    const angle = angles[i] ?? (TAU * i) / n
    dodgers.push({
      id: profile.id,
      color: profile.color,
      angle,
      omega: 0,
      skill: Math.max(0.45, Math.min(1.25, skillScale * (0.9 + (i % 3) * 0.06))),
      homeAngle: angle,
      alive: true,
      grace: DODGER_SPAWN_GRACE,
      nearMissCooldown: 0,
      stun: 0,
      trail: [],
    })
  }
  return dodgers
}

function isAngleDangerous(
  angle: number,
  beams: LaserBeam[],
  ignoreLength = false,
): boolean {
  for (const beam of beams) {
    if (!ignoreLength && beam.length < BEAM_LETHAL_LENGTH) continue
    const half = beam.halfWidth + HIT_HALF_WIDTH_PAD
    if (Math.abs(angleDelta(angle, beam.angle)) <= half) return true
  }
  return false
}

/** True if the shortest arc from→to crosses a beam wedge. */
function pathCrossesBeam(
  from: number,
  to: number,
  beams: LaserBeam[],
): boolean {
  const travel = -angleDelta(from, to)
  if (Math.abs(travel) < 0.02) return isAngleDangerous(from, beams, true)
  const steps = Math.max(6, Math.ceil(Math.abs(travel) / 0.08))
  for (let i = 1; i <= steps; i++) {
    const a = normalizeAngle(from + (travel * i) / steps)
    if (isAngleDangerous(a, beams, true)) return true
  }
  return false
}

/** Snapshot beams advanced by `ahead` seconds (for predictive dodge). */
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
      beam.length + Math.max(0, ahead) * 0.55,
    ),
  }))
}

/**
 * Pick a reachable safe angle biased toward this dodger's home slot.
 * Avoids beam-crossing shortcuts and stacking on peers.
 */
export function findSafeTarget(
  fromAngle: number,
  beams: LaserBeam[],
  homeAngle: number,
  avoidAngles: number[] = [],
  samples = 72,
): number {
  let best = homeAngle
  let bestScore = -Infinity

  for (let i = 0; i < samples; i++) {
    const candidate = (TAU * i) / samples
    if (isAngleDangerous(candidate, beams, true)) continue

    let minGap = Infinity
    for (const beam of beams) {
      const d = Math.abs(angleDelta(candidate, beam.angle)) - beam.halfWidth
      if (d < minGap) minGap = d
    }

    const travel = Math.abs(angleDelta(fromAngle, candidate))
    const homeDist = Math.abs(angleDelta(candidate, homeAngle))
    const crosses = pathCrossesBeam(fromAngle, candidate, beams)

    let crowd = 0
    for (const other of avoidAngles) {
      const sep = Math.abs(angleDelta(candidate, other))
      if (sep < 0.28) crowd += (0.28 - sep) * 4.5
    }

    // Prefer deep pockets near home that we can reach without crossing beams
    const score =
      minGap * 3.2 -
      travel * 1.35 -
      homeDist * 1.6 -
      crowd -
      (crosses ? 12 : 0)

    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  if (bestScore === -Infinity || pathCrossesBeam(fromAngle, best, beams)) {
    // Fall back: nearest gap mid we can reach, else home
    const homes = safeGapHomes(beams)
    let fallback = homeAngle
    let fallbackTravel = Infinity
    for (const mid of homes) {
      if (pathCrossesBeam(fromAngle, mid, beams)) continue
      const t = Math.abs(angleDelta(fromAngle, mid))
      if (t < fallbackTravel) {
        fallbackTravel = t
        fallback = mid
      }
    }
    return fallback
  }

  return best
}

function clearanceAt(angle: number, beams: LaserBeam[]): number {
  let minGap = Infinity
  for (const beam of beams) {
    const d = Math.abs(angleDelta(angle, beam.angle)) - beam.halfWidth
    if (d < minGap) minGap = d
  }
  return Number.isFinite(minGap) ? minGap : Math.PI
}

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

  const lookAhead = 0.32 + aggression * 0.2
  const futureBeams = projectBeams(beams, lookAhead, speedScale)
  const nearFuture = projectBeams(beams, 0.16, speedScale)
  const urgent =
    isAngleDangerous(dodger.angle, nearFuture) ||
    clearanceAt(dodger.angle, futureBeams) < 0.14

  const maxOmega = (2.6 + aggression * 2.2) * dodger.skill * (urgent ? 1.35 : 1)
  let accel = (12 + aggression * 9) * dodger.skill * (urgent ? 1.45 : 1)
  if (dodger.stun > 0) accel *= 0.25

  const avoidAngles = peers
    .filter((p) => p.alive && p.id !== dodger.id)
    .map((p) => p.angle)

  // When urgent, prefer nearest safe pocket over a compromised home slot
  const preferred = urgent ? dodger.angle : dodger.homeAngle
  let target = findSafeTarget(
    dodger.angle,
    futureBeams,
    preferred,
    avoidAngles,
  )

  // Soft separation — push away from piled peers (keep result safe)
  for (const peer of peers) {
    if (!peer.alive || peer.id === dodger.id) continue
    const sep = angleDelta(dodger.angle, peer.angle)
    const abs = Math.abs(sep)
    if (abs > 0.001 && abs < 0.26) {
      const pushed = normalizeAngle(
        target + Math.sign(sep) * (0.26 - abs) * 1.8,
      )
      if (
        !isAngleDangerous(pushed, futureBeams, true) &&
        !pathCrossesBeam(dodger.angle, pushed, futureBeams)
      ) {
        target = pushed
      }
    }
  }

  // When safe, patrol gently around home instead of freezing on the mid-gap
  const gap = clearanceAt(dodger.angle, futureBeams)
  if (!urgent && gap > 0.22) {
    const patrol =
      Math.sin(dodger.angle * 2.7 + dodger.homeAngle * 5 + pressure * 3) * 0.16
    const patrolTarget = normalizeAngle(dodger.homeAngle + patrol)
    if (!pathCrossesBeam(dodger.angle, patrolTarget, futureBeams)) {
      target = patrolTarget
    } else if (!pathCrossesBeam(dodger.angle, dodger.homeAngle, futureBeams)) {
      target = dodger.homeAngle
    }
  }

  // Mistakes: brief stun or small jitter — never aim into a beam
  const mistakeChance =
    mistakeBias * 0.55 + pressure * 0.12 * (1.1 - dodger.skill)
  if (Math.random() < mistakeChance * dt * 1.4) {
    if (Math.random() < 0.5) {
      dodger.stun = 0.12 + Math.random() * 0.18
    } else {
      const nudge = (Math.random() - 0.5) * 0.28
      const nudged = normalizeAngle(target + nudge)
      if (
        !isAngleDangerous(nudged, futureBeams, true) &&
        !pathCrossesBeam(dodger.angle, nudged, futureBeams)
      ) {
        target = nudged
      }
    }
  }

  const delta = angleDelta(dodger.angle, target)
  const gain = urgent ? 7.0 : 4.6
  let desiredOmega = Math.max(-maxOmega, Math.min(maxOmega, -delta * gain))

  // If shortest path crosses a beam, flee the long way around
  if (
    pathCrossesBeam(dodger.angle, target, futureBeams) &&
    Math.abs(delta) > 0.05
  ) {
    desiredOmega = Math.sign(delta) * maxOmega * 0.95
  }

  const diff = desiredOmega - dodger.omega
  dodger.omega += Math.max(-accel * dt, Math.min(accel * dt, diff))
  dodger.angle = normalizeAngle(dodger.angle + dodger.omega * dt)

  if (Math.abs(dodger.omega) > maxOmega) {
    dodger.omega = Math.sign(dodger.omega) * maxOmega
  }

  dodger.trail.push(dodger.angle)
  if (dodger.trail.length > TRAIL_LENGTH) dodger.trail.shift()
}

export function stepBeams(beams: LaserBeam[], dt: number, speedScale: number): void {
  for (const beam of beams) {
    beam.angle = normalizeAngle(beam.angle + beam.angularSpeed * speedScale * dt)
    if (beam.length < beam.targetLength) {
      beam.length = Math.min(beam.targetLength, beam.length + dt * 0.55)
    }
    if (beam.pulse > 0) beam.pulse = Math.max(0, beam.pulse - dt * 2.5)
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

    const pos = ringPoint(dodger.angle)
    let hit = false
    let near = false
    let worstClearance = Infinity

    for (const beam of beams) {
      if (beam.length < BEAM_LETHAL_LENGTH) continue
      const d = Math.abs(angleDelta(dodger.angle, beam.angle))
      const lethal = beam.halfWidth + HIT_HALF_WIDTH_PAD
      const clearance = d - lethal
      if (clearance < worstClearance) worstClearance = clearance
      if (d <= lethal) {
        hit = true
      } else if (d <= lethal + NEAR_MISS_PAD) {
        near = true
      }
    }

    // Grace after spawn — still report near-misses for spectacle
    if (hit && dodger.grace > 0) {
      hit = false
      near = true
    }

    if (hit) {
      pending.push({ dodger, clearance: worstClearance })
      continue
    }

    if (near && dodger.nearMissCooldown <= 0) {
      dodger.nearMissCooldown = 0.55
      events.push({ kind: 'nearMiss', dodgerId: dodger.id, x: pos.x, y: pos.y })
    }
  }

  // Never wipe the field in one frame — spare the least-centered as last standing
  const aliveBefore = dodgers.filter((d) => d.alive).length
  let toKill = pending
  if (pending.length > 0 && pending.length >= aliveBefore) {
    toKill = [...pending]
      .sort((a, b) => a.clearance - b.clearance)
      .slice(0, Math.max(0, aliveBefore - 1))
  }

  for (const { dodger } of toKill) {
    const pos = ringPoint(dodger.angle)
    dodger.alive = false
    dodger.omega = 0
    spawnBurst(particles, pos.x, pos.y, dodger.color, 18)
    events.push({ kind: 'zap', dodgerId: dodger.id, x: pos.x, y: pos.y })
    events.push({ kind: 'elim', dodgerId: dodger.id, x: pos.x, y: pos.y })
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

export function spawnExtraBeam(beams: LaserBeam[]): LaserBeam | null {
  if (beams.length >= 6) return null
  const id = beams.reduce((m, b) => Math.max(m, b.id), 0) + 1
  const sign = Math.random() < 0.5 ? -1 : 1
  const beam: LaserBeam = {
    id,
    angle: Math.random() * TAU,
    angularSpeed: sign * (0.75 + Math.random() * 0.55),
    halfWidth: 0.04,
    length: BEAM_SPAWN_LENGTH * 0.55,
    targetLength: 1,
    color: BEAM_COLORS[id % BEAM_COLORS.length],
    pulse: 1,
  }
  beams.push(beam)
  return beam
}

export function reverseBeams(beams: LaserBeam[]) {
  for (const beam of beams) {
    beam.angularSpeed *= -1
    beam.pulse = 1
  }
}

export function narrowBeams(beams: LaserBeam[], factor = 0.82) {
  for (const beam of beams) {
    // Narrowing safe wedges = widening beams
    beam.halfWidth = Math.min(0.12, beam.halfWidth / factor)
    beam.pulse = 0.7
  }
}

export function spikeBeamSpeed(beams: LaserBeam[], factor = 1.55) {
  for (const beam of beams) {
    beam.angularSpeed *= factor
    beam.pulse = 0.85
  }
}

export function dodgerRadius(): number {
  return DODGER_SIZE / 2
}

export function arenaEdge(): number {
  return ARENA_RADIUS
}

export type { DodgerId }
