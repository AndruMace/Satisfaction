import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

/** Bounce Race uses ContestantId for racers. */
export type RacerId = ContestantId

export type Vec2 = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }

export type Wall = Rect & { id: number }

/** Half-thickness tip so the two slanted edges meet at 90°. */
export function wallTipLength(wall: Rect): number {
  return Math.min(wall.w, wall.h) * 0.5
}

/**
 * Convex hexagon for a platform: flat body with pointed ends.
 * Horizontal platforms point left/right; vertical ones point top/bottom.
 */
export function wallPolygon(wall: Rect): Vec2[] {
  const { x, y, w, h } = wall
  const tip = wallTipLength(wall)

  if (w >= h) {
    const midY = y + h * 0.5
    return [
      { x: x + tip, y },
      { x: x + w - tip, y },
      { x: x + w, y: midY },
      { x: x + w - tip, y: y + h },
      { x: x + tip, y: y + h },
      { x: x, y: midY },
    ]
  }

  const midX = x + w * 0.5
  return [
    { x: midX, y },
    { x: x + w, y: y + tip },
    { x: x + w, y: y + h - tip },
    { x: midX, y: y + h },
    { x: x, y: y + h - tip },
    { x: x, y: y + tip },
  ]
}

export type Brick = Rect & { id: number; alive: boolean }

export type HealthBarrier = Rect & {
  id: number
  health: number
  maxHealth: number
  /** 1 on hit, decays to 0 — drives shake/swell feedback. */
  hitPulse: number
}

export type PressureWall = {
  y: number
  height: number
  speed: number
  /** How far the V tip extends below the side edges (px). */
  chevronDepth: number
}

export type PlayerShape = 'square' | 'ball'

export type Racer = {
  id: RacerId
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  shape: PlayerShape
  alive: boolean
  trail: Vec2[]
}

export type LevelData = {
  name: string
  bounds: { width: number; height: number }
  racers: {
    red: { start: Vec2; velocity: Vec2 }
    blue: { start: Vec2; velocity: Vec2 }
  }
  walls: Wall[]
  bricks: Brick[]
  barriers: HealthBarrier[]
  finishY: number
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

export type ImpactKind =
  | 'wall'
  | 'brick'
  | 'barrier'
  | 'racer'
  | 'destroyed'
  | 'perfect'

export type ImpactEvent = {
  racerId: RacerId
  kind: ImpactKind
  x: number
  y: number
  noteIndex: number
  cascade?: number
  brickId?: number
  barrierId?: number
  barrierHealth?: number
  barrierMaxHealth?: number
  /** Impact speed (px/s) for loudness / brightness scaling. */
  speed?: number
}

export type OverlayState = {
  countdownValue: number | null
  launchFlash: number
  slowMo: number
  photoFinish: number
  finalStretch: boolean
  rivalryIds: RacerId[]
  nameTags: boolean
  eventBanner: string | null
  eventBannerLife: number
  hookLine: string | null
  hookLineLife: number
  winMessage: string | null
}

export const RACER_SIZE = 22
export const RACER_SPEED = 380
export const TRAIL_LENGTH = 14
export const BRICK_SIZE = 28
export const PRESSURE_WALL_START_Y = 32
export const PRESSURE_WALL_HEIGHT = 24
export const PRESSURE_WALL_SPEED = 50
/** Default tip depth at LEVEL_WIDTH 540 (~9° slope from flat). */
export const PRESSURE_WALL_CHEVRON_DEPTH = 40
/** Default chevron slope angle in degrees (0 = flat, higher = sharper V). */
export const PRESSURE_WALL_CHEVRON_ANGLE = 9
export const PRESSURE_WALL_INSET = 16
/** Fixed tip Y at race start — body shifts up/down when angle changes. */
export const PRESSURE_WALL_TIP_START_Y =
  PRESSURE_WALL_START_Y + PRESSURE_WALL_HEIGHT + PRESSURE_WALL_CHEVRON_DEPTH

/** Convert slope angle (degrees from flat) into tip depth for a level width. */
export function chevronDepthFromAngle(
  angleDeg: number,
  levelWidth: number,
): number {
  const half = Math.max(1, (levelWidth - PRESSURE_WALL_INSET * 2) / 2)
  const rad = (Math.max(0, Math.min(40, angleDeg)) * Math.PI) / 180
  return half * Math.tan(rad)
}

/** Wall top Y so the tip sits at `tipY`. */
export function pressureWallYForTip(
  tipY: number,
  height: number,
  chevronDepth: number,
): number {
  return tipY - height - chevronDepth
}

/** Leading-edge Y at x — center is lowest so the slope sheds racers sideways. */
export function pressureFrontY(
  wall: PressureWall,
  levelWidth: number,
  x: number,
): number {
  const left = PRESSURE_WALL_INSET
  const right = levelWidth - PRESSURE_WALL_INSET
  const center = levelWidth / 2
  const half = Math.max(1, (right - left) / 2)
  const t = Math.min(1, Math.abs(x - center) / half)
  return wall.y + wall.height + wall.chevronDepth * (1 - t)
}

/** Lowest point of the chevron (center tip). */
export function pressureTipY(wall: PressureWall): number {
  return wall.y + wall.height + wall.chevronDepth
}

/**
 * True when a rect is fully behind the chevron across its width.
 * Uses the shallowest (highest) front along the span — not the center tip —
 * so side arms of the V don't wipe collision early.
 */
export function rectClearedByPressure(
  rect: { x: number; y: number; w: number; h: number },
  wall: PressureWall,
  levelWidth: number,
): boolean {
  const left = Math.max(rect.x, PRESSURE_WALL_INSET)
  const right = Math.min(rect.x + rect.w, levelWidth - PRESSURE_WALL_INSET)
  if (right <= left) {
    return rect.y + rect.h <= pressureTipY(wall)
  }
  const samples = 6
  let minFront = Infinity
  for (let i = 0; i <= samples; i++) {
    const x = left + ((right - left) * i) / samples
    minFront = Math.min(minFront, pressureFrontY(wall, levelWidth, x))
  }
  return rect.y + rect.h <= minFront
}
