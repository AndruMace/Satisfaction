import {
  type Coin,
  type LevelData,
  type MagnetWell,
  type Platform,
  VIEW_WIDTH,
} from '../types'

const W = VIEW_WIDTH

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

export function generateProceduralLevel(seed: number): LevelData {
  const rand = mulberry32(seed)
  const height = 1200 + Math.floor(rand() * 300)
  const platforms: Platform[] = []
  const coins: Coin[] = []
  const magnets: MagnetWell[] = []
  let id = 1
  let coinId = 1

  platforms.push({
    id: id++,
    x: 40,
    y: 160,
    w: W - 80,
    h: 18,
    sinkMass: 0,
  })

  let y = 300
  while (y < height - 160) {
    const gapStyle = rand()
    if (gapStyle < 0.35) {
      const leftW = 120 + rand() * 100
      const rightW = 120 + rand() * 100
      platforms.push({
        id: id++,
        x: 24,
        y,
        w: leftW,
        h: 16,
        sinkMass: 3 + Math.floor(rand() * 8),
      })
      platforms.push({
        id: id++,
        x: W - 24 - rightW,
        y: y + (rand() - 0.5) * 30,
        w: rightW,
        h: 16,
        sinkMass: 3 + Math.floor(rand() * 8),
      })
    } else {
      const w = 180 + rand() * 220
      const x = 30 + rand() * (W - w - 60)
      platforms.push({
        id: id++,
        x,
        y,
        w,
        h: 16,
        sinkMass: rand() < 0.4 ? 0 : 4 + Math.floor(rand() * 10),
      })
    }

    const clusterX = 80 + rand() * (W - 160)
    const count = 5 + Math.floor(rand() * 7)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const r = 28 + rand() * 30
      coins.push({
        id: coinId++,
        x: clusterX + Math.cos(a) * r,
        y: y - 40 + Math.sin(a) * r * 0.4,
        value: rand() < 0.2 ? 2 : 1,
        alive: true,
        vx: 0,
        vy: 0,
        spark: 0,
      })
    }

    if (rand() < 0.35) {
      magnets.push({
        id: id++,
        x: 100 + rand() * (W - 200),
        y: y + 40,
        radius: 70 + rand() * 50,
        strength: 120 + rand() * 100,
      })
    }

    y += 140 + rand() * 80
  }

  platforms.push({
    id: id++,
    x: 80,
    y: height - 180,
    w: W - 160,
    h: 18,
    sinkMass: 12,
  })

  const spawnPoints = Array.from({ length: 6 }, (_, i) => ({
    x: 70 + (i * (W - 140)) / 5,
    y: 142,
  }))

  return {
    name: `Grab ${seed.toString(16).slice(0, 4)}`,
    bounds: { width: W, height },
    platforms,
    pits: [{ id: 1, x: 0, y: height - 70, w: W, h: 70 }],
    deposits: [
      { id: 1, x: 40, y: 130, w: 80, h: 28 },
      { id: 2, x: W - 120, y: 130, w: 80, h: 28 },
      {
        id: 3,
        x: W / 2 - 45,
        y: Math.floor(height * 0.42),
        w: 90,
        h: 28,
      },
      {
        id: 4,
        x: W / 2 - 45,
        y: height - 210,
        w: 90,
        h: 28,
      },
    ],
    magnets,
    coins,
    spawnPoints,
    bankTarget: rand() < 0.5 ? 8 + Math.floor(rand() * 8) : 0,
    floorStartY: height - 40,
    floorSpeed: 16 + rand() * 30,
  }
}
