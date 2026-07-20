import type { ContestantId, GamePhase } from '../../shared/types'

export type { ContestantId, GamePhase }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'

export type PegKind = 'standard' | 'bumper'

export type Peg = {
  id: number
  x: number
  y: number
  radius: number
  kind: PegKind
  /** Flash / glow remaining (seconds). */
  flash: number
}

export type Ball = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  /** Accumulated bounce currency before bin multiplier. */
  earned: number
  alive: boolean
}

export type Bin = {
  id: number
  x0: number
  x1: number
  multiplier: number
  color: string
}

export type Emitter = {
  id: number
  x: number
  /** Seconds until next auto-drop. */
  cooldown: number
}

export type UpgradeId = 'emitter' | 'cooldown' | 'bounciness' | 'bumper'

export type UpgradeState = {
  emitter: number
  cooldown: number
  bounciness: number
  bumper: number
}

export type CascadeSnapshot = {
  treasury: number
  pegs: Peg[]
  balls: Ball[]
  bins: Bin[]
  emitters: Emitter[]
  upgrades: UpgradeState
  dropInterval: number
  restitution: number
  ballsDropped: number
  lastPayout: number
}

export const BALL_RADIUS = 7
export const PEG_RADIUS = 6
export const BUMPER_RADIUS = 8
export const GRAVITY = 980
export const BASE_RESTITUTION = 0.72
export const WALL_RESTITUTION = 0.55
export const BUMPER_IMPULSE = 420
export const STANDARD_PAY = 1
export const BUMPER_PAY = 5

/** Layout bands (view coordinates). */
export const ZONE_TOP = 70
export const ZONE_BINS = 820
export const BIN_HEIGHT = 140
