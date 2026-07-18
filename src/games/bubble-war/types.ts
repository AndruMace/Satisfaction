import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

export type BubbleId = ContestantId

export type Vec2 = { x: number; y: number }

export type Spike = {
  id: number
  x: number
  y: number
  /** Pointing direction in radians (0 = right). */
  angle: number
  length: number
  /** When true, spike drifts downward during escalation. */
  descending: boolean
}

export type WallSeg = {
  id: number
  x: number
  y: number
  w: number
  h: number
}

export type Bubble = {
  id: BubbleId
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  /** Soft squash: 1 = circle; >1 stretched on that axis. */
  squashX: number
  squashY: number
  color: string
  alive: boolean
  /** Brief flash after shove. */
  shovePulse: number
  /** Growth jitter phase. */
  wobble: number
  /** Per-bubble growth multiplier so packs desync overinflate. */
  growthScale: number
  /** Personal overinflate threshold (near level.maxRadius). */
  popRadius: number
}

export type LevelData = {
  name: string
  bounds: { width: number; height: number }
  walls: WallSeg[]
  spikes: Spike[]
  /** Soft pad inset from arena edges. */
  margin: number
  /** Radius at which bubbles auto-pop. */
  maxRadius: number
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type PopBurst = {
  x: number
  y: number
  life: number
  maxLife: number
  color: string
  radius: number
}

export type ImpactKind = 'shove' | 'wall' | 'spike' | 'overinflate' | 'crush' | 'merge'

export type ImpactEvent = {
  bubbleId: BubbleId
  kind: ImpactKind
  x: number
  y: number
  intensity: number
  otherId?: BubbleId
}

export type OverlayState = {
  countdownValue: number | null
  launchFlash: number
  slowMo: number
  photoFinish: number
  rivalryIds: BubbleId[]
  nameTags: boolean
  eventBanner: string | null
  eventBannerLife: number
  hookLine: string | null
  hookLineLife: number
  winMessage: string | null
  growthSurge: boolean
}

/** Hard caps for particle / VFX pools. */
export const MAX_PARTICLES = 120
export const MAX_POP_BURSTS = 18
export const MAX_SPIKES = 36

export const BUBBLE_START_RADIUS = 28
export const BUBBLE_MIN_RADIUS = 18
export const DEFAULT_MAX_RADIUS = 92
export const DEFAULT_GROWTH_RATE = 6.5
export const ARENA_PADDING = 28
