import {
  BRICK_SIZE,
  type Brick,
  type HealthBarrier,
  type LevelData,
  type Wall,
} from '../types'

const LEVEL_WIDTH = 540
const LEVEL_HEIGHT = 3600
const MARGIN = 72

export function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function wall(id: number, x: number, y: number, w: number, h: number): Wall {
  return { id, x, y, w, h }
}

function brick(id: number, x: number, y: number): Brick {
  return { id, x, y, w: BRICK_SIZE, h: BRICK_SIZE, alive: true }
}

function healthBarrier(id: number, y: number): HealthBarrier {
  return {
    id,
    x: 16,
    y,
    w: LEVEL_WIDTH - 32,
    h: 34,
    health: 10,
    maxHealth: 10,
    hitPulse: 0,
  }
}

function placeBrickCluster(
  bricks: Brick[],
  rng: () => number,
  startId: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
) {
  let id = startId
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng() > 0.82) continue
      bricks.push(
        brick(
          id++,
          x + col * (BRICK_SIZE + 4),
          y + row * (BRICK_SIZE + 4),
        ),
      )
    }
  }
  return id
}

export function generateProceduralLevel(seed: number): LevelData {
  const rng = mulberry32(seed)
  const walls: Wall[] = []
  const bricks: Brick[] = []
  let wallId = 1
  let brickId = 1000

  const segmentCount = 10
  const segmentHeight = (LEVEL_HEIGHT - 600) / segmentCount

  for (let i = 0; i < segmentCount; i++) {
    const y = 400 + i * segmentHeight
    const pattern = Math.floor(rng() * 4)

    if (pattern === 0) {
      const w = 140 + Math.floor(rng() * 120)
      walls.push(wall(wallId++, MARGIN, y, w, 20))
      walls.push(wall(wallId++, LEVEL_WIDTH - MARGIN - w, y + segmentHeight * 0.45, w, 20))
    } else if (pattern === 1) {
      const w = 180 + Math.floor(rng() * 100)
      walls.push(wall(wallId++, LEVEL_WIDTH / 2 - w / 2, y, w, 20))
    } else if (pattern === 2) {
      walls.push(wall(wallId++, MARGIN, y, LEVEL_WIDTH - MARGIN * 2, 20))
      const gapSide = rng() > 0.5 ? MARGIN + 40 : LEVEL_WIDTH - MARGIN - 140
      walls.push(wall(wallId++, gapSide, y + segmentHeight * 0.35, 100, 20))
    } else {
      walls.push(wall(wallId++, MARGIN, y, 120, 20))
      walls.push(wall(wallId++, LEVEL_WIDTH - MARGIN - 120, y + segmentHeight * 0.3, 120, 20))
    }

    const clusterX = MARGIN + 20 + Math.floor(rng() * (LEVEL_WIDTH - MARGIN * 2 - 160))
    const clusterY = y + 80 + Math.floor(rng() * (segmentHeight * 0.5))
    const cols = 3 + Math.floor(rng() * 5)
    const rows = 2 + Math.floor(rng() * 3)
    brickId = placeBrickCluster(bricks, rng, brickId, clusterX, clusterY, cols, rows)
  }

  walls.push(wall(wallId++, MARGIN, LEVEL_HEIGHT - 360, LEVEL_WIDTH - MARGIN * 2, 20))

  const redAngle = 0.25 + rng() * 0.2
  const blueAngle = Math.PI - redAngle
  const barriers = [
    healthBarrier(2000, 760),
    healthBarrier(2001, 1760),
    healthBarrier(2002, 2760),
  ]
  const clearsBarrier = (rect: { y: number; h: number }) =>
    barriers.every(
      (barrier) =>
        rect.y + rect.h < barrier.y - 24 ||
        rect.y > barrier.y + barrier.h + 24,
    )

  return {
    name: `Seed ${seed}`,
    bounds: { width: LEVEL_WIDTH, height: LEVEL_HEIGHT },
    racers: {
      red: {
        start: { x: 160, y: 120 },
        velocity: { x: Math.cos(redAngle) * 300, y: Math.sin(redAngle) * 300 },
      },
      blue: {
        start: { x: 380, y: 120 },
        velocity: { x: Math.cos(blueAngle) * 300, y: Math.sin(blueAngle) * 300 },
      },
    },
    walls: walls.filter(clearsBarrier),
    bricks: bricks.filter(clearsBarrier),
    barriers,
    finishY: LEVEL_HEIGHT - 120,
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 999_999)
}
