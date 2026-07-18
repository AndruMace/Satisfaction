import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

export type DodgerId = ContestantId

export type Vec2 = { x: number; y: number }

/** A rotating lethal beam from arena center. */
export type LaserBeam = {
  id: number
  /** Beam angle in radians (direction of the ray). */
  angle: number
  /** Radians/sec; sign = rotation direction. */
  angularSpeed: number
  /** Half-width of the lethal wedge in radians. */
  halfWidth: number
  /** 0–1 length fraction of arena radius (visual + hit). */
  length: number
  /** Target length for growth escalation. */
  targetLength: number
  color: string
  /** Flash intensity after reverse / spawn. */
  pulse: number
}

export type Dodger = {
  id: DodgerId
  color: string
  /** Angle on the ring (radians). */
  angle: number
  /** Angular velocity (rad/s). */
  omega: number
  /** Preferred move speed scale from AI aggression. */
  skill: number
  /**
   * Personal safe-slot angle — unique per dodger so they don't all stack
   * in the deepest gap midpoint.
   */
  homeAngle: number
  alive: boolean
  /** Spawn grace — ignore lethal hits while > 0. */
  grace: number
  /** Seconds since last near-miss (cooldown). */
  nearMissCooldown: number
  /** Temporary reaction delay after a mistake (seconds). */
  stun: number
  trail: number[]
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

export type LaserEvent =
  | { kind: 'zap'; dodgerId: DodgerId; x: number; y: number }
  | { kind: 'nearMiss'; dodgerId: DodgerId; x: number; y: number }
  | { kind: 'elim'; dodgerId: DodgerId; x: number; y: number }

export type OverlayState = {
  countdownValue: number | null
  launchFlash: number
  slowMo: number
  photoFinish: number
  nameTags: boolean
  eventBanner: string | null
  eventBannerLife: number
  hookLine: string | null
  hookLineLife: number
  winMessage: string | null
  tension: number
  surviveTimer: number | null
}

export type CourseData = {
  name: string
  /** Initial beam definitions (angles/speeds/widths). */
  beams: Array<{
    angle: number
    angularSpeed: number
    halfWidth: number
    length: number
  }>
  /** Seconds until first escalation spike. */
  escalateAt: number
  /** Base AI mistake chance 0–1. */
  mistakeBias: number
  /** Optional hard time limit (survive mode uses this). */
  surviveSeconds: number
}

export const ARENA_CX = 270
export const ARENA_CY = 480
export const ARENA_RADIUS = 210
export const RING_RADIUS = 168
export const DODGER_SIZE = 18
export const TRAIL_LENGTH = 10
export const HIT_HALF_WIDTH_PAD = 0.02
export const NEAR_MISS_PAD = 0.11
