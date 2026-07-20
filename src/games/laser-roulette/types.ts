import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

export type DodgerId = ContestantId

export type Vec2 = { x: number; y: number }

/** A rotating lethal beam from arena center (safe inside hubClear). */
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
  /**
   * Inner safe radius as a fraction of arena radius.
   * Inside this disc the beam is not lethal — escape corridor.
   */
  hubClear: number
  color: string
  /** Flash intensity after reverse / spawn. */
  pulse: number
  /** Warm-up flash before lethal growth finishes. */
  telegraph: number
}

export type Dodger = {
  id: DodgerId
  color: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  /** Preferred move speed / reaction scale. */
  skill: number
  alive: boolean
  /** Spawn grace — ignore lethal hits while > 0. */
  grace: number
  /** Seconds since last near-miss (cooldown). */
  nearMissCooldown: number
  /** Temporary reaction delay after a mistake (seconds). */
  stun: number
  /** Remaining dash boost time. */
  dash: number
  /** Cooldown before next dash. */
  dashCooldown: number
  /** Trail of recent positions for render. */
  trail: Vec2[]
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
  /** Base hub safe radius fraction (0–1 of arena radius). */
  hubClear: number
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
/** Spawn band mid-radius (racers start between hub and rim). */
export const SPAWN_RADIUS = 145
export const RACER_RADIUS = 11
/** Default / floor hub clear fractions. */
export const HUB_SAFE_DEFAULT = 0.26
export const HUB_SAFE_FLOOR = 0.15
export const DODGER_SIZE = RACER_RADIUS * 2
export const TRAIL_LENGTH = 12
export const HIT_HALF_WIDTH_PAD = 0.022
export const NEAR_MISS_PAD = 0.1
/** @deprecated kept for any residual imports — prefer SPAWN_RADIUS */
export const RING_RADIUS = SPAWN_RADIUS
