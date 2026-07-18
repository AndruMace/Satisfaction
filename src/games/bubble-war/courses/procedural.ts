import {
  ARENA_PADDING,
  DEFAULT_MAX_RADIUS,
  type LevelData,
  MAX_SPIKES,
  type Spike,
  type WallSeg,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../types'

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

function wall(id: number, x: number, y: number, w: number, h: number): WallSeg {
  return { id, x, y, w, h }
}

function spike(
  id: number,
  x: number,
  y: number,
  angle: number,
  length: number,
  descending: boolean,
): Spike {
  return { id, x, y, angle, length, descending }
}

export function generateProceduralLevel(seed: number, hazardDensity = 0.55): LevelData {
  const rand = mulberry32(seed)
  const t = 18
  const walls: WallSeg[] = [
    wall(1, 0, 0, VIEW_WIDTH, t),
    wall(2, 0, VIEW_HEIGHT - t, VIEW_WIDTH, t),
    wall(3, 0, 0, t, VIEW_HEIGHT),
    wall(4, VIEW_WIDTH - t, 0, t, VIEW_HEIGHT),
  ]

  const blockCount = 2 + Math.floor(rand() * 3)
  let wallId = 5
  for (let i = 0; i < blockCount; i++) {
    const w = 60 + rand() * 100
    const h = 14 + rand() * 10
    const x = ARENA_PADDING + 40 + rand() * (VIEW_WIDTH - ARENA_PADDING * 2 - w - 80)
    const y = 180 + rand() * (VIEW_HEIGHT - 360)
    walls.push(wall(wallId++, x, y, w, h))
  }

  const spikes: Spike[] = []
  let spikeId = 10
  const density = Math.max(0.15, Math.min(1, hazardDensity))
  const topCount = Math.round(4 + density * 5)
  const inset = ARENA_PADDING + 30
  const span = VIEW_WIDTH - inset * 2
  for (let i = 0; i < topCount && spikes.length < MAX_SPIKES; i++) {
    const tx = inset + span * (topCount === 1 ? 0.5 : i / (topCount - 1))
    spikes.push(
      spike(spikeId++, tx, ARENA_PADDING + 10 + rand() * 8, Math.PI / 2, 18 + rand() * 8, true),
    )
  }

  const sideCount = Math.round(2 + density * 4)
  for (let i = 0; i < sideCount && spikes.length < MAX_SPIKES - 1; i++) {
    const y = ARENA_PADDING + 100 + rand() * (VIEW_HEIGHT - ARENA_PADDING * 2 - 200)
    spikes.push(spike(spikeId++, ARENA_PADDING + 6, y, 0, 16 + rand() * 6, false))
    spikes.push(
      spike(
        spikeId++,
        VIEW_WIDTH - ARENA_PADDING - 6,
        y + (rand() - 0.5) * 40,
        Math.PI,
        16 + rand() * 6,
        false,
      ),
    )
  }

  const midCount = Math.round(density * 4)
  const spawnBandTop = VIEW_HEIGHT * 0.28
  const spawnBandBot = VIEW_HEIGHT * 0.52
  for (let i = 0; i < midCount && spikes.length < MAX_SPIKES; i++) {
    let y = 200 + rand() * (VIEW_HEIGHT - 400)
    // Keep mid hazards out of the bubble spawn band.
    if (y > spawnBandTop && y < spawnBandBot) {
      y = spawnBandBot + 40 + rand() * 80
    }
    spikes.push(
      spike(
        spikeId++,
        ARENA_PADDING + 60 + rand() * (VIEW_WIDTH - ARENA_PADDING * 2 - 120),
        y,
        rand() * Math.PI * 2,
        14 + rand() * 8,
        rand() > 0.6,
      ),
    )
  }

  // Prefer procedural blocks below spawn so packs aren't crushed on launch.
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]
    if (w.id < 5) continue
    if (w.y + w.h > spawnBandTop && w.y < spawnBandBot) {
      w.y = spawnBandBot + 30 + rand() * 120
    }
  }

  return {
    name: `Seed ${seed.toString(16).slice(0, 6)}`,
    bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
    walls,
    spikes: spikes.slice(0, MAX_SPIKES),
    margin: ARENA_PADDING,
    maxRadius: DEFAULT_MAX_RADIUS - density * 10,
  }
}
