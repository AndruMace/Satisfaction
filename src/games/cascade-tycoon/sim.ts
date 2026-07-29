import { VIEW_WIDTH } from '../../shared/types'
import { formatMoney } from './format'
import {
  AUTO_BUY_ORDER,
  COMBO_BIN_MIN,
  COMBO_BREAK_MAX,
  COMBO_TIMEOUT_SEC,
  MONEY_GOAL,
  NEAR_MISS_EARNED,
  PEG_CUE_COOLDOWN,
  runLimitForGoal,
  START_BURST,
} from './shorts'
import {
  dropIntervalFor,
  DEFAULT_UPGRADES,
  restitutionFor,
  UPGRADE_DEFS,
  upgradeCost,
} from './upgrades'
import {
  BALL_RADIUS,
  BASE_RESTITUTION,
  type AudioCue,
  type Ball,
  type Bin,
  BUMPER_IMPULSE,
  BUMPER_PAY,
  BUMPER_RADIUS,
  type CascadePhase,
  type CascadeSnapshot,
  type Emitter,
  GRAVITY,
  type Peg,
  PEG_RADIUS,
  type PayoutPopup,
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
let nextPopupId = 1

export type CascadeWorld = {
  phase: CascadePhase
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
  manualCooldown: number
  runTime: number
  moneyGoal: number
  runLimitSec: number
  combo: number
  bestCombo: number
  comboTimer: number
  shake: number
  flash: number
  banner: string | null
  bannerLife: number
  popups: PayoutPopup[]
  pegCueCooldown: number
  lastCue: AudioCue | null
  cueSeq: number
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

function emitCue(world: CascadeWorld, cue: AudioCue) {
  world.lastCue = cue
  world.cueSeq += 1
}

export function createWorld(moneyGoal = MONEY_GOAL): CascadeWorld {
  const bins = createBins()
  const pegs = createPegGrid()
  const emitters = [createEmitter(VIEW_WIDTH * 0.5)]
  const goal = Math.max(1, Math.floor(moneyGoal))
  return {
    phase: 'ready',
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
    runTime: 0,
    moneyGoal: goal,
    runLimitSec: runLimitForGoal(goal),
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    shake: 0,
    flash: 0,
    banner: 'HIT $' + formatMoney(goal),
    bannerLife: 0,
    popups: [],
    pegCueCooldown: 0,
    lastCue: null,
    cueSeq: 0,
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

export function spawnBall(world: CascadeWorld, x: number, y = ZONE_TOP + 8): Ball {
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

/** Click-to-drop from spawner ceiling — only while running. */
export function tryManualDrop(world: CascadeWorld, x: number): boolean {
  if (world.phase !== 'running') return false
  if (world.manualCooldown > 0) return false
  spawnBall(world, x)
  world.manualCooldown = 0.12
  return true
}

export function startRun(world: CascadeWorld, moneyGoal?: number): void {
  const goal = moneyGoal ?? world.moneyGoal
  const fresh = createWorld(goal)
  Object.assign(world, fresh)
  world.phase = 'running'
  world.banner = 'HIT $' + formatMoney(goal)
  world.bannerLife = 2.2
  world.flash = 0.35
  emitCue(world, { kind: 'start' })

  const xs = evenlySpace(1)
  for (let i = 0; i < START_BURST; i++) {
    spawnBall(world, xs[0] + (Math.random() - 0.5) * 30)
  }
}

export function resetToReady(world: CascadeWorld, moneyGoal?: number): void {
  const fresh = createWorld(moneyGoal ?? world.moneyGoal)
  Object.assign(world, fresh)
}

export function resetWorld(world: CascadeWorld, moneyGoal?: number): void {
  resetToReady(world, moneyGoal)
}

function decayVfx(world: CascadeWorld, dt: number) {
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 2.4)
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.6)
  if (world.bannerLife > 0) {
    world.bannerLife = Math.max(0, world.bannerLife - dt)
    if (world.bannerLife <= 0 && world.phase !== 'finished') {
      world.banner = null
    }
  }
  for (const popup of world.popups) {
    popup.life -= dt
  }
  world.popups = world.popups.filter((p) => p.life > 0)

  for (const peg of world.pegs) {
    if (peg.flash > 0) peg.flash = Math.max(0, peg.flash - dt * 3.2)
  }
}

export function stepWorld(world: CascadeWorld, dt: number): void {
  const clamped = Math.min(0.033, Math.max(0, dt))

  if (world.phase === 'ready') {
    decayVfx(world, clamped)
    return
  }

  if (world.phase === 'finished') {
    decayVfx(world, clamped)
    // Keep banner visible on finish
    if (world.bannerLife < 0.5) world.bannerLife = 0.5
    return
  }

  if (world.manualCooldown > 0) {
    world.manualCooldown = Math.max(0, world.manualCooldown - clamped)
  }
  if (world.pegCueCooldown > 0) {
    world.pegCueCooldown = Math.max(0, world.pegCueCooldown - clamped)
  }

  // running
  world.runTime += clamped

  for (const emitter of world.emitters) {
    emitter.cooldown -= clamped
    if (emitter.cooldown <= 0) {
      spawnBall(world, emitter.x)
      emitter.cooldown = world.dropInterval * (0.85 + Math.random() * 0.3)
    }
  }

  stepPhysics(world, clamped)
  stepAutoBuy(world)
  stepComboTimeout(world, clamped)
  decayVfx(world, clamped)

  if (
    world.treasury >= world.moneyGoal ||
    world.runTime >= world.runLimitSec
  ) {
    finishRun(world)
  }
}

function stepPhysics(world: CascadeWorld, dt: number) {
  for (const peg of world.pegs) {
    if (peg.flash > 0) peg.flash = Math.max(0, peg.flash - dt * 3.2)
  }

  for (const ball of world.balls) {
    if (!ball.alive) continue
    integrateBall(world, ball, dt)
  }

  world.balls = world.balls.filter((b) => b.alive)
  if (world.balls.length > 120) {
    world.balls.splice(0, world.balls.length - 120)
  }
}

function stepComboTimeout(world: CascadeWorld, dt: number) {
  if (world.combo <= 0) return
  world.comboTimer -= dt
  if (world.comboTimer <= 0) {
    world.combo = 0
  }
}

function stepAutoBuy(world: CascadeWorld) {
  for (const id of AUTO_BUY_ORDER) {
    const def = UPGRADE_DEFS.find((d) => d.id === id)!
    const level = world.upgrades[id]
    if (level >= def.maxLevel) continue
    const cost = upgradeCost(def, level)
    if (world.treasury < cost) continue
    if (buyUpgrade(world, id, cost)) {
      emitCue(world, { kind: 'upgrade' })
      world.banner = def.label.toUpperCase()
      world.bannerLife = 1.1
      // One buy per tick keeps escalation readable
      return
    }
  }
}

function finishRun(world: CascadeWorld) {
  if (world.phase === 'finished') return
  world.phase = 'finished'
  world.banner = `RUN COMPLETE · $${formatMoney(world.treasury)}`
  world.bannerLife = 8
  world.flash = 0.5
  world.shake = 0.4
  emitCue(world, { kind: 'win' })
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
    if (world.pegCueCooldown <= 0) {
      emitCue(world, { kind: 'bumper' })
      world.pegCueCooldown = PEG_CUE_COOLDOWN * 0.6
    }
  } else {
    ball.earned += STANDARD_PAY
    peg.flash = 0.7
    if (world.pegCueCooldown <= 0) {
      emitCue(world, { kind: 'peg' })
      world.pegCueCooldown = PEG_CUE_COOLDOWN
    }
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

  const cx = (bin.x0 + bin.x1) / 2
  const isJackpot = bin.multiplier >= 50
  const isHigh = bin.multiplier >= COMBO_BIN_MIN

  if (payout > 0) {
    world.popups.push({
      id: nextPopupId++,
      x: cx,
      y: ZONE_BINS - 12,
      text: `+$${formatMoney(payout)}`,
      life: isJackpot ? 1.4 : 0.85,
      maxLife: isJackpot ? 1.4 : 0.85,
      jackpot: isJackpot,
    })
  }

  // Near-miss: 10× bins flanking the 50× with a rich ball
  if (
    bin.multiplier === 10 &&
    ball.earned >= NEAR_MISS_EARNED &&
    (bin.id === 3 || bin.id === 5)
  ) {
    emitCue(world, { kind: 'nearMiss' })
    world.shake = Math.max(world.shake, 0.25)
  }

  if (isJackpot) {
    world.shake = Math.max(world.shake, 0.7)
    world.flash = Math.max(world.flash, 0.55)
    emitCue(world, { kind: 'jackpot', mult: bin.multiplier })
    world.banner = 'JACKPOT 50×'
    world.bannerLife = 1.4
  }

  if (bin.multiplier <= COMBO_BREAK_MAX) {
    world.combo = 0
    world.comboTimer = 0
  } else if (isHigh) {
    world.combo += 1
    world.comboTimer = COMBO_TIMEOUT_SEC
    if (world.combo > world.bestCombo) world.bestCombo = world.combo
    if (world.combo >= 2) {
      emitCue(world, { kind: 'combo', n: world.combo })
    }
  }
}

export function buyUpgrade(
  world: CascadeWorld,
  id: UpgradeId,
  cost: number,
): boolean {
  if (world.phase !== 'running') return false
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

export function snapshot(world: CascadeWorld): CascadeSnapshot {
  const timeLeft = Math.max(0, world.runLimitSec - world.runTime)
  return {
    phase: world.phase,
    treasury: world.treasury,
    pegs: world.pegs.map((p) => ({ ...p })),
    balls: world.balls.map((b) => ({ ...b })),
    bins: world.bins,
    emitters: world.emitters.map((e) => ({ ...e })),
    upgrades: { ...world.upgrades },
    dropInterval: world.dropInterval,
    restitution: world.restitution,
    ballsDropped: world.ballsDropped,
    lastPayout: world.lastPayout,
    runTime: world.runTime,
    moneyGoal: world.moneyGoal,
    runLimitSec: world.runLimitSec,
    combo: world.combo,
    bestCombo: world.bestCombo,
    shake: world.shake,
    flash: world.flash,
    banner: world.banner,
    bannerLife: world.bannerLife,
    popups: world.popups.map((p) => ({ ...p })),
    timeLeft,
    lastCue: world.lastCue,
    cueSeq: world.cueSeq,
  }
}
