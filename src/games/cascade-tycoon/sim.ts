import { VIEW_WIDTH } from '../../shared/types'
import {
  dropIntervalFor,
  DEFAULT_UPGRADES,
  restitutionFor,
} from './upgrades'
import {
  BALL_RADIUS,
  BASE_RESTITUTION,
  type Ball,
  type Bin,
  BUMPER_IMPULSE,
  BUMPER_PAY,
  BUMPER_RADIUS,
  type CascadeSnapshot,
  type Emitter,
  GRAVITY,
  type Peg,
  PEG_RADIUS,
  STANDARD_PAY,
  type UpgradeId,
  type UpgradeState,
  WALL_RESTITUTION,
  ZONE_BINS,
  ZONE_TOP,
} from './types'

let nextBallId = 1
let nextPegId = 1
let nextEmitterId = 1

export type CascadeWorld = {
  treasury: number
  pegs: Peg[]
  balls: Ball[]
  bins: Bin[]
  emitters: Emitter[]
  upgrades: UpgradeState
  dropInterval: number
  restitution: number
  ballsDropped: number
  lastPayout: number
  /** Manual click cooldown so spam doesn't flood. */
  manualCooldown: number
}

const BIN_MULTS = [1, 2, 5, 10, 50, 10, 5, 2, 1]
const BIN_COLORS = [
  '#5c6bc0',
  '#42a5f5',
  '#26c6da',
  '#66bb6a',
  '#ffca28',
  '#66bb6a',
  '#26c6da',
  '#42a5f5',
  '#5c6bc0',
]

export function createWorld(): CascadeWorld {
  const bins = createBins()
  const pegs = createPegGrid()
  const emitters = [createEmitter(VIEW_WIDTH * 0.5)]
  return {
    treasury: 0,
    pegs,
    balls: [],
    bins,
    emitters,
    upgrades: { ...DEFAULT_UPGRADES },
    dropInterval: dropIntervalFor(0),
    restitution: restitutionFor(0),
    ballsDropped: 0,
    lastPayout: 0,
    manualCooldown: 0,
  }
}

function createBins(): Bin[] {
  const n = BIN_MULTS.length
  const w = VIEW_WIDTH / n
  return BIN_MULTS.map((multiplier, i) => ({
    id: i,
    x0: i * w,
    x1: (i + 1) * w,
    multiplier,
    color: BIN_COLORS[i],
  }))
}

/** Staggered honeycomb peg rows across the middle zone. */
function createPegGrid(): Peg[] {
  const pegs: Peg[] = []
  const cols = 9
  const rows = 12
  const top = ZONE_TOP + 36
  const bottom = ZONE_BINS - 28
  const rowGap = (bottom - top) / (rows - 1)
  const colGap = VIEW_WIDTH / (cols + 1)

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : colGap * 0.5
    const count = row % 2 === 0 ? cols : cols - 1
    for (let col = 0; col < count; col++) {
      const x = colGap + col * colGap + offset
      const y = top + row * rowGap
      const bumperSeed =
        (row === 7 && (col === 2 || col === count - 3)) ||
        (row === 9 && col === Math.floor(count / 2))
      pegs.push({
        id: nextPegId++,
        x,
        y,
        radius: bumperSeed ? BUMPER_RADIUS : PEG_RADIUS,
        kind: bumperSeed ? 'bumper' : 'standard',
        flash: 0,
      })
    }
  }
  return pegs
}

function createEmitter(x: number): Emitter {
  return {
    id: nextEmitterId++,
    x: Math.max(24, Math.min(VIEW_WIDTH - 24, x)),
    cooldown: 0.35 + Math.random() * 0.4,
  }
}

export function snapshot(world: CascadeWorld): CascadeSnapshot {
  return {
    treasury: world.treasury,
    pegs: world.pegs,
    balls: world.balls,
    bins: world.bins,
    emitters: world.emitters,
    upgrades: { ...world.upgrades },
    dropInterval: world.dropInterval,
    restitution: world.restitution,
    ballsDropped: world.ballsDropped,
    lastPayout: world.lastPayout,
  }
}

export function spawnBall(
  world: CascadeWorld,
  x: number,
  y = ZONE_TOP * 0.45,
): Ball {
  const jitter = (Math.random() - 0.5) * 18
  const ball: Ball = {
    id: nextBallId++,
    x: Math.max(
      BALL_RADIUS + 2,
      Math.min(VIEW_WIDTH - BALL_RADIUS - 2, x + jitter),
    ),
    y,
    vx: (Math.random() - 0.5) * 40,
    vy: 20 + Math.random() * 30,
    radius: BALL_RADIUS,
    earned: 0,
    alive: true,
  }
  world.balls.push(ball)
  world.ballsDropped += 1
  return ball
}

/** Phase 1 helper — click-to-drop from spawner ceiling. */
export function tryManualDrop(world: CascadeWorld, x: number): boolean {
  if (world.manualCooldown > 0) return false
  spawnBall(world, x)
  world.manualCooldown = 0.12
  return true
}

export function stepWorld(world: CascadeWorld, dt: number): void {
  const clamped = Math.min(0.033, Math.max(0, dt))
  if (world.manualCooldown > 0) {
    world.manualCooldown = Math.max(0, world.manualCooldown - clamped)
  }

  for (const emitter of world.emitters) {
    emitter.cooldown -= clamped
    if (emitter.cooldown <= 0) {
      spawnBall(world, emitter.x)
      emitter.cooldown = world.dropInterval * (0.85 + Math.random() * 0.3)
    }
  }

  for (const peg of world.pegs) {
    if (peg.flash > 0) peg.flash = Math.max(0, peg.flash - clamped * 3.2)
  }

  for (const ball of world.balls) {
    if (!ball.alive) continue
    integrateBall(world, ball, clamped)
  }

  world.balls = world.balls.filter((b) => b.alive)
  if (world.balls.length > 120) {
    world.balls.splice(0, world.balls.length - 120)
  }
}

function integrateBall(world: CascadeWorld, ball: Ball, dt: number): void {
  ball.vy += GRAVITY * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x < ball.radius) {
    ball.x = ball.radius
    ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION
  } else if (ball.x > VIEW_WIDTH - ball.radius) {
    ball.x = VIEW_WIDTH - ball.radius
    ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION
  }

  if (ball.y < ball.radius) {
    ball.y = ball.radius
    ball.vy = Math.abs(ball.vy) * 0.4
  }

  for (const peg of world.pegs) {
    resolvePegHit(world, ball, peg)
  }

  if (ball.y + ball.radius >= ZONE_BINS) {
    collectBall(world, ball)
  }
}

function resolvePegHit(world: CascadeWorld, ball: Ball, peg: Peg): void {
  const dx = ball.x - peg.x
  const dy = ball.y - peg.y
  const dist = Math.hypot(dx, dy)
  const minDist = ball.radius + peg.radius
  if (dist >= minDist || dist < 1e-6) return

  const nx = dx / dist
  const ny = dy / dist
  const overlap = minDist - dist
  ball.x += nx * overlap
  ball.y += ny * overlap

  const vn = ball.vx * nx + ball.vy * ny
  if (vn < 0) {
    const e = world.restitution || BASE_RESTITUTION
    ball.vx -= (1 + e) * vn * nx
    ball.vy -= (1 + e) * vn * ny
  }

  if (peg.kind === 'bumper') {
    const boost = BUMPER_IMPULSE * 0.55
    ball.vx += nx * (boost / 60)
    ball.vy += ny * (boost / 60)
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed < 40) {
      ball.vx += nx * 80
      ball.vy += ny * 80
    }
    ball.earned += BUMPER_PAY
    peg.flash = 1
  } else {
    ball.earned += STANDARD_PAY
    peg.flash = 0.7
  }

  ball.vx += (Math.random() - 0.5) * 28
}

function collectBall(world: CascadeWorld, ball: Ball): void {
  const bin =
    world.bins.find((b) => ball.x >= b.x0 && ball.x < b.x1) ??
    world.bins[world.bins.length - 1]
  const payout = Math.floor(ball.earned * bin.multiplier)
  world.treasury += payout
  world.lastPayout = payout
  ball.alive = false
  ball.y = ZONE_BINS + 40
}

export function buyUpgrade(
  world: CascadeWorld,
  id: UpgradeId,
  cost: number,
): boolean {
  if (world.treasury < cost) return false
  world.treasury -= cost
  world.upgrades[id] += 1

  if (id === 'emitter') {
    world.emitters.push(createEmitter(VIEW_WIDTH * 0.5))
    const xs = evenlySpace(world.emitters.length)
    for (let i = 0; i < world.emitters.length; i++) {
      world.emitters[i].x = xs[i]
    }
  } else if (id === 'cooldown') {
    world.dropInterval = dropIntervalFor(world.upgrades.cooldown)
  } else if (id === 'bounciness') {
    world.restitution = restitutionFor(world.upgrades.bounciness)
  } else if (id === 'bumper') {
    convertRandomPeg(world)
  }
  return true
}

function evenlySpace(count: number): number[] {
  if (count <= 1) return [VIEW_WIDTH * 0.5]
  const pad = 40
  const span = VIEW_WIDTH - pad * 2
  return Array.from(
    { length: count },
    (_, i) => pad + (span * i) / (count - 1),
  )
}

function convertRandomPeg(world: CascadeWorld): void {
  const standards = world.pegs.filter((p) => p.kind === 'standard')
  if (standards.length === 0) return
  const peg = standards[Math.floor(Math.random() * standards.length)]
  peg.kind = 'bumper'
  peg.radius = BUMPER_RADIUS
  peg.flash = 1
}

export function resetWorld(world: CascadeWorld): void {
  const fresh = createWorld()
  Object.assign(world, fresh)
}
