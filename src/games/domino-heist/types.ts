import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

export type ChainId = ContestantId

export type Vec2 = { x: number; y: number }

export type Platform = {
  id: number
  x: number
  y: number
  w: number
  h: number
}

/** Gap / missing tooth along a chain path. */
export type MissingTooth = {
  chainSlot: number
  /** Index in that chain's sequence where the gap sits. */
  afterIndex: number
  gapPx: number
}

export type BlockerSpec = {
  id: number
  y: number
  speed: number
  width: number
  height: number
  /** 0–1 start phase along the horizontal path. */
  phase: number
}

export type DominoState = 'upright' | 'tipping' | 'fallen' | 'shattered'

export type Domino = {
  id: number
  chainId: ChainId
  index: number
  x: number
  y: number
  w: number
  h: number
  angle: number
  tipDir: 1 | -1
  angularVel: number
  state: DominoState
  /** True for the final vault tip target. */
  isVault: boolean
  /** Blocker id that already struck this piece (0 = none). */
  struckBy: number
}

export type Chain = {
  id: ChainId
  color: string
  label: string
  alive: boolean
  /** Furthest tipped index (−1 if none). */
  tipFront: number
  /** Seconds the cascade has been stalled mid-course. */
  stallTimer: number
  dominos: Domino[]
}

export type Blocker = {
  id: number
  x: number
  y: number
  w: number
  h: number
  vx: number
  baseSpeed: number
}

export type LevelData = {
  name: string
  bounds: { width: number; height: number }
  platforms: Platform[]
  missingTeeth: MissingTooth[]
  blockers: BlockerSpec[]
  /** Spacing between successive dominos along Y. */
  stepY: number
  /** Dominos per chain before the vault piece. */
  chainLength: number
  vaultY: number
  startY: number
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

export type ImpactFlash = {
  x: number
  y: number
  life: number
  color: string
  radius: number
}

export type ImpactKind = 'tip' | 'shatter' | 'collide' | 'blocker' | 'vault' | 'eliminated'

export type ImpactEvent = {
  chainId: ChainId
  kind: ImpactKind
  x: number
  y: number
  noteIndex: number
  speed?: number
  /** Spectator-facing reason for eliminations. */
  reason?: 'stalled' | 'wiped'
}

export type OverlayState = {
  countdownValue: number | null
  launchFlash: number
  slowMo: number
  photoFinish: number
  heistAlarm: boolean
  rivalryIds: ChainId[]
  nameTags: boolean
  eventBanner: string | null
  eventBannerLife: number
  hookLine: string | null
  hookLineLife: number
  winMessage: string | null
}

export const DOMINO_W = 14
export const DOMINO_H = 36
export const TIP_ANGLE = Math.PI / 2.15
export const TIP_CONTACT = 0.42
export const BASE_TIP_SPEED = 4.2
export const MAX_DOMINOS = 420
/** Max center-to-center gap a tip can bridge at tipForce = 1. */
export const BASE_TIP_GAP = DOMINO_H * 2.05
/** Stall this long with no progress → chain eliminated. */
export const STALL_ELIM_SEC = 0.85
