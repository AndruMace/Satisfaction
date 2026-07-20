import { VIEW_HEIGHT, VIEW_WIDTH, type GamePhase } from '../../shared/types'

export { VIEW_WIDTH, VIEW_HEIGHT }
export type { GamePhase }

/** Physical tile size in world units.
 *  Tip direction is +local Z (thin edge). Face with pips is in XY. */
export const DOMINO = {
  /** Left–right face width (pips). */
  face: 0.95,
  /** Standing height. */
  h: 1.85,
  /** Thickness along tip axis. */
  thick: 0.42,
} as const

/**
 * Center-to-center spacing along the tip path.
 * Tuned for Rapier collision transfer (~face gap near thick×0.8–1.2).
 */
export const NORMAL_STEP = DOMINO.h * 0.48

/** Slightly wider “near miss” spacing — still tippable with momentum. */
export const CLUTCH_STEP = DOMINO.h * 0.58

/** Hard clamp — beyond this tips usually miss. */
export const MAX_TIP_GAP = DOMINO.h * 0.7

export type MoodId = 'spiral' | 'stairs' | 'bridge' | 'gauntlet' | 'serpentine'

export type DominoTile = {
  index: number
  /** World center of the standing tile. */
  x: number
  y: number
  z: number
  /** Facing yaw (radians) — tip direction is +local Z after yaw. */
  yaw: number
  /** True only for sparse, extreme gaps that feel uncertain. */
  nearMiss: boolean
  /** Kind hint for props / drama. */
  kind: 'normal' | 'gap' | 'stair' | 'bridge' | 'finale'
}

export type CourseProp = {
  kind: 'vault' | 'pillar' | 'rail' | 'crack'
  x: number
  y: number
  z: number
  yaw: number
  scale?: number
}

export type DominoCourse = {
  name: string
  seed: number
  mood: MoodId
  tiles: DominoTile[]
  props: CourseProp[]
  /** Bounding box for camera framing. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number }
}

export type TileState = 'upright' | 'tipping' | 'fallen'

export type TipImpact = {
  kind: 'tip' | 'gap' | 'finale'
  index: number
  speed: number
}

export type CascadeOverlay = {
  countdownValue: number | null
  banner: string | null
  bannerLife: number
  finaleHold: number
}

export type CascadeMetrics = {
  tips: number
  nearMisses: number
  durationSec: number
  seed: number
  mood: MoodId
  name: string
}
