import type { Ring, Tile, TileKind } from './types'

export function tile(kind: TileKind): Tile {
  return { kind }
}

export function ring(
  bottom: TileKind,
  right: TileKind,
  top: TileKind,
  left: TileKind,
): Ring {
  return [tile(bottom), tile(right), tile(top), tile(left)]
}

/** All four faces solid. */
export function solidRing(): Ring {
  return ring('solid', 'solid', 'solid', 'solid')
}

/** Gap on one face; others solid. */
export function gapOn(face: 0 | 1 | 2 | 3): Ring {
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  kinds[face] = 'gap'
  return ring(kinds[0], kinds[1], kinds[2], kinds[3])
}

export function cloneRings(rings: Ring[]): Ring[] {
  return rings.map(
    (r) =>
      [
        { ...r[0], crumbled: false, contacted: false },
        { ...r[1], crumbled: false, contacted: false },
        { ...r[2], crumbled: false, contacted: false },
        { ...r[3], crumbled: false, contacted: false },
      ] as Ring,
  )
}

export function isWalkable(t: Tile | undefined): boolean {
  if (!t) return false
  if (t.kind === 'gap') return false
  if (t.kind === 'crumble' && t.crumbled) return false
  return true
}

export function getTile(rings: Ring[], ringIndex: number, face: number): Tile | undefined {
  const r = rings[ringIndex]
  if (!r) return undefined
  return r[face as 0 | 1 | 2 | 3]
}
