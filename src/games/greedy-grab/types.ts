import type { ContestantId, GamePhase, Winner } from '../../shared/types'

export type { ContestantId, GamePhase, Winner }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'
export { PLAYER_PROFILES } from '../../shared/profiles'

export type AgentId = ContestantId

export type Vec2 = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }

export type Platform = Rect & {
  id: number
  /** Mass above this sinks the agent through (0 = solid forever). */
  sinkMass: number
}

export type Pit = Rect & { id: number }

export type Deposit = Rect & { id: number }

export type MagnetWell = {
  id: number
  x: number
  y: number
  radius: number
  strength: number
}

export type Coin = {
  id: number
  x: number
  y: number
  value: number
  alive: boolean
  vx: number
  vy: number
  /** Rain / spawn life sparkle. */
  spark: number
}

export type Agent = {
  id: AgentId
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alive: boolean
  carried: number
  banked: number
  onGround: boolean
  jumpCooldown: number
  /** While set, skip landing on platforms at/above this Y (drop-through). */
  dropIgnoreUntilY: number | null
  targetCoinId: number | null
  trail: Vec2[]
  fallFlash: number
}

export type ClosingFloor = {
  y: number
  speed: number
  active: boolean
}

export type LevelData = {
  name: string
  bounds: { width: number; height: number }
  platforms: Platform[]
  pits: Pit[]
  deposits: Deposit[]
  magnets: MagnetWell[]
  coins: Coin[]
  spawnPoints: Vec2[]
  /** Coins needed in bank to win early (0 = timer / last standing only). */
  bankTarget: number
  /** Starting closing-floor Y (from top); speed applied at runtime. */
  floorStartY: number
  floorSpeed: number
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

export type GrabEvent =
  | { kind: 'coin'; agentId: AgentId; x: number; y: number; mass: number; value: number }
  | { kind: 'bank'; agentId: AgentId; x: number; y: number; amount: number }
  | { kind: 'fall'; agentId: AgentId; x: number; y: number; mass: number }
  | { kind: 'jump'; agentId: AgentId; x: number; y: number; mass: number }

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
  rivalryIds: AgentId[]
  closingFloor: boolean
  coinRain: boolean
  magnetPulse: boolean
  scoreHud: boolean
  timerLabel: string | null
}

export const AGENT_BASE_RADIUS = 16
export const AGENT_BASE_SPEED = 220
export const COIN_RADIUS = 7
export const GRAVITY = 980
export const JUMP_SPEED = 620
export const VACUUM_RADIUS = 48
export const TRAIL_LENGTH = 10
export const MASS_PER_COIN = 1
export const BASE_MASS = 1
