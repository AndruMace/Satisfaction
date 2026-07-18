import { PLAYER_PROFILES } from '../../shared/profiles'
import {
  AGENT_BASE_RADIUS,
  AGENT_BASE_SPEED,
  type Agent,
  type AgentId,
  BASE_MASS,
  type ClosingFloor,
  type Coin,
  COIN_RADIUS,
  type Deposit,
  GRAVITY,
  type GrabEvent,
  JUMP_SPEED,
  type LevelData,
  type MagnetWell,
  MASS_PER_COIN,
  type Particle,
  type Pit,
  type Platform,
  TRAIL_LENGTH,
  VACUUM_RADIUS,
} from './types'

export type PhysicsConfig = {
  greedWeight: number
  depositRequired: boolean
  magnetBoost: number
}

export function agentMass(agent: Agent, greedWeight: number): number {
  return BASE_MASS + agent.carried * MASS_PER_COIN * greedWeight
}

export function agentSpeed(mass: number): number {
  return AGENT_BASE_SPEED / (1 + (mass - 1) * 0.18)
}

export function agentJump(mass: number): number {
  return JUMP_SPEED / (1 + (mass - 1) * 0.22)
}

export function agentRadius(mass: number): number {
  return AGENT_BASE_RADIUS * (1 + Math.min(0.55, (mass - 1) * 0.045))
}

export function wealth(agent: Agent, depositRequired: boolean): number {
  return depositRequired ? agent.banked : agent.banked + agent.carried
}

export function cloneCoins(coins: Coin[]): Coin[] {
  return coins.map((c) => ({ ...c }))
}

export function createAgents(
  level: LevelData,
  playerCount: number,
): Agent[] {
  const count = Math.max(2, Math.min(6, playerCount))
  const agents: Agent[] = []
  for (let i = 0; i < count; i++) {
    const profile = PLAYER_PROFILES[i]
    const spawn = level.spawnPoints[i] ?? level.spawnPoints[level.spawnPoints.length - 1]
    agents.push({
      id: profile.id,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: AGENT_BASE_RADIUS,
      color: profile.color,
      alive: true,
      carried: 0,
      banked: 0,
      onGround: false,
      jumpCooldown: 0,
      dropIgnoreUntilY: null,
      targetCoinId: null,
      trail: [],
      fallFlash: 0,
    })
  }
  return agents
}

export function createClosingFloor(level: LevelData): ClosingFloor {
  return {
    y: level.floorStartY,
    speed: level.floorSpeed,
    active: false,
  }
}

function circleRectOverlap(
  cx: number,
  cy: number,
  r: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy <= r * r
}

function inRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function pushParticle(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = 40 + Math.random() * 120
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.25 + Math.random() * 0.35,
      maxLife: 0.45,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

export function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 400 * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function nearestCoin(agent: Agent, coins: Coin[]): Coin | null {
  const candidates: { coin: Coin; dist: number }[] = []
  for (const coin of coins) {
    if (!coin.alive) continue
    const dx = coin.x - agent.x
    const dy = coin.y - agent.y
    // Slight vertical preference — closer in Y ranks better so agents descend purposefully
    const d = dx * dx + dy * dy * 0.85
    candidates.push({ coin, dist: d })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.dist - b.dist)
  // Fan out: each agent picks among the nearest few by id hash
  const pick = Math.min(3, candidates.length)
  const hash =
    agent.id.charCodeAt(0) + agent.id.charCodeAt(agent.id.length - 1) * 7
  return candidates[hash % pick].coin
}

function nearestDeposit(agent: Agent, deposits: Deposit[]): Deposit | null {
  let best: Deposit | null = null
  let bestScore = Infinity
  for (const dep of deposits) {
    const cx = dep.x + dep.w / 2
    const cy = dep.y + dep.h / 2
    const dx = cx - agent.x
    const dy = cy - agent.y
    const dist = Math.hypot(dx, dy)
    // Heavy climb penalty — prefer deposits at/below the agent when possible
    const climb = cy < agent.y - 40 ? (agent.y - cy) * 1.6 : 0
    const score = dist + climb
    if (score < bestScore) {
      bestScore = score
      best = dep
    }
  }
  return best
}

function shouldBank(
  agent: Agent,
  mass: number,
  config: PhysicsConfig,
  level: LevelData,
): boolean {
  if (!config.depositRequired || level.deposits.length === 0) return false
  if (agent.carried <= 0) return false
  // Heavier = more urgent to bank; greed weight fights that urge
  const danger = mass / (1 + config.greedWeight * 2)
  if (danger > 4 && agent.carried >= 2) return true
  if (agent.carried >= 4 + config.greedWeight * 2) return true
  if (level.bankTarget > 0 && agent.banked + agent.carried >= level.bankTarget) {
    return true
  }
  return false
}

function applyMagnets(
  x: number,
  y: number,
  magnets: MagnetWell[],
  boost: number,
  dt: number,
): { ax: number; ay: number } {
  let ax = 0
  let ay = 0
  for (const m of magnets) {
    const dx = m.x - x
    const dy = m.y - y
    const dist = Math.hypot(dx, dy) || 1
    if (dist > m.radius) continue
    const falloff = 1 - dist / m.radius
    const force = m.strength * boost * falloff * falloff
    ax += (dx / dist) * force
    ay += (dy / dist) * force
  }
  return { ax: ax * dt, ay: ay * dt }
}

function resolvePlatforms(
  agent: Agent,
  platforms: Platform[],
  mass: number,
  dt: number,
) {
  agent.onGround = false

  if (agent.dropIgnoreUntilY !== null) {
    if (agent.y > agent.dropIgnoreUntilY + 12) {
      agent.dropIgnoreUntilY = null
    }
  }

  for (const plat of platforms) {
    // Drop-through: ignore the platform we just stepped off until we clear it
    if (
      agent.dropIgnoreUntilY !== null &&
      plat.y <= agent.dropIgnoreUntilY + 6
    ) {
      continue
    }

    const feetY = agent.y + agent.radius
    const withinX =
      agent.x + agent.radius * 0.55 >= plat.x &&
      agent.x - agent.radius * 0.55 <= plat.x + plat.w
    if (!withinX) continue

    // Land on top when falling
    if (
      agent.vy >= 0 &&
      feetY >= plat.y &&
      feetY <= plat.y + plat.h + Math.max(8, agent.vy * dt + 8) &&
      agent.y < plat.y + plat.h
    ) {
      if (plat.sinkMass > 0 && mass >= plat.sinkMass) {
        // Overweight — sink through slowly
        agent.vy = Math.max(agent.vy, 55)
        continue
      }
      agent.y = plat.y - agent.radius
      agent.vy = 0
      agent.onGround = true
      agent.dropIgnoreUntilY = null
    }
  }
}

function resolveWalls(agent: Agent, width: number) {
  if (agent.x - agent.radius < 8) {
    agent.x = 8 + agent.radius
    agent.vx = Math.abs(agent.vx) * 0.4
  }
  if (agent.x + agent.radius > width - 8) {
    agent.x = width - 8 - agent.radius
    agent.vx = -Math.abs(agent.vx) * 0.4
  }
}

function checkPits(agent: Agent, pits: Pit[]): boolean {
  for (const p of pits) {
    if (circleRectOverlap(agent.x, agent.y, agent.radius * 0.6, p)) return true
  }
  return false
}

function checkFloorCrush(agent: Agent, floor: ClosingFloor): boolean {
  if (!floor.active) return false
  return agent.y + agent.radius >= floor.y
}

export function stepPhysics(
  agents: Agent[],
  coins: Coin[],
  level: LevelData,
  floor: ClosingFloor,
  config: PhysicsConfig,
  dt: number,
  particles: Particle[],
  bankOnElim: boolean,
): GrabEvent[] {
  const events: GrabEvent[] = []
  const magnetBoost = config.magnetBoost

  // Coin physics (magnets + rain velocity)
  for (const coin of coins) {
    if (!coin.alive) continue
    const pull = applyMagnets(coin.x, coin.y, level.magnets, magnetBoost, dt)
    coin.vx += pull.ax * 0.6
    coin.vy += pull.ay * 0.6 + (coin.vy !== 0 || coin.vx !== 0 ? GRAVITY * 0.15 * dt : 0)
    coin.x += coin.vx * dt
    coin.y += coin.vy * dt
    coin.vx *= 0.98
    coin.vy *= 0.98
    if (coin.spark > 0) coin.spark -= dt
    if (coin.y > level.bounds.height + 40) coin.alive = false
  }

  for (const agent of agents) {
    if (!agent.alive) continue
    if (agent.fallFlash > 0) agent.fallFlash -= dt
    if (agent.jumpCooldown > 0) agent.jumpCooldown -= dt

    const mass = agentMass(agent, config.greedWeight)
    agent.radius = agentRadius(mass)
    const speed = agentSpeed(mass)

    const banking = shouldBank(agent, mass, config, level)
    let tx = agent.x
    let ty = agent.y

    if (banking) {
      const dep = nearestDeposit(agent, level.deposits)
      if (dep) {
        tx = dep.x + dep.w / 2
        ty = dep.y + dep.h / 2
        agent.targetCoinId = null
      }
    } else {
      const coin = nearestCoin(agent, coins)
      if (coin) {
        tx = coin.x
        ty = coin.y
        agent.targetCoinId = coin.id
      } else if (config.depositRequired && agent.carried > 0) {
        const dep = nearestDeposit(agent, level.deposits)
        if (dep) {
          tx = dep.x + dep.w / 2
          ty = dep.y + dep.h / 2
        }
      }
    }

    const dx = tx - agent.x
    const dy = ty - agent.y
    const dist = Math.hypot(dx, dy) || 1
    // Prefer horizontal approach; keep some vertical bias so agents don't stall
    const desiredVx = (dx / dist) * speed * (Math.abs(dy) > 80 ? 0.85 : 1)
    agent.vx += (desiredVx - agent.vx) * Math.min(1, 8 * dt)

    // Target below — drop through current platform (full-width tops otherwise trap agents)
    if (
      agent.onGround &&
      agent.jumpCooldown <= 0 &&
      agent.dropIgnoreUntilY === null &&
      dy > 36 &&
      (tx !== agent.x || ty !== agent.y)
    ) {
      agent.dropIgnoreUntilY = agent.y + agent.radius
      agent.onGround = false
      agent.vy = Math.max(agent.vy, 70)
      agent.jumpCooldown = 0.18
    } else if (
      agent.onGround &&
      agent.jumpCooldown <= 0 &&
      dy < -28 &&
      Math.abs(dx) < 220
    ) {
      // Jump when target is above (banking / higher coins)
      agent.vy = -agentJump(mass)
      agent.onGround = false
      agent.jumpCooldown = 0.28 + mass * 0.05
      events.push({ kind: 'jump', agentId: agent.id, x: agent.x, y: agent.y, mass })
    }

    const pull = applyMagnets(agent.x, agent.y, level.magnets, magnetBoost * (0.4 + mass * 0.08), dt)
    agent.vx += pull.ax * 0.35
    agent.vy += pull.ay * 0.35

    agent.vy += GRAVITY * dt
    agent.x += agent.vx * dt
    agent.y += agent.vy * dt

    resolveWalls(agent, level.bounds.width)
    resolvePlatforms(agent, level.platforms, mass, dt)

    // Vacuum coins
    for (const coin of coins) {
      if (!coin.alive) continue
      const cdx = coin.x - agent.x
      const cdy = coin.y - agent.y
      const cd = Math.hypot(cdx, cdy)
      const vacuum = VACUUM_RADIUS * (1 + Math.min(0.4, mass * 0.03))
      if (cd < vacuum && cd > 0.1) {
        const suck = (1 - cd / vacuum) * 280 * dt
        coin.x -= (cdx / cd) * suck
        coin.y -= (cdy / cd) * suck
      }
      if (cd < agent.radius + COIN_RADIUS) {
        coin.alive = false
        agent.carried += coin.value
        events.push({
          kind: 'coin',
          agentId: agent.id,
          x: coin.x,
          y: coin.y,
          mass: agentMass(agent, config.greedWeight),
          value: coin.value,
        })
        pushParticle(particles, coin.x, coin.y, '#ffd43b', 6)
      }
    }

    // Bank at deposit
    for (const dep of level.deposits) {
      if (agent.carried <= 0) break
      if (!inRect(agent.x, agent.y, dep) && !circleRectOverlap(agent.x, agent.y, agent.radius, dep)) {
        continue
      }
      const amount = agent.carried
      agent.banked += amount
      agent.carried = 0
      events.push({ kind: 'bank', agentId: agent.id, x: agent.x, y: agent.y, amount })
      pushParticle(particles, agent.x, agent.y, agent.color, 10)
    }

    // Trail
    agent.trail.push({ x: agent.x, y: agent.y })
    if (agent.trail.length > TRAIL_LENGTH) agent.trail.shift()

    // Elimination
    const fell =
      checkPits(agent, level.pits) ||
      checkFloorCrush(agent, floor) ||
      agent.y - agent.radius > level.bounds.height

    if (fell) {
      agent.alive = false
      agent.fallFlash = 0.4
      if (bankOnElim) {
        agent.banked += agent.carried
      }
      agent.carried = 0
      events.push({
        kind: 'fall',
        agentId: agent.id,
        x: agent.x,
        y: agent.y,
        mass,
      })
      pushParticle(particles, agent.x, agent.y, agent.color, 18)
    }
  }

  // Soft agent separation
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    if (!a.alive) continue
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j]
      if (!b.alive) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.01
      const minDist = a.radius + b.radius
      if (dist < minDist) {
        const overlap = (minDist - dist) * 0.5
        const nx = dx / dist
        const ny = dy / dist
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
        a.vx -= nx * 40
        b.vx += nx * 40
      }
    }
  }

  return events
}

export function spawnCoinRain(
  coins: Coin[],
  level: LevelData,
  nextId: { current: number },
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    coins.push({
      id: nextId.current++,
      x: 40 + Math.random() * (level.bounds.width - 80),
      y: -20 - Math.random() * 80,
      value: Math.random() < 0.15 ? 2 : 1,
      alive: true,
      vx: (Math.random() - 0.5) * 40,
      vy: 80 + Math.random() * 60,
      spark: 0.5,
    })
  }
}

export function aliveCoins(coins: Coin[]): number {
  return coins.reduce((n, c) => n + (c.alive ? 1 : 0), 0)
}

export function pickRichest(
  agents: Agent[],
  depositRequired: boolean,
): AgentId | null {
  const alive = agents.filter((a) => a.alive)
  if (alive.length === 0) return null
  const ranked = [...alive].sort((a, b) => {
    const wa = wealth(a, depositRequired)
    const wb = wealth(b, depositRequired)
    if (wb !== wa) return wb - wa
    // Tie-break: total coins (so zero-bank rounds still rank greed)
    return b.banked + b.carried - (a.banked + a.carried)
  })
  return ranked[0]?.id ?? null
}

export function checkBankWin(
  agents: Agent[],
  bankTarget: number,
): AgentId | null {
  if (bankTarget <= 0) return null
  for (const agent of agents) {
    if (agent.alive && agent.banked >= bankTarget) return agent.id
  }
  return null
}
