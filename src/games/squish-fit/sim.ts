import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import {
  CONSTRAINT_ITERS,
  EDGE_STIFF,
  GLOBAL_DAMP,
  GRAVITY,
  MAX_PARTICLE_SPEED,
  PARTICLE_RADIUS,
  PRESSURE,
  type QueueItem,
  type ShapeKind,
  type SoftBody,
  type SoftParticle,
  type SquishPhase,
  type SquishSnapshot,
  SUBSTEPS,
  type WallSeg,
  WIN_FILL,
} from './types'

let nextBodyId = 1

const PALETTE: Array<{ color: string; glow: string }> = [
  { color: '#ff5ca8', glow: '#ff9fd0' },
  { color: '#5ce1ff', glow: '#a8f0ff' },
  { color: '#b8f55a', glow: '#dcff9a' },
  { color: '#ffb347', glow: '#ffd59a' },
  { color: '#c084fc', glow: '#e0b8ff' },
  { color: '#ff6b6b', glow: '#ffb0b0' },
]

export type SquishWorld = {
  phase: SquishPhase
  bodies: SoftBody[]
  walls: WallSeg[]
  /** Closed polygon for containment (includes rim). */
  jarPoly: Array<{ x: number; y: number }>
  jar: JarGeom
  queue: QueueItem[]
  lidY: number
  lidTarget: number
  lidClosed: boolean
  fillRatio: number
  stampLife: number
  nextDropIn: number
  dropped: number
  total: number
  settleTimer: number
  auto: boolean
}

type JarGeom = {
  rimY: number
  rimLeft: number
  rimRight: number
  floorY: number
  area: number
  cx: number
  cy: number
}

/** Irregular glass vase — wider belly, pinched neck, open rim. */
export function buildJar(): {
  walls: WallSeg[]
  jarPoly: Array<{ x: number; y: number }>
  jar: JarGeom
} {
  const cx = VIEW_WIDTH / 2
  // Clockwise from top-left rim around the jar and back across the rim
  const jarPoly: Array<{ x: number; y: number }> = [
    { x: cx - 96, y: 230 },
    { x: cx - 112, y: 310 },
    { x: cx - 132, y: 410 },
    { x: cx - 146, y: 520 },
    { x: cx - 140, y: 620 },
    { x: cx - 120, y: 710 },
    { x: cx - 80, y: 768 },
    { x: cx - 28, y: 788 },
    { x: cx + 28, y: 788 },
    { x: cx + 80, y: 768 },
    { x: cx + 120, y: 710 },
    { x: cx + 140, y: 620 },
    { x: cx + 146, y: 520 },
    { x: cx + 132, y: 410 },
    { x: cx + 112, y: 310 },
    { x: cx + 96, y: 230 },
  ]

  // Visible glass walls = everything except the rim chord
  const walls: WallSeg[] = []
  for (let i = 0; i < jarPoly.length - 1; i++) {
    walls.push({
      ax: jarPoly[i].x,
      ay: jarPoly[i].y,
      bx: jarPoly[i + 1].x,
      by: jarPoly[i + 1].y,
    })
  }

  const jar: JarGeom = {
    rimY: 230,
    rimLeft: cx - 96,
    rimRight: cx + 96,
    floorY: 788,
    area: polygonArea(jarPoly),
    cx,
    cy: 520,
  }
  return { walls, jarPoly, jar }
}

function polygonArea(pts: Array<{ x: number; y: number }>): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(a) * 0.5
}

export function createQueue(count = 7): QueueItem[] {
  const kinds: ShapeKind[] = [
    'blob',
    'squircle',
    'bean',
    'pill',
    'tri',
    'blob',
    'squircle',
  ]
  const queue: QueueItem[] = []
  for (let i = 0; i < count; i++) {
    const pal = PALETTE[i % PALETTE.length]
    const isLast = i === count - 1
    queue.push({
      kind: kinds[i % kinds.length],
      color: pal.color,
      glow: pal.glow,
      // Sized so ~7 gels pack the jar without needing chaos
      scale: isLast ? 1.72 : 1.42 + (i % 3) * 0.08,
    })
  }
  return queue
}

export function createWorld(): SquishWorld {
  const { walls, jarPoly, jar } = buildJar()
  const queue = createQueue(7)
  return {
    phase: 'ready',
    bodies: [],
    walls,
    jarPoly,
    jar,
    queue,
    lidY: jar.rimY - 36,
    lidTarget: jar.rimY - 36,
    lidClosed: false,
    fillRatio: 0,
    stampLife: 0,
    nextDropIn: 0.7,
    dropped: 0,
    total: queue.length,
    settleTimer: 0,
    auto: true,
  }
}

export function resetWorld(world: SquishWorld): void {
  const auto = world.auto
  Object.assign(world, createWorld())
  world.auto = auto
}

export function snapshot(world: SquishWorld): SquishSnapshot {
  return {
    phase: world.phase,
    bodies: world.bodies,
    walls: world.walls,
    queue: world.queue,
    lidY: world.lidY,
    lidTarget: world.lidTarget,
    fillRatio: world.fillRatio,
    stampLife: world.stampLife,
    nextDropIn: world.nextDropIn,
    dropped: world.dropped,
    total: world.total,
  }
}

function makeParticle(x: number, y: number): SoftParticle {
  return { x, y, px: x, py: y }
}

function shapeOutline(
  kind: ShapeKind,
  cx: number,
  cy: number,
  scale: number,
): SoftParticle[] {
  const pts: SoftParticle[] = []
  const n = kind === 'tri' ? 10 : kind === 'pill' ? 14 : 12
  const r = 34 * scale

  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    let x = Math.cos(t)
    let y = Math.sin(t)

    if (kind === 'squircle') {
      const k = 0.72
      x = Math.sign(x) * Math.pow(Math.abs(x), k)
      y = Math.sign(y) * Math.pow(Math.abs(y), k)
    } else if (kind === 'bean') {
      x *= 1.12
      y *= 0.8
      x += Math.sin(t * 2) * 0.1
    } else if (kind === 'pill') {
      x *= 1.3
      y *= 0.65
    } else if (kind === 'tri') {
      const sector = Math.floor(
        ((t + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / 3),
      )
      const a0 = -Math.PI / 2 + sector * ((Math.PI * 2) / 3)
      const a1 = a0 + (Math.PI * 2) / 3
      const u =
        (((t + Math.PI / 2 + Math.PI * 2) % ((Math.PI * 2) / 3)) /
          ((Math.PI * 2) / 3))
      x = Math.cos(a0) * (1 - u) + Math.cos(a1) * u
      y = Math.sin(a0) * (1 - u) + Math.sin(a1) * u
      const m = Math.hypot(x, y) || 1
      x /= m
      y /= m
    }

    pts.push(makeParticle(cx + x * r, cy + y * r))
  }
  return pts
}

function restMetrics(
  particles: SoftParticle[],
): { edgeRest: number; restArea: number } {
  let edge = 0
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]
    const b = particles[(i + 1) % particles.length]
    edge += Math.hypot(a.x - b.x, a.y - b.y)
  }
  edge /= particles.length
  return { edgeRest: edge, restArea: Math.max(120, polygonArea(particles)) }
}

export function spawnBody(
  world: SquishWorld,
  item: QueueItem,
  x?: number,
): SoftBody {
  const span = world.jar.rimRight - world.jar.rimLeft - 50
  const cx =
    x ?? world.jar.rimLeft + 25 + Math.random() * Math.max(10, span)
  const cy = world.jar.rimY - 55
  const particles = shapeOutline(item.kind, cx, cy, item.scale)
  const { edgeRest, restArea } = restMetrics(particles)
  const body: SoftBody = {
    id: nextBodyId++,
    color: item.color,
    glow: item.glow,
    particles,
    edgeRest,
    // Mild under-pressure so gels compress into gaps without exploding
    restArea: restArea * 0.88,
    settled: false,
  }
  world.bodies.push(body)
  return body
}

export function dropNext(world: SquishWorld, x?: number): boolean {
  if (
    world.phase === 'won' ||
    world.phase === 'sealing' ||
    world.phase === 'overflow'
  ) {
    return false
  }
  if (world.queue.length === 0) return false

  const item = world.queue.shift()!
  spawnBody(world, item, x)
  world.dropped += 1
  world.nextDropIn =
    world.queue.length === 0
      ? 0
      : world.queue.length <= 2
        ? 1.15
        : world.fillRatio > 0.45
          ? 0.85
          : 0.55
  world.settleTimer = 0
  updatePhaseFromFill(world)
  return true
}

function updatePhaseFromFill(world: SquishWorld): void {
  if (world.phase === 'sealing' || world.phase === 'won' || world.phase === 'overflow') {
    return
  }
  if (world.fillRatio >= 0.55 || world.queue.length <= 2) {
    world.phase = 'crowded'
  } else if (world.dropped > 0) {
    world.phase = 'filling'
  }
}

export function stepWorld(world: SquishWorld, dt: number): void {
  const clamped = Math.min(0.033, Math.max(0, dt))

  if (world.stampLife > 0) {
    world.stampLife = Math.max(0, world.stampLife - clamped)
  }

  if (
    world.auto &&
    world.queue.length > 0 &&
    world.phase !== 'sealing' &&
    world.phase !== 'won' &&
    world.phase !== 'overflow'
  ) {
    if (world.phase === 'ready') world.phase = 'filling'
    world.nextDropIn -= clamped
    if (world.nextDropIn <= 0) dropNext(world)
  }

  const h = clamped / SUBSTEPS
  for (let s = 0; s < SUBSTEPS; s++) {
    integrate(world, h)
    for (let k = 0; k < CONSTRAINT_ITERS; k++) {
      for (const body of world.bodies) {
        solveEdges(body)
        solvePressure(body)
      }
      collideBodies(world)
      containInJar(world)
      collideLid(world)
    }
    clampSpeeds(world)
  }

  updateFill(world)
  updatePhaseFromFill(world)
  updateSettlement(world, clamped)
  updateLid(world, clamped)
}

function integrate(_world: SquishWorld, dt: number): void {
  const g = GRAVITY * dt * dt
  for (const body of _world.bodies) {
    for (const p of body.particles) {
      let vx = (p.x - p.px) * GLOBAL_DAMP
      let vy = (p.y - p.py) * GLOBAL_DAMP
      p.px = p.x
      p.py = p.y
      p.x += vx
      p.y += vy + g
    }
  }
}

function clampSpeeds(world: SquishWorld): void {
  const max = MAX_PARTICLE_SPEED
  const max2 = max * max
  for (const body of world.bodies) {
    for (const p of body.particles) {
      const vx = p.x - p.px
      const vy = p.y - p.py
      const s2 = vx * vx + vy * vy
      if (s2 <= max2) continue
      const s = Math.sqrt(s2)
      const k = max / s
      p.px = p.x - vx * k
      p.py = p.y - vy * k
    }
  }
}

function solveEdges(body: SoftBody): void {
  const pts = body.particles
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy) || 1
    const diff = ((dist - body.edgeRest) / dist) * 0.5 * EDGE_STIFF
    a.x += dx * diff
    a.y += dy * diff
    b.x -= dx * diff
    b.y -= dy * diff
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + Math.floor(n / 2)) % n]
    const rest = body.edgeRest * (n / Math.PI) * 0.9
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy) || 1
    const diff = ((dist - rest) / dist) * 0.5 * EDGE_STIFF * 0.25
    a.x += dx * diff
    a.y += dy * diff
    b.x -= dx * diff
    b.y -= dy * diff
  }
}

function solvePressure(body: SoftBody): void {
  const pts = body.particles
  const area = Math.max(60, polygonArea(pts))
  const error = (body.restArea - area) / body.restArea
  // Hard clamp — this was the main explosion source
  const force = Math.max(-2.2, Math.min(2.2, error * PRESSURE * 0.00022))
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    pts[i].x += (-dy / len) * force
    pts[i].y += (dx / len) * force
  }
}

function collideBodies(world: SquishWorld): void {
  const bodies = world.bodies
  const minDist = PARTICLE_RADIUS * 1.85
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const A = bodies[i].particles
      const B = bodies[j].particles
      for (const a of A) {
        for (const b of B) {
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d2 = dx * dx + dy * dy
          if (d2 >= minDist * minDist || d2 < 1e-8) continue
          const d = Math.sqrt(d2)
          const push = ((minDist - d) / d) * 0.4
          a.x -= dx * push
          a.y -= dy * push
          b.x += dx * push
          b.y += dy * push
        }
      }
    }
  }
}

/**
 * Robust jar containment:
 * - Above the rim: free (falling in)
 * - At/below rim: must stay inside closed jar polygon; project back if outside
 * - One-way rim: cannot exit upward once fully inside
 */
function containInJar(world: SquishWorld): void {
  const { jar, jarPoly } = world
  const rim = jar.rimY + 6

  for (const body of world.bodies) {
    for (const p of body.particles) {
      // Screen floor safety
      if (p.y > VIEW_HEIGHT - 6) {
        p.y = VIEW_HEIGHT - 6
        p.py = p.y
      }

      // Still above the mouth — only gently guide toward opening
      if (p.y < rim) {
        if (p.x < jar.rimLeft + 4) {
          p.x = jar.rimLeft + 4
        } else if (p.x > jar.rimRight - 4) {
          p.x = jar.rimRight - 4
        }
        continue
      }

      // Inside vertical band of jar — keep inside polygon
      if (!pointInPolygon(p.x, p.y, jarPoly)) {
        const nearest = nearestOnPolygon(p.x, p.y, jarPoly)
        p.x = nearest.x
        p.y = nearest.y
        // Kill outward velocity
        const vx = p.x - p.px
        const vy = p.y - p.py
        const inwardX = jar.cx - p.x
        const inwardY = jar.cy - p.y
        const dot = vx * inwardX + vy * inwardY
        if (dot < 0) {
          p.px = p.x
          p.py = p.y
        }
      }

      // One-way lid line at rim once inside
      if (p.y < rim) {
        p.y = rim
        if (p.py < p.y) p.py = p.y
      }
    }
  }
}

function pointInPolygon(
  x: number,
  y: number,
  poly: Array<{ x: number; y: number }>,
): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function nearestOnPolygon(
  x: number,
  y: number,
  poly: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  let best = { x: poly[0].x, y: poly[0].y }
  let bestD = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = x - a.x
    const apy = y - a.y
    const ab2 = abx * abx + aby * aby || 1
    let t = (apx * abx + apy * aby) / ab2
    t = Math.max(0, Math.min(1, t))
    const cx = a.x + abx * t
    const cy = a.y + aby * t
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y)
    if (d < bestD) {
      bestD = d
      best = { x: cx, y: cy }
    }
  }
  // Nudge slightly inward toward jar center
  const nx = worldJarCx() - best.x
  const ny = worldJarCy() - best.y
  const len = Math.hypot(nx, ny) || 1
  return {
    x: best.x + (nx / len) * (PARTICLE_RADIUS + 1),
    y: best.y + (ny / len) * (PARTICLE_RADIUS + 1),
  }
}

function worldJarCx(): number {
  return VIEW_WIDTH / 2
}
function worldJarCy(): number {
  return 520
}

function collideLid(world: SquishWorld): void {
  if (!world.lidClosed && world.phase !== 'sealing' && world.phase !== 'won') {
    return
  }
  const y = world.lidY + 12
  for (const body of world.bodies) {
    for (const p of body.particles) {
      if (
        p.y < y + PARTICLE_RADIUS &&
        p.x > world.jar.rimLeft - 8 &&
        p.x < world.jar.rimRight + 8
      ) {
        p.y = y + PARTICLE_RADIUS
        p.py = Math.min(p.py, p.y)
      }
    }
  }
}

function updateFill(world: SquishWorld): void {
  let area = 0
  let insideParticles = 0
  let totalParticles = 0
  for (const body of world.bodies) {
    area += polygonArea(body.particles)
    for (const p of body.particles) {
      totalParticles += 1
      if (p.y >= world.jar.rimY && pointInPolygon(p.x, p.y, world.jarPoly)) {
        insideParticles += 1
      }
    }
  }
  // Capacity tuned so a packed jar reads ~95–100%
  const capacity = world.jar.area * 0.3
  const areaFill = area / capacity
  const containFill = totalParticles > 0 ? insideParticles / totalParticles : 0
  world.fillRatio = Math.max(
    0,
    Math.min(1, areaFill * (0.25 + 0.75 * containFill)),
  )
}

function updateSettlement(world: SquishWorld, dt: number): void {
  let moving = 0
  for (const body of world.bodies) {
    let ke = 0
    for (const p of body.particles) {
      const vx = p.x - p.px
      const vy = p.y - p.py
      ke += vx * vx + vy * vy
    }
    // Average KE — constraint jitter otherwise never looks "settled"
    const avg = ke / Math.max(1, body.particles.length)
    body.settled = avg < 0.12
    if (!body.settled) moving += 1
  }

  if (
    world.queue.length === 0 &&
    world.dropped === world.total &&
    world.phase !== 'won' &&
    world.phase !== 'overflow' &&
    world.phase !== 'sealing'
  ) {
    world.settleTimer += dt
    const calm = moving <= 1
    if (calm && world.settleTimer > 0.9 && world.fillRatio >= WIN_FILL) {
      world.phase = 'sealing'
      world.lidTarget = world.jar.rimY + 4
      world.lidClosed = true
    } else if (world.settleTimer > 2.4 && world.fillRatio >= 0.78) {
      world.phase = 'sealing'
      world.lidTarget = world.jar.rimY + 4
      world.lidClosed = true
    }
  }
}

function updateLid(world: SquishWorld, dt: number): void {
  const dy = world.lidTarget - world.lidY
  world.lidY += dy * Math.min(1, dt * 2.8)

  if (world.phase === 'sealing' && Math.abs(world.lidTarget - world.lidY) < 1.5) {
    world.phase = 'won'
    world.stampLife = 3.2
    // Do NOT fake 100% — show real fill
  }
}

export function tryManualDrop(world: SquishWorld, x: number): boolean {
  if (
    world.queue.length > 0 &&
    world.phase !== 'sealing' &&
    world.phase !== 'won' &&
    world.phase !== 'overflow'
  ) {
    world.nextDropIn = 0
    return dropNext(world, x)
  }
  return false
}
