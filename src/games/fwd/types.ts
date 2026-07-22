/** Four faces of a square prism tunnel (0=floor, 1=right, 2=ceiling, 3=left). */
export type FaceIndex = 0 | 1 | 2 | 3

export type TileKind = 'solid' | 'gap' | 'crumble' | 'ice' | 'boost'

export type FwdMode = 'explore' | 'daily' | 'infinite'

export type FwdPhase = 'idle' | 'racing' | 'failed' | 'cleared'

export type SpeedPreset = 'normal' | 'fast'

export type Tile = {
  kind: TileKind
  /** Crumble tiles: true after player has stepped off. */
  crumbled?: boolean
  /** Crumble tiles: true while player is standing on them. */
  contacted?: boolean
}

/** One cross-section: tile per face. */
export type Ring = [Tile, Tile, Tile, Tile]

export type FwdInput = {
  left: boolean
  right: boolean
  jump: boolean
}

export type InfiniteRunRecord = {
  distance: number
  elapsed: number
  score: number
}

/** Compact 10 Hz pose: elapsed, distance, face, lateral, height. */
export type GhostSample = [
  elapsed: number,
  distance: number,
  face: FaceIndex,
  lateral: number,
  height: number,
]

export type ExploreGhostRun = {
  elapsed: number
  samples: GhostSample[]
}

export type FwdSnapshot = {
  phase: FwdPhase
  mode: FwdMode
  levelIndex: number
  levelTotal: number
  levelName: string
  distance: number
  bestDistance: number
  elapsed: number
  score: number
  levelTimes: number[]
  distanceLeaders: InfiniteRunRecord[]
  scoreLeaders: InfiniteRunRecord[]
  hasGhost: boolean
  ghostTime: number
  seedLabel: string
  speed: number
  face: FaceIndex
  boostT: number
  boostStacks: number
  alive: boolean
  ringsAhead: number
  dailyDate: string
  dailyPuzzleNumber: number
  dailyClears: number[]
  dailyDeaths: number
  dailyStreak: number
  dailyBestTime: number
  dailyBestAttempt: number
  dailyPractice: boolean
  dailyRankedCommitted: boolean
  dailyCompleted: boolean
}

export const TUNNEL_HALF = 1.45
export const RING_DEPTH = 1.05
export const FACE_WIDTH = TUNNEL_HALF * 2

/** Outward normals (into the wall the player stands on). */
export const FACE_OUTWARD: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 1, 0],
  [-1, 0, 0],
]

/** Direction of increasing lateral on each face (looking +Z). */
export const FACE_LATERAL: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [0, -1, 0],
]

export const BASE_SPEED = {
  normal: 7.2,
  fast: 11.5,
} as const

export const JUMP_VELOCITY = 6.8
export const GRAVITY = 22
export const STRAFE_ACCEL = 28
export const STRAFE_FRICTION = 14
export const ICE_FRICTION = 3.5
export const ICE_ACCEL = 18
export const FLIP_EDGE = 0.4
export const BOOST_DURATION = 1.35
export const BOOST_MULT = 1.55
export const BOOST_DECAY_DURATION = 0.75
/** Forgiveness windows for input just before landing and just after leaving support. */
export const JUMP_BUFFER_TIME = 0.12
export const COYOTE_TIME = 0.1
