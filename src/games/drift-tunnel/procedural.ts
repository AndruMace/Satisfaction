import { ring } from './tunnel'
import type { Ring, TileKind } from './types'

function rand(seed: { v: number }): number {
  seed.v = (seed.v * 1664525 + 1013904223) >>> 0
  return seed.v / 0xffffffff
}

function pickFace(seed: { v: number }): 0 | 1 | 2 | 3 {
  return (Math.floor(rand(seed) * 4) % 4) as 0 | 1 | 2 | 3
}

function kindsForGapPattern(
  seed: { v: number },
  difficulty: number,
): [TileKind, TileKind, TileKind, TileKind] {
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  // Favor one long missing face. Additional missing faces appear gradually,
  // preserving navigable routes instead of producing noisy checkerboards.
  const maxGaps = difficulty < 2 ? 1 : difficulty < 5 ? 2 : 3
  const gaps = 1 + Math.floor(rand(seed) * maxGaps)
  const used = new Set<number>()
  for (let i = 0; i < gaps; i++) {
    let f = pickFace(seed)
    let guard = 0
    while (used.has(f) && guard++ < 8) f = pickFace(seed)
    used.add(f)
    kinds[f] = 'gap'
  }

  // Sprinkle specials on remaining solids
  for (let f = 0; f < 4; f++) {
    if (kinds[f] !== 'solid') continue
    const roll = rand(seed)
    if (roll < 0.08 + difficulty * 0.02) kinds[f] = 'crumble'
    else if (roll < 0.16 + difficulty * 0.02) kinds[f] = 'ice'
    else if (roll < 0.2) kinds[f] = 'boost'
  }

  // Always keep at least one walkable face
  let hasWalkable = false
  for (const k of kinds) {
    if (k !== 'gap') {
      hasWalkable = true
      break
    }
  }
  if (!hasWalkable) {
    kinds[pickFace(seed)] = 'solid'
  }
  return [kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!]
}

/** Generate `count` rings for infinite mode. `distance` drives difficulty. */
export function generateChunk(
  seedValue: number,
  distance: number,
  count: number,
): Ring[] {
  const seed = { v: seedValue >>> 0 || 1 }
  const difficulty = Math.min(8, distance / 80)
  const rings: Ring[] = []

  let i = 0
  while (i < count) {
    // Every hazard gets a visible recovery/reading lane. This prevents
    // one- and two-tile gap noise from chaining back-to-back.
    const recoveryLength = 2 + Math.floor(rand(seed) * 3)
    for (let k = 0; k < recoveryLength && i < count; k++, i++) {
      rings.push(ring('solid', 'solid', 'solid', 'solid'))
    }
    if (i >= count) break

    const [b, r, t, l] = kindsForGapPattern(seed, difficulty)
    // Four rings is a committed long jump at normal speed; longer runs
    // require changing walls. Difficulty extends hazards rather than merely
    // increasing their frequency.
    const extraLength = 2 + Math.floor(Math.min(2, difficulty * 0.3))
    const hazardLength = 4 + Math.floor(rand(seed) * extraLength)
    for (let k = 0; k < hazardLength && i < count; k++, i++) {
      rings.push(ring(b, r, t, l))
    }
  }

  return rings
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0
}
