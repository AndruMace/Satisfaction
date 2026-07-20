import {
  CLUTCH_STEP,
  DOMINO,
  type CourseProp,
  type DominoCourse,
  type DominoTile,
  type MoodId,
  MAX_TIP_GAP,
  NORMAL_STEP,
} from './types'

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

export const MOOD_OPTIONS: { id: MoodId; label: string }[] = [
  { id: 'spiral', label: 'Spiral' },
  { id: 'stairs', label: 'Stair Gauntlet' },
  { id: 'bridge', label: 'Bridge Run' },
  { id: 'gauntlet', label: 'Gap Gauntlet' },
  { id: 'serpentine', label: 'Serpentine' },
]

type MoodProfile = {
  name: string
  count: number
  turnChance: number
  maxClutches: number
  stairChance: number
  bridgeChance: number
  /** Max yaw change (rad) per step — keep tip axis aimed at next tile. */
  maxTurn: number
  curveScale: number
}

const PROFILES: Record<MoodId, MoodProfile> = {
  spiral: {
    name: 'Spiral Vault',
    count: 64,
    turnChance: 0,
    maxClutches: 2,
    stairChance: 0.04,
    bridgeChance: 0.03,
    maxTurn: 0.12,
    curveScale: 0.35,
  },
  stairs: {
    name: 'Stair Gauntlet',
    count: 56,
    turnChance: 0.18,
    maxClutches: 2,
    stairChance: 0.38,
    bridgeChance: 0.06,
    maxTurn: 0.16,
    curveScale: 0.14,
  },
  bridge: {
    name: 'Bridge Run',
    count: 52,
    turnChance: 0.22,
    maxClutches: 2,
    stairChance: 0.05,
    bridgeChance: 0.26,
    maxTurn: 0.18,
    curveScale: 0.16,
  },
  gauntlet: {
    name: 'Gap Gauntlet',
    count: 60,
    turnChance: 0.22,
    maxClutches: 3,
    stairChance: 0.08,
    bridgeChance: 0.08,
    maxTurn: 0.16,
    curveScale: 0.18,
  },
  serpentine: {
    name: 'Serpentine',
    count: 70,
    turnChance: 0.4,
    maxClutches: 2,
    stairChance: 0.08,
    bridgeChance: 0.05,
    maxTurn: 0.2,
    curveScale: 0.28,
  },
}

function clampStep(
  prev: DominoTile,
  x: number,
  y: number,
  z: number,
  maxStep: number,
  normalStep: number,
) {
  const dx = x - prev.x
  const dy = y - prev.y
  const dz = z - prev.z
  const horiz = Math.hypot(dx, dz)
  // Elevation eats tip reach — shorten allowed horiz for tall steps
  const elevPenalty = Math.min(0.35, Math.abs(dy) * 0.55)
  const maxHoriz = Math.max(normalStep * 0.9, maxStep - elevPenalty)
  if (horiz <= maxHoriz || horiz < 1e-6) return { x, y, z }
  const scale = maxHoriz / horiz
  return { x: prev.x + dx * scale, y, z: prev.z + dz * scale }
}

/** Each tile must face the next so its tip axis aims at the collision target. */
function orientTiles(tiles: DominoTile[]) {
  for (let i = 0; i < tiles.length; i++) {
    const cur = tiles[i]
    const next = tiles[i + 1]
    if (next) {
      const dx = next.x - cur.x
      const dz = next.z - cur.z
      if (Math.hypot(dx, dz) > 1e-4) {
        cur.yaw = Math.atan2(dx, dz)
      }
    } else if (i > 0) {
      cur.yaw = tiles[i - 1].yaw
    }
  }
}

export type CourseTune = {
  drama?: number
  /** Center-to-center as fraction of height. */
  spacing?: number
  clutchSpacing?: number
}

/**
 * Build a tippable path sized for rigid-body collisions.
 * Spacing is physics-first; clutch gaps stay within tip reach.
 */
export function generateCourse(
  mood: MoodId,
  seed: number,
  dramaOrTune: number | CourseTune = 1,
): DominoCourse {
  const tune: CourseTune =
    typeof dramaOrTune === 'number' ? { drama: dramaOrTune } : dramaOrTune
  const rng = mulberry32(seed || 1)
  const profile = PROFILES[mood]
  const dramaClamped = Math.max(0.35, Math.min(1.6, tune.drama ?? 1))

  const spacingFrac = tune.spacing ?? NORMAL_STEP / DOMINO.h
  const clutchFrac = Math.max(
    spacingFrac + 0.02,
    tune.clutchSpacing ?? CLUTCH_STEP / DOMINO.h,
  )
  const normalStep = DOMINO.h * spacingFrac
  const clutchStep = DOMINO.h * clutchFrac
  const maxTipGap = Math.min(DOMINO.h * (clutchFrac + 0.08), MAX_TIP_GAP * 1.15)

  const count = Math.round(profile.count * (0.9 + dramaClamped * 0.15))
  const maxClutches = Math.max(
    1,
    Math.round(profile.maxClutches * (0.7 + dramaClamped * 0.35)),
  )

  const clutchSet = new Set<number>()
  const clutchBandStart = Math.floor(count * 0.25)
  const clutchBandEnd = Math.floor(count * 0.75)
  const band = Math.max(8, clutchBandEnd - clutchBandStart)
  const clutchSpacing = Math.floor(band / (maxClutches + 1))
  for (let c = 0; c < maxClutches; c++) {
    const base = clutchBandStart + clutchSpacing * (c + 1)
    const jitter = Math.floor((rng() - 0.5) * clutchSpacing * 0.4)
    const idx = Math.max(
      clutchBandStart + 2,
      Math.min(clutchBandEnd - 2, base + jitter),
    )
    clutchSet.add(idx)
  }

  const tiles: DominoTile[] = []
  const props: CourseProp[] = []

  let x = 0
  let y = 0
  let z = 0
  let yaw = 0
  let spiralRadius = 4.2
  let spiralAngle = 0

  for (let i = 0; i < count; i++) {
    let kind: DominoTile['kind'] = 'normal'
    let nearMiss = false
    let step = normalStep

    const isClutch = clutchSet.has(i)

    if (isClutch) {
      step = clutchStep * (0.96 + rng() * 0.08)
      kind = 'gap'
      nearMiss = true
    } else if (i > 3 && i < count - 5) {
      if (rng() < profile.stairChance * dramaClamped) {
        // Small rises only — large drops break rigid cascades
        const rise = (rng() > 0.4 ? 1 : -1) * (0.12 + rng() * 0.18)
        y = Math.max(0, y + rise)
        step = normalStep * 0.95
        kind = 'stair'
      } else if (rng() < profile.bridgeChance * dramaClamped) {
        y = Math.max(0.12, 0.28 + rng() * 0.28)
        step = normalStep * 0.98
        kind = 'bridge'
      } else if (y > 0.04) {
        y = Math.max(0, y - 0.08 - rng() * 0.06)
      }
    }

    if (i >= count - 3) kind = 'finale'

    if (mood === 'spiral') {
      const arc = step / Math.max(2.2, spiralRadius)
      spiralAngle += arc
      spiralRadius += 0.022
      x = Math.cos(spiralAngle) * spiralRadius
      z = Math.sin(spiralAngle) * spiralRadius
      yaw = spiralAngle + Math.PI / 2
    } else if (i > 0) {
      let turn = 0
      if (rng() < profile.turnChance * dramaClamped) {
        turn = (rng() > 0.5 ? 1 : -1) * (0.08 + rng() * profile.maxTurn)
      }
      if (mood === 'serpentine') {
        turn += Math.sin(i * 0.28 + seed * 0.01) * 0.07 * dramaClamped
      }
      yaw += Math.max(-profile.maxTurn, Math.min(profile.maxTurn, turn))
      x += Math.sin(yaw) * step
      z += Math.cos(yaw) * step
    }

    if (i > 0) {
      const maxStep = nearMiss ? maxTipGap : normalStep * 1.15
      const clamped = clampStep(tiles[i - 1], x, y, z, maxStep, normalStep)
      x = clamped.x
      y = clamped.y
      z = clamped.z
    }

    tiles.push({
      index: i,
      x,
      y,
      z,
      yaw,
      nearMiss,
      kind,
    })

    if (kind === 'gap' && nearMiss && i > 0) {
      props.push({
        kind: 'crack',
        x: (x + tiles[i - 1].x) / 2,
        y: Math.max(0, y) + 0.02,
        z: (z + tiles[i - 1].z) / 2,
        yaw,
        scale: 0.9 + rng() * 0.35,
      })
    }
    if (kind === 'bridge' && rng() > 0.45) {
      props.push({
        kind: 'rail',
        x: x + Math.cos(yaw) * 1.2,
        y,
        z: z - Math.sin(yaw) * 1.2,
        yaw,
        scale: 1,
      })
    }
  }

  orientTiles(tiles)

  const last = tiles[tiles.length - 1]
  props.push({
    kind: 'vault',
    x: last.x + Math.sin(last.yaw) * 2.4,
    y: last.y,
    z: last.z + Math.cos(last.yaw) * 2.4,
    yaw: last.yaw,
    scale: 1.2,
  })

  const mid = tiles[Math.floor(tiles.length * 0.45)]
  if (mid) {
    props.push({
      kind: 'pillar',
      x: mid.x + Math.cos(mid.yaw) * 3.5,
      y: 0,
      z: mid.z - Math.sin(mid.yaw) * 3.5,
      yaw: mid.yaw,
      scale: 1,
    })
    props.push({
      kind: 'pillar',
      x: mid.x - Math.cos(mid.yaw) * 3.5,
      y: 0,
      z: mid.z + Math.sin(mid.yaw) * 3.5,
      yaw: mid.yaw,
      scale: 1,
    })
  }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let maxY = 0
  for (const tile of tiles) {
    minX = Math.min(minX, tile.x)
    maxX = Math.max(maxX, tile.x)
    minZ = Math.min(minZ, tile.z)
    maxZ = Math.max(maxZ, tile.z)
    maxY = Math.max(maxY, tile.y + DOMINO.h)
  }

  return {
    name: profile.name,
    seed,
    mood,
    tiles,
    props,
    bounds: {
      minX: minX - 2,
      maxX: maxX + 2,
      minZ: minZ - 2,
      maxZ: maxZ + 2,
      maxY,
    },
  }
}
