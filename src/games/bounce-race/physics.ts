import {
  BRICK_SIZE,
  type Brick,
  type HealthBarrier,
  type ImpactEvent,
  type LevelData,
  type Particle,
  PLAYER_PROFILES,
  type PlayerShape,
  type PressureWall,
  pressureFrontY,
  PRESSURE_WALL_INSET,
  rectClearedByPressure,
  type Racer,
  RACER_SIZE,
  RACER_SPEED,
  TRAIL_LENGTH,
  type Vec2,
  type Wall,
  wallPolygon,
  wallTipLength,
} from './types'

const MAX_BOUNCE_VARIATION = Math.PI / 180

function normalizeVelocity(vx: number, vy: number, speed: number) {
  const len = Math.hypot(vx, vy)
  if (len < 0.001) return { vx: 0, vy: speed }
  return { vx: (vx / len) * speed, vy: (vy / len) * speed }
}

function racerBounds(racer: Racer) {
  const half = racer.size / 2
  return {
    left: racer.x - half,
    right: racer.x + half,
    top: racer.y - half,
    bottom: racer.y + half,
  }
}

function overlaps(a: { left: number; right: number; top: number; bottom: number }, rect: { x: number; y: number; w: number; h: number }) {
  return a.right > rect.x && a.left < rect.x + rect.w && a.bottom > rect.y && a.top < rect.y + rect.h
}

function applyBounceVariation(racer: Racer, enabled: boolean) {
  if (!enabled) return
  const angle = (Math.random() * 2 - 1) * MAX_BOUNCE_VARIATION
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const vx = racer.vx * cos - racer.vy * sin
  const vy = racer.vx * sin + racer.vy * cos
  racer.vx = vx
  racer.vy = vy
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Vec2 {
  const abx = bx - ax
  const aby = by - ay
  const denom = abx * abx + aby * aby
  if (denom < 1e-8) return { x: ax, y: ay }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / denom))
  return { x: ax + abx * t, y: ay + aby * t }
}

function pointInPolygon(px: number, py: number, verts: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const yi = verts[i].y
    const yj = verts[j].y
    const xi = verts[i].x
    const xj = verts[j].x
    const crosses =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function reflectVelocity(racer: Racer, nx: number, ny: number) {
  const approaching = racer.vx * nx + racer.vy * ny
  if (approaching >= 0) return
  racer.vx -= 2 * approaching * nx
  racer.vy -= 2 * approaching * ny
}

function resolveWallCollision(
  racer: Racer,
  wall: { x: number; y: number; w: number; h: number },
  randomizeBounce: boolean,
): boolean {
  const b = racerBounds(racer)
  if (!overlaps(b, wall)) return false

  const overlapLeft = b.right - wall.x
  const overlapRight = wall.x + wall.w - b.left
  const overlapTop = b.bottom - wall.y
  const overlapBottom = wall.y + wall.h - b.top

  const overlapX = Math.min(overlapLeft, overlapRight)
  const overlapY = Math.min(overlapTop, overlapBottom)

  if (overlapX <= 0 || overlapY <= 0) return false

  if (overlapX < overlapY) {
    if (overlapLeft < overlapRight) {
      racer.x -= overlapLeft
    } else {
      racer.x += overlapRight
    }
    racer.vx = -racer.vx
  } else {
    if (overlapTop < overlapBottom) {
      racer.y -= overlapTop
    } else {
      racer.y += overlapBottom
    }
    racer.vy = -racer.vy
  }

  applyBounceVariation(racer, randomizeBounce)
  return true
}

/** Platforms with 90° pointed ends — bounce along the hit facet normal. */
function resolvePointedWallCollision(
  racer: Racer,
  wall: Wall,
  randomizeBounce: boolean,
): boolean {
  const b = racerBounds(racer)
  if (!overlaps(b, wall)) return false

  const verts = wallPolygon(wall)
  const half = racer.size / 2
  let bestDist = Infinity
  let bestPx = racer.x
  let bestPy = racer.y

  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const c = verts[(i + 1) % verts.length]
    const p = closestPointOnSegment(racer.x, racer.y, a.x, a.y, c.x, c.y)
    const dist = Math.hypot(racer.x - p.x, racer.y - p.y)
    if (dist < bestDist) {
      bestDist = dist
      bestPx = p.x
      bestPy = p.y
    }
  }

  const inside = pointInPolygon(racer.x, racer.y, verts)
  if (!inside && bestDist >= half) return false

  let nx: number
  let ny: number
  let push: number

  if (inside) {
    if (bestDist < 1e-6) {
      nx = 0
      ny = -1
      push = half
    } else {
      // Toward nearest boundary, then out by racer radius.
      nx = (bestPx - racer.x) / bestDist
      ny = (bestPy - racer.y) / bestDist
      push = bestDist + half
    }
  } else {
    nx = (racer.x - bestPx) / bestDist
    ny = (racer.y - bestPy) / bestDist
    push = half - bestDist
  }

  racer.x += nx * push
  racer.y += ny * push
  reflectVelocity(racer, nx, ny)
  applyBounceVariation(racer, randomizeBounce)
  return true
}

function pressureSurfaceNormal(
  levelWidth: number,
  x: number,
  chevronDepth: number,
): { nx: number; ny: number } {
  const half = Math.max(1, (levelWidth - PRESSURE_WALL_INSET * 2) / 2)
  const depth = Math.max(0, chevronDepth)
  // V tip at center: left arm normal points down-left, right arm down-right.
  if (depth < 0.001) {
    return { nx: 0, ny: 1 }
  }
  if (x <= levelWidth / 2) {
    const len = Math.hypot(depth, half)
    return { nx: -depth / len, ny: half / len }
  }
  const len = Math.hypot(depth, half)
  return { nx: depth / len, ny: half / len }
}

function resolvePressureWallCollision(
  racer: Racer,
  pressureWall: PressureWall,
  levelWidth: number,
  platforms: Array<{ x: number; y: number; w: number; h: number }>,
  randomizeBounce: boolean,
  crushMargin = 6,
): 'bounced' | 'destroyed' | null {
  const half = racer.size / 2
  const left = PRESSURE_WALL_INSET
  const right = levelWidth - PRESSURE_WALL_INSET
  if (racer.x + half <= left || racer.x - half >= right) return null

  const frontY = pressureFrontY(pressureWall, levelWidth, racer.x)
  const top = racer.y - half
  if (top >= frontY) return null

  // Higher crushMargin → need a tighter squeeze before elimination
  const crushGap = Math.max(2, racer.size + 2 - crushMargin)
  const trapped = platforms.some((platform) => {
    const localFront = pressureFrontY(
      pressureWall,
      levelWidth,
      Math.max(platform.x, Math.min(racer.x, platform.x + platform.w)),
    )
    return (
      platform.y >= localFront &&
      platform.y - localFront < crushGap &&
      racer.x + half > platform.x &&
      racer.x - half < platform.x + platform.w
    )
  })
  if (trapped) return 'destroyed'

  racer.y = frontY + half

  const { nx, ny } = pressureSurfaceNormal(
    levelWidth,
    racer.x,
    pressureWall.chevronDepth,
  )
  const wallVx = 0
  const wallVy = pressureWall.speed
  let rvx = racer.vx - wallVx
  let rvy = racer.vy - wallVy
  const approaching = rvx * nx + rvy * ny
  if (approaching < 0) {
    rvx -= 2 * approaching * nx
    rvy -= 2 * approaching * ny
  }
  racer.vx = rvx + wallVx
  racer.vy = rvy + wallVy

  const speed = Math.hypot(racer.vx, racer.vy)
  const maxSpeed = RACER_SPEED * 1.35
  if (speed > maxSpeed) {
    racer.vx = (racer.vx / speed) * maxSpeed
    racer.vy = (racer.vy / speed) * maxSpeed
  }

  applyBounceVariation(racer, randomizeBounce)
  return 'bounced'
}

function resolveRacerCollision(
  a: Racer,
  b: Racer,
  randomizeBounce: boolean,
): ImpactEvent | null {
  const dx = b.x - a.x
  const dy = b.y - a.y

  let nx = 0
  let ny = 0
  let penetration = 0

  if (a.shape === 'ball' && b.shape === 'ball') {
    const distance = Math.hypot(dx, dy)
    const minimumDistance = (a.size + b.size) / 2
    if (distance >= minimumDistance) return null
    if (distance < 0.001) {
      nx = 1
      ny = 0
    } else {
      nx = dx / distance
      ny = dy / distance
    }
    penetration = minimumDistance - distance
  } else {
    const overlapX = (a.size + b.size) / 2 - Math.abs(dx)
    const overlapY = (a.size + b.size) / 2 - Math.abs(dy)
    if (overlapX <= 0 || overlapY <= 0) return null
    if (overlapX < overlapY) {
      nx = dx >= 0 ? 1 : -1
      penetration = overlapX
    } else {
      ny = dy >= 0 ? 1 : -1
      penetration = overlapY
    }
  }

  const correction = penetration / 2 + 0.01
  a.x -= nx * correction
  a.y -= ny * correction
  b.x += nx * correction
  b.y += ny * correction

  const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  if (relativeNormalSpeed < 0) {
    const impulse = -relativeNormalSpeed
    a.vx -= impulse * nx
    a.vy -= impulse * ny
    b.vx += impulse * nx
    b.vy += impulse * ny

    applyBounceVariation(a, randomizeBounce)
    applyBounceVariation(b, randomizeBounce)
  }

  return {
    racerId: a.id,
    kind: 'racer',
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    noteIndex: Math.floor((a.y + b.y) / 100),
    speed: (Math.hypot(a.vx, a.vy) + Math.hypot(b.vx, b.vy)) * 0.5,
  }
}

function boundaryWalls(level: LevelData): Wall[] {
  const { width, height } = level.bounds
  const t = 16
  return [
    { id: -1, x: 0, y: 0, w: width, h: t },
    { id: -2, x: 0, y: height - t, w: width, h: t },
    { id: -3, x: 0, y: 0, w: t, h: height },
    { id: -4, x: width - t, y: 0, w: t, h: height },
  ]
}

export function createRacers(
  level: LevelData,
  playerCount: number,
  shape: PlayerShape,
): Racer[] {
  const count = Math.max(2, Math.min(6, playerCount))

  return PLAYER_PROFILES.slice(0, count).map((profile, index) => {
    const isOriginalPair = count === 2
    const original = index === 0 ? level.racers.red : level.racers.blue
    const start = isOriginalPair
      ? original.start
      : {
          x: 70 + (400 * index) / (count - 1),
          y: 120,
        }
    const velocity = isOriginalPair
      ? original.velocity
      : {
          x: (level.bounds.width / 2 - start.x) * 0.55 +
            (index % 2 === 0 ? 35 : -35),
          y: 280,
        }
    const v = normalizeVelocity(velocity.x, velocity.y, RACER_SPEED)
    return {
      id: profile.id,
      x: start.x,
      y: start.y,
      vx: v.vx,
      vy: v.vy,
      size: RACER_SIZE,
      color: profile.color,
      shape,
      alive: true,
      trail: [{ x: start.x, y: start.y }],
    }
  })
}

export function cloneBricks(bricks: Brick[]): Brick[] {
  return bricks.map((b) => ({ ...b }))
}

export function cloneBarriers(
  barriers: HealthBarrier[],
  health = 25,
): HealthBarrier[] {
  const maxHealth = Math.max(1, Math.min(50, Math.round(health)))
  return barriers.map((barrier) => ({
    ...barrier,
    health: maxHealth,
    maxHealth,
    hitPulse: 0,
  }))
}

function spawnBrickParticles(particles: Particle[], brick: Brick, color: string, burst = 10) {
  const cx = brick.x + brick.w / 2
  const cy = brick.y + brick.h / 2
  for (let i = 0; i < burst; i++) {
    const angle = (Math.PI * 2 * i) / burst + Math.random() * 0.4
    const speed = 80 + Math.random() * 120
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.25,
      maxLife: 0.7,
      color,
      size: 3 + Math.random() * 4,
    })
  }
}

export function cascadeBreakBricks(
  bricks: Brick[],
  origin: Brick,
  particles: Particle[],
  color: string,
  maxExtra = 5,
): number {
  let broken = 0
  const cx = origin.x + origin.w / 2
  const cy = origin.y + origin.h / 2
  const candidates = bricks
    .filter((brick) => brick.alive && brick.id !== origin.id)
    .map((brick) => ({
      brick,
      dist: Math.hypot(brick.x + brick.w / 2 - cx, brick.y + brick.h / 2 - cy),
    }))
    .filter((entry) => entry.dist < BRICK_SIZE * 2.4)
    .sort((a, b) => a.dist - b.dist)

  for (const entry of candidates) {
    if (broken >= maxExtra) break
    entry.brick.alive = false
    spawnBrickParticles(particles, entry.brick, color, 8)
    broken += 1
  }
  return broken
}

function isPerfectEdgeBounce(racer: Racer, wall: Wall): boolean {
  const tip = wallTipLength(wall)
  if (wall.w >= wall.h) {
    const nearLeft = racer.x < wall.x + tip + racer.size * 0.75
    const nearRight = racer.x > wall.x + wall.w - tip - racer.size * 0.75
    return nearLeft || nearRight
  }
  const nearTop = racer.y < wall.y + tip + racer.size * 0.75
  const nearBottom = racer.y > wall.y + wall.h - tip - racer.size * 0.75
  return nearTop || nearBottom
}

function spawnRacerParticles(particles: Particle[], racer: Racer) {
  for (let i = 0; i < 22; i++) {
    const angle = (Math.PI * 2 * i) / 22
    const speed = 110 + Math.random() * 180
    particles.push({
      x: racer.x,
      y: racer.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.35,
      maxLife: 1.05,
      color: racer.color,
      size: 4 + Math.random() * 5,
    })
  }
}

export function stepPhysics(
  racers: Racer[],
  walls: Wall[],
  bricks: Brick[],
  barriers: HealthBarrier[],
  level: LevelData,
  pressureWall: PressureWall,
  randomizeBounces: boolean,
  dt: number,
  particles: Particle[],
  options: { perfectBounce?: boolean; crushMargin?: number } = {},
): ImpactEvent[] {
  const impacts: ImpactEvent[] = []
  const levelWidth = level.bounds.width
  for (const brick of bricks) {
    if (
      brick.alive &&
      rectClearedByPressure(brick, pressureWall, levelWidth)
    ) {
      brick.alive = false
    }
  }
  for (const barrier of barriers) {
    if (
      barrier.health > 0 &&
      rectClearedByPressure(barrier, pressureWall, levelWidth)
    ) {
      barrier.health = 0
    }
  }
  const allWalls = [
    ...walls.filter(
      (wall) => !rectClearedByPressure(wall, pressureWall, levelWidth),
    ),
    ...boundaryWalls(level).filter((wall) => wall.id !== -1),
  ]

  for (const racer of racers) {
    if (!racer.alive) continue
    racer.x += racer.vx * dt
    racer.y += racer.vy * dt

    const hitWalls = new Set<number>()
    for (let pass = 0; pass < 4; pass++) {
      let hit = false
      for (const wall of allWalls) {
        const collided =
          wall.id < 0
            ? resolveWallCollision(racer, wall, randomizeBounces)
            : resolvePointedWallCollision(racer, wall, randomizeBounces)
        if (collided) {
          hit = true
          if (!hitWalls.has(wall.id)) {
            hitWalls.add(wall.id)
            const perfect =
              !!options.perfectBounce &&
              wall.id >= 0 &&
              isPerfectEdgeBounce(racer, wall)
            impacts.push({
              racerId: racer.id,
              kind: perfect ? 'perfect' : 'wall',
              x: racer.x,
              y: racer.y,
              noteIndex: Math.floor(wall.y / 80) + wall.id,
              speed: Math.hypot(racer.vx, racer.vy),
            })
          }
        }
      }
      if (!hit) break
    }

    for (const barrier of barriers) {
      if (barrier.health <= 0) continue
      if (!resolveWallCollision(racer, barrier, randomizeBounces)) continue

      barrier.health = Math.max(0, barrier.health - 1)
      barrier.hitPulse = 1
      impacts.push({
        racerId: racer.id,
        kind: 'barrier',
        x: racer.x,
        y: barrier.y + barrier.h / 2,
        noteIndex: Math.floor(barrier.y / 80) + barrier.id,
        barrierId: barrier.id,
        barrierHealth: barrier.health,
        barrierMaxHealth: barrier.maxHealth,
        speed: Math.hypot(racer.vx, racer.vy),
      })
      break
    }

    const pressureCollision = resolvePressureWallCollision(
      racer,
      pressureWall,
      level.bounds.width,
      [
        ...allWalls,
        ...bricks.filter((brick) => brick.alive),
        ...barriers.filter((barrier) => barrier.health > 0),
      ],
      randomizeBounces,
      options.crushMargin ?? 6,
    )
    if (pressureCollision === 'destroyed') {
      racer.alive = false
      racer.trail = []
      spawnRacerParticles(particles, racer)
      impacts.push({
        racerId: racer.id,
        kind: 'destroyed',
        x: racer.x,
        y: racer.y,
        noteIndex: Math.floor(pressureWall.y / 80),
        speed: Math.hypot(racer.vx, racer.vy),
      })
      continue
    }
    if (pressureCollision === 'bounced') {
      impacts.push({
        racerId: racer.id,
        kind: 'wall',
        x: racer.x,
        y: pressureFrontY(pressureWall, level.bounds.width, racer.x),
        noteIndex: Math.floor(pressureWall.y / 80),
        speed: Math.hypot(racer.vx, racer.vy),
      })
    }

    for (const brick of bricks) {
      if (!brick.alive) continue
      if (!resolveWallCollision(racer, brick, randomizeBounces)) continue

      brick.alive = false
      spawnBrickParticles(particles, brick, racer.color)
      impacts.push({
        racerId: racer.id,
        kind: 'brick',
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        noteIndex: Math.floor(brick.y / BRICK_SIZE),
        brickId: brick.id,
        speed: Math.hypot(racer.vx, racer.vy),
      })
      break
    }

    racer.trail.unshift({ x: racer.x, y: racer.y })
    if (racer.trail.length > TRAIL_LENGTH) racer.trail.pop()
  }

  for (let i = 0; i < racers.length; i++) {
    if (!racers[i].alive) continue
    for (let j = i + 1; j < racers.length; j++) {
      if (!racers[j].alive) continue
      const racerImpact = resolveRacerCollision(
        racers[i],
        racers[j],
        randomizeBounces,
      )
      if (racerImpact) impacts.push(racerImpact)
    }
  }

  return impacts
}

export function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 420 * dt
    p.life -= dt
    if (p.life <= 0) particles.splice(i, 1)
  }
}

export function checkFinish(racers: Racer[], finishY: number): Racer['id'] | null {
  let winner: Racer['id'] | null = null
  for (const racer of racers) {
    if (racer.alive && racer.y >= finishY) {
      if (!winner) winner = racer.id
    }
  }
  return winner
}
