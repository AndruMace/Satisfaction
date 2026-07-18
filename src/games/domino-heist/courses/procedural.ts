import type { BlockerSpec, LevelData, MissingTooth, Platform } from '../types'

const LEVEL_WIDTH = 540
const LEVEL_HEIGHT = 2400
const MARGIN = 40

export function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

export function generateProceduralLevel(seed: number): LevelData {
  const rng = mulberry32(seed)
  const chainLength = 24 + Math.floor(rng() * 8)
  const stepY = 54 + Math.floor(rng() * 10)
  const startY = 110
  const vaultY = LEVEL_HEIGHT - 90

  const platforms: Platform[] = []
  let platformId = 1
  const shelfCount = 5 + Math.floor(rng() * 3)
  for (let i = 0; i < shelfCount; i++) {
    const y = 260 + i * ((vaultY - 320) / shelfCount)
    const full = rng() > 0.45
    if (full) {
      platforms.push({
        id: platformId++,
        x: MARGIN,
        y,
        w: LEVEL_WIDTH - MARGIN * 2,
        h: 10,
      })
    } else {
      const leftW = 140 + Math.floor(rng() * 100)
      const rightW = 140 + Math.floor(rng() * 100)
      platforms.push({ id: platformId++, x: MARGIN, y, w: leftW, h: 10 })
      platforms.push({
        id: platformId++,
        x: LEVEL_WIDTH - MARGIN - rightW,
        y: y + (rng() > 0.5 ? 0 : 40),
        w: rightW,
        h: 10,
      })
    }
  }

  const missingTeeth: MissingTooth[] = []
  const toothBudget = 6 + Math.floor(rng() * 8)
  for (let i = 0; i < toothBudget; i++) {
    missingTeeth.push({
      chainSlot: Math.floor(rng() * 6),
      afterIndex: 4 + Math.floor(rng() * (chainLength - 8)),
      gapPx: 34 + Math.floor(rng() * 16),
    })
  }

  const blockers: BlockerSpec[] = []
  const blockerCount = 3 + Math.floor(rng() * 4)
  for (let i = 0; i < blockerCount; i++) {
    blockers.push({
      id: i + 1,
      y: 380 + i * ((vaultY - 500) / Math.max(1, blockerCount - 1)),
      speed: 90 + rng() * 90,
      width: 46 + Math.floor(rng() * 16),
      height: 15 + Math.floor(rng() * 6),
      phase: rng(),
    })
  }

  return {
    name: `Heist ${seed.toString(16).slice(0, 4)}`,
    bounds: { width: LEVEL_WIDTH, height: LEVEL_HEIGHT },
    platforms,
    missingTeeth,
    blockers,
    stepY,
    chainLength,
    vaultY,
    startY,
  }
}
