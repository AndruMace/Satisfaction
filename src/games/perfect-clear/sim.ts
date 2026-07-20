import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { getLevel, LEVELS } from './levels'
import {
  BURST_COUNT_MAX,
  BURST_COUNT_MIN,
  BURST_SPEED,
  type ClearNode,
  type ClearPhase,
  type ClearSnapshot,
  NODE_DEFAULT_SIZE,
  type Particle,
  type Spark,
  SPARK_FRICTION,
  SPARK_MAX_LIFE,
  SPARK_MIN_SPEED,
  SPARK_RADIUS,
  SPARK_SPEED,
} from './types'

let nextNodeId = 1
let nextSparkId = 1

export type ClearWorld = {
  levelIndex: number
  levelId: string
  levelName: string
  hint: string
  phase: ClearPhase
  nodes: ClearNode[]
  sparks: Spark[]
  particles: Particle[]
  total: number
  destroyed: number
  stampLife: number
  failLife: number
  /** Settle frames after last spark before declaring fail. */
  settle: number
}

export function createWorld(levelIndex = 0): ClearWorld {
  const level = getLevel(levelIndex)
  const nodes = level.nodes.map((n) => {
    const kind = n.kind ?? 'normal'
    const hp = kind === 'heavy' ? 2 : 1
    return {
      id: nextNodeId++,
      x: n.x,
      y: n.y,
      size: n.size ?? NODE_DEFAULT_SIZE,
      kind,
      hp,
      maxHp: hp,
      alive: true,
      flash: 0,
      hue: n.hue ?? 200,
    } satisfies ClearNode
  })

  return {
    levelIndex,
    levelId: level.id,
    levelName: level.name,
    hint: level.hint,
    phase: 'ready',
    nodes,
    sparks: [],
    particles: [],
    total: nodes.length,
    destroyed: 0,
    stampLife: 0,
    failLife: 0,
    settle: 0,
  }
}

export function remaining(world: ClearWorld): number {
  return world.nodes.reduce((n, node) => n + (node.alive ? 1 : 0), 0)
}

export function snapshot(world: ClearWorld): ClearSnapshot {
  return {
    levelId: world.levelId,
    levelName: world.levelName,
    phase: world.phase,
    nodes: world.nodes,
    sparks: world.sparks,
    particles: world.particles,
    remaining: remaining(world),
    total: world.total,
    destroyed: world.destroyed,
    stampLife: world.stampLife,
    failLife: world.failLife,
  }
}

export function resetLevel(world: ClearWorld): void {
  const fresh = createWorld(world.levelIndex)
  Object.assign(world, fresh)
}

export function nextLevel(world: ClearWorld): void {
  const fresh = createWorld(world.levelIndex + 1)
  Object.assign(world, fresh)
}

export function prevLevel(world: ClearWorld): void {
  const fresh = createWorld(world.levelIndex - 1)
  Object.assign(world, fresh)
}

export function levelCount(): number {
  return LEVELS.length
}

/**
 * One ignition per attempt: spawn a single spark at (x,y)
 * aimed toward the nearest living node.
 */
export function ignite(world: ClearWorld, x: number, y: number): boolean {
  if (world.phase !== 'ready') return false

  const px = Math.max(8, Math.min(VIEW_WIDTH - 8, x))
  const py = Math.max(8, Math.min(VIEW_HEIGHT - 8, y))

  let nearest: ClearNode | null = null
  let nearestD = Infinity
  for (const node of world.nodes) {
    if (!node.alive) continue
    const d = Math.hypot(node.x - px, node.y - py)
    if (d < nearestD) {
      nearestD = d
      nearest = node
    }
  }

  let vx = 0
  let vy = -SPARK_SPEED
  if (nearest) {
    const dx = nearest.x - px
    const dy = nearest.y - py
    const m = Math.hypot(dx, dy) || 1
    vx = (dx / m) * SPARK_SPEED
    vy = (dy / m) * SPARK_SPEED
  }

  world.sparks.push({
    id: nextSparkId++,
    x: px,
    y: py,
    vx,
    vy,
    radius: SPARK_RADIUS,
    life: SPARK_MAX_LIFE,
    hue: 50,
  })
  world.phase = 'cascading'
  world.settle = 0
  return true
}

export function stepWorld(world: ClearWorld, dt: number): void {
  const clamped = Math.min(0.033, Math.max(0, dt))

  if (world.stampLife > 0) {
    world.stampLife = Math.max(0, world.stampLife - clamped)
  }
  if (world.failLife > 0) {
    world.failLife = Math.max(0, world.failLife - clamped)
  }

  for (const node of world.nodes) {
    if (node.flash > 0) node.flash = Math.max(0, node.flash - clamped * 4)
  }

  stepParticles(world, clamped)

  if (world.phase !== 'cascading') return

  const born: Spark[] = []
  for (const spark of world.sparks) {
    stepSpark(world, spark, clamped, born)
  }
  if (born.length) world.sparks.push(...born)
  world.sparks = world.sparks.filter(
    (s) =>
      s.life > 0 &&
      Math.hypot(s.vx, s.vy) >= SPARK_MIN_SPEED &&
      s.x > -40 &&
      s.x < VIEW_WIDTH + 40 &&
      s.y > -40 &&
      s.y < VIEW_HEIGHT + 40,
  )

  // Soft cap runaway chains
  if (world.sparks.length > 400) {
    world.sparks.splice(0, world.sparks.length - 400)
  }

  const left = remaining(world)
  if (left === 0) {
    world.phase = 'cleared'
    world.stampLife = 2.8
    world.sparks = []
    return
  }

  if (world.sparks.length === 0) {
    world.settle += clamped
    if (world.settle > 0.35) {
      world.phase = 'failed'
      world.failLife = 2.2
    }
  } else {
    world.settle = 0
  }
}

function stepSpark(
  world: ClearWorld,
  spark: Spark,
  dt: number,
  born: Spark[],
): void {
  spark.life -= dt
  const damp = Math.exp(-SPARK_FRICTION * dt)
  spark.vx *= damp
  spark.vy *= damp
  spark.x += spark.vx * dt
  spark.y += spark.vy * dt

  for (const node of world.nodes) {
    if (!node.alive) continue
    if (!sparkHitsNode(spark, node)) continue

    // Consume this spark on impact
    spark.life = 0
    spark.vx = 0
    spark.vy = 0

    node.hp -= 1
    node.flash = 1
    if (node.hp > 0) {
      // Chipped heavy node — small glitter only
      spawnBurstParticles(world, node.x, node.y, node.hue, 6)
      break
    }

    node.alive = false
    world.destroyed += 1
    spawnBurstParticles(world, node.x, node.y, node.hue, 14)
    emitSparks(world, node, born)
    break
  }
}

function sparkHitsNode(spark: Spark, node: ClearNode): boolean {
  const half = node.size * 0.5
  const closestX = Math.max(node.x - half, Math.min(spark.x, node.x + half))
  const closestY = Math.max(node.y - half, Math.min(spark.y, node.y + half))
  const dx = spark.x - closestX
  const dy = spark.y - closestY
  return dx * dx + dy * dy <= spark.radius * spark.radius
}

function emitSparks(world: ClearWorld, node: ClearNode, born: Spark[]): void {
  const count =
    BURST_COUNT_MIN +
    Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1))
  const base = Math.random() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    const a = base + (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.18
    const speed = BURST_SPEED * (0.85 + Math.random() * 0.3)
    born.push({
      id: nextSparkId++,
      x: node.x + Math.cos(a) * (node.size * 0.35),
      y: node.y + Math.sin(a) * (node.size * 0.35),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      radius: SPARK_RADIUS,
      life: SPARK_MAX_LIFE * (0.75 + Math.random() * 0.35),
      hue: node.hue + (Math.random() - 0.5) * 30,
    })
  }
}

function spawnBurstParticles(
  world: ClearWorld,
  x: number,
  y: number,
  hue: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 40 + Math.random() * 220
    const life = 0.25 + Math.random() * 0.45
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      maxLife: life,
      size: 1.5 + Math.random() * 3.5,
      hue,
    })
  }
  if (world.particles.length > 600) {
    world.particles.splice(0, world.particles.length - 600)
  }
}

function stepParticles(world: ClearWorld, dt: number): void {
  for (const p of world.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.96
    p.vy *= 0.96
  }
  world.particles = world.particles.filter((p) => p.life > 0)
}
