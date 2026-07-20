import { gapOn, ring, solidRing } from './tunnel'
import type { Ring, TileKind } from './types'

export type ExploreLevel = {
  name: string
  hint: string
  rings: Ring[]
}

function pad(n: number, kind: TileKind = 'solid'): Ring[] {
  return Array.from({ length: n }, () =>
    ring(kind, kind, kind, kind === 'solid' ? 'solid' : kind),
  )
}

function stretch(r: Ring, n: number): Ring[] {
  return Array.from({ length: n }, () =>
    ring(r[0].kind, r[1].kind, r[2].kind, r[3].kind),
  )
}

function repeat(section: Ring[], times: number): Ring[] {
  return Array.from({ length: times }, () => section)
    .flat()
    .map((r) => ring(r[0].kind, r[1].kind, r[2].kind, r[3].kind))
}

const LEVELS: ExploreLevel[] = [
  {
    name: 'Warmup',
    hint: 'Auto-run. Jump gaps. Lean into walls to flip gravity.',
    rings: [
      ...pad(20),
      ...stretch(gapOn(0), 2),
      ...pad(4),
      ...stretch(gapOn(0), 2),
      ...pad(6),
      ...stretch(gapOn(0), 3),
      ...repeat([...pad(4), ...stretch(gapOn(0), 2)], 4),
      ...pad(5),
      ...stretch(gapOn(0), 4),
      ...pad(8),
    ],
  },
  {
    name: 'Wall Walk',
    hint: 'Hold right near the edge to flip onto the wall.',
    rings: [
      ...pad(6),
      ...stretch(gapOn(0), 5),
      ...pad(2),
      ...stretch(ring('gap', 'solid', 'solid', 'solid'), 6),
      ...pad(3),
      ...stretch(ring('gap', 'solid', 'gap', 'solid'), 4),
      ...repeat(
        [
          ...pad(2),
          ...stretch(ring('gap', 'solid', 'solid', 'solid'), 6),
          ...stretch(ring('gap', 'solid', 'gap', 'solid'), 4),
        ],
        3,
      ),
      ...repeat(
        [
          ...stretch(ring('gap', 'solid', 'gap', 'solid'), 4),
          ...pad(2),
          ...stretch(ring('solid', 'gap', 'solid', 'gap'), 4),
          ...pad(2),
        ],
        2,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Ceiling Hop',
    hint: 'Flip twice to run on the ceiling past long floor gaps.',
    rings: [
      ...pad(5),
      ...stretch(ring('gap', 'solid', 'solid', 'solid'), 4),
      ...stretch(ring('gap', 'gap', 'solid', 'solid'), 5),
      ...stretch(ring('gap', 'gap', 'solid', 'gap'), 4),
      ...pad(2),
      ...stretch(ring('gap', 'solid', 'solid', 'solid'), 5),
      ...repeat(
        [
          ...stretch(ring('gap', 'solid', 'solid', 'solid'), 4),
          ...stretch(ring('gap', 'gap', 'solid', 'solid'), 5),
          ...pad(1),
        ],
        3,
      ),
      ...repeat(
        [
          ...stretch(ring('gap', 'solid', 'solid', 'gap'), 4),
          ...pad(2),
          ...stretch(ring('solid', 'gap', 'gap', 'solid'), 4),
          ...pad(2),
        ],
        2,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Crackle',
    hint: 'Crumble tiles break after you leave them — keep moving.',
    rings: [
      ...pad(5),
      ...stretch(ring('crumble', 'solid', 'solid', 'solid'), 8),
      ...pad(1),
      ...stretch(ring('crumble', 'crumble', 'solid', 'solid'), 6),
      ...pad(1),
      ...stretch(ring('gap', 'crumble', 'solid', 'crumble'), 6),
      ...repeat(
        [
          ...stretch(ring('crumble', 'solid', 'solid', 'solid'), 4),
          ...stretch(ring('gap', 'crumble', 'solid', 'crumble'), 4),
          ...pad(2),
        ],
        3,
      ),
      ...repeat(
        [
          ...stretch(gapOn(0), 2),
          ...pad(2),
          ...stretch(gapOn(1), 2),
          ...pad(2),
          ...stretch(gapOn(2), 2),
          ...pad(2),
          ...stretch(gapOn(3), 2),
          ...pad(2),
        ],
        2,
      ),
      ...repeat(
        [
          ...stretch(ring('gap', 'crumble', 'gap', 'solid'), 3),
          ...pad(1),
          ...stretch(ring('solid', 'gap', 'crumble', 'gap'), 3),
          ...pad(1),
        ],
        3,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Ice Slide',
    hint: 'Ice makes strafing slippery. Commit early to flips.',
    rings: [
      ...pad(4),
      ...stretch(ring('ice', 'ice', 'solid', 'solid'), 6),
      ...stretch(ring('ice', 'gap', 'solid', 'ice'), 5),
      ...pad(1),
      ...stretch(ring('ice', 'ice', 'ice', 'gap'), 6),
      ...repeat(
        [
          ...stretch(ring('ice', 'gap', 'solid', 'ice'), 4),
          ...stretch(ring('gap', 'ice', 'ice', 'solid'), 4),
          ...pad(2),
        ],
        3,
      ),
      ...repeat(
        [
          ...stretch(gapOn(0), 3),
          ...stretch(gapOn(1), 3),
          ...pad(1),
          ...stretch(gapOn(2), 3),
          ...stretch(gapOn(3), 3),
          ...pad(1),
        ],
        2,
      ),
      ...repeat(
        [
          ...stretch(ring('gap', 'ice', 'gap', 'ice'), 3),
          ...pad(1, 'ice'),
          ...stretch(ring('ice', 'gap', 'ice', 'gap'), 3),
          ...pad(1, 'ice'),
        ],
        2,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Boost Ring',
    hint: 'Neon boost pads surge your speed — brace for gaps.',
    rings: [
      ...pad(4),
      ...stretch(ring('boost', 'solid', 'solid', 'solid'), 3),
      ...pad(1),
      ...stretch(gapOn(0), 4),
      ...stretch(ring('boost', 'solid', 'boost', 'solid'), 3),
      ...stretch(ring('gap', 'solid', 'gap', 'solid'), 5),
      ...repeat(
        [
          ...stretch(ring('boost', 'solid', 'solid', 'solid'), 3),
          ...pad(1),
          ...stretch(ring('gap', 'solid', 'gap', 'solid'), 5),
          ...pad(1),
        ],
        3,
      ),
      ...repeat(
        [
          ...stretch(ring('solid', 'boost', 'solid', 'solid'), 2),
          ...stretch(gapOn(1), 4),
          ...pad(1),
          ...stretch(ring('solid', 'solid', 'solid', 'boost'), 2),
          ...stretch(gapOn(3), 4),
          ...pad(1),
        ],
        3,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Spiral',
    hint: 'Gaps rotate around the tunnel — flip with the pattern.',
    rings: [
      ...pad(4),
      ...stretch(gapOn(0), 2),
      ...stretch(gapOn(1), 2),
      ...stretch(gapOn(2), 2),
      ...stretch(gapOn(3), 2),
      ...stretch(gapOn(0), 2),
      ...stretch(gapOn(1), 2),
      ...stretch(ring('gap', 'gap', 'solid', 'solid'), 3),
      ...stretch(ring('solid', 'gap', 'gap', 'solid'), 3),
      ...repeat(
        [
          ...stretch(gapOn(0), 2),
          ...stretch(gapOn(1), 2),
          ...stretch(gapOn(2), 2),
          ...stretch(gapOn(3), 2),
        ],
        4,
      ),
      ...repeat(
        [
          ...stretch(ring('gap', 'gap', 'solid', 'solid'), 3),
          ...pad(1),
          ...stretch(ring('solid', 'gap', 'gap', 'solid'), 3),
          ...pad(1),
          ...stretch(ring('solid', 'solid', 'gap', 'gap'), 3),
          ...pad(1),
          ...stretch(ring('gap', 'solid', 'solid', 'gap'), 3),
          ...pad(1),
        ],
        2,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Thin Path',
    hint: 'Two faces stay open at a time. Move onto the overlap before it rotates.',
    rings: [
      ...pad(6),
      ...repeat(
        [
          // Adjacent safe faces overlap, giving a readable transition window.
          ...stretch(ring('solid', 'solid', 'gap', 'gap'), 5),
          ...stretch(ring('gap', 'solid', 'solid', 'gap'), 5),
          ...stretch(ring('gap', 'gap', 'solid', 'solid'), 5),
          ...stretch(ring('solid', 'gap', 'gap', 'solid'), 5),
          ...pad(3),
        ],
        3,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Mixed Signal',
    hint: 'Ice, crumble, and boost in one conduit.',
    rings: [
      ...pad(3),
      ...stretch(ring('ice', 'solid', 'crumble', 'solid'), 3),
      ...stretch(ring('gap', 'boost', 'solid', 'ice'), 3),
      ...stretch(ring('crumble', 'gap', 'ice', 'solid'), 4),
      ...stretch(ring('boost', 'crumble', 'gap', 'solid'), 3),
      ...stretch(ring('gap', 'ice', 'solid', 'crumble'), 3),
      ...repeat(
        [
          ...stretch(ring('ice', 'solid', 'crumble', 'gap'), 3),
          ...stretch(ring('gap', 'boost', 'solid', 'ice'), 3),
          ...stretch(ring('crumble', 'gap', 'ice', 'solid'), 3),
          ...pad(2),
        ],
        3,
      ),
      ...pad(8),
    ],
  },
  {
    name: 'Void Gate',
    hint: 'Final explore run. Flip hard. Don’t hesitate.',
    rings: [
      ...pad(3),
      ...stretch(ring('boost', 'solid', 'solid', 'solid'), 1),
      ...stretch(ring('gap', 'solid', 'gap', 'solid'), 3),
      ...stretch(ring('gap', 'gap', 'solid', 'ice'), 4),
      ...stretch(ring('crumble', 'gap', 'solid', 'gap'), 3),
      ...stretch(ring('gap', 'ice', 'gap', 'boost'), 3),
      ...stretch(ring('solid', 'gap', 'crumble', 'gap'), 4),
      ...stretch(ring('gap', 'solid', 'gap', 'solid'), 3),
      ...stretch(solidRing(), 2),
      ...stretch(ring('boost', 'boost', 'boost', 'boost'), 1),
      ...repeat(
        [
          ...stretch(ring('gap', 'solid', 'gap', 'crumble'), 3),
          ...stretch(ring('ice', 'gap', 'solid', 'gap'), 4),
          ...stretch(ring('gap', 'crumble', 'gap', 'boost'), 3),
          ...stretch(solidRing(), 2),
        ],
        4,
      ),
      ...pad(6),
    ],
  },
]

export function levelCount(): number {
  return LEVELS.length
}

export function getLevel(index: number): ExploreLevel {
  const i = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length
  return LEVELS[i]!
}
