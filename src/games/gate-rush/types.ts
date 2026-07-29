import type { GamePhase } from '../../shared/types'

export type { GamePhase }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'

export type GateOp =
  | { kind: 'add'; value: number }
  | { kind: 'sub'; value: number }
  | { kind: 'mul'; value: number }
  | { kind: 'div'; value: number }

export type GateSide = 'left' | 'right'

export type GatePair = {
  id: number
  /** World distance along the run (player distance catches this). */
  z: number
  left: GateOp
  right: GateOp
  hit: boolean
  hitSide: GateSide | null
  /** 0–1 chosen door open/split after commit. */
  openProgress: number
  /** Seconds the rejected door stays as a ghost. */
  ghostLife: number
}

export type Hazard = {
  id: number
  z: number
  x: number
  width: number
  kind: 'saw' | 'spike'
  hit: boolean
  skimmed: boolean
}

/** Mid-run min-count blocker (soft boss). */
export type Blocker = {
  id: number
  z: number
  req: number
  hit: boolean
  smashed: boolean
  breakProgress: number
}

export type CrowdUnit = {
  ox: number
  oy: number
  phase: number
  hue: number
}

export type Popup = {
  id: number
  text: string
  x: number
  y: number
  life: number
  maxLife: number
  color: string
  scale: number
  vy: number
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

export type Banner = {
  text: string
  life: number
  maxLife: number
  color: string
}

export type RushPhase = 'ready' | 'running' | 'boss' | 'won' | 'lost'

export type CourseId = 'clip' | 'chaos' | 'gauntlet'

export type WinKind = 'normal' | 'barely' | 'overkill'

export type AudioCue =
  | { kind: 'gate'; good: boolean; big: boolean }
  | { kind: 'hazard' }
  | { kind: 'boss' }
  | { kind: 'win'; style: WinKind }
  | { kind: 'lose' }
  | { kind: 'start' }
  | { kind: 'tick'; count: number }
  | { kind: 'impact'; won: boolean; style: WinKind }
  | { kind: 'nearMiss' }
  | { kind: 'streak'; n: number }
  | { kind: 'banner' }
  | { kind: 'tension'; ratio: number }

export type LaneFlash = {
  side: GateSide
  good: boolean
  life: number
}

export type GateRushSnapshot = {
  phase: RushPhase
  count: number
  displayCount: number
  x: number
  distance: number
  speed: number
  gates: GatePair[]
  hazards: Hazard[]
  blockers: Blocker[]
  bossAt: number
  bossReq: number
  streak: number
  bestStreak: number
  shake: number
  flash: number
  popups: Popup[]
  particles: Particle[]
  units: CrowdUnit[]
  courseId: CourseId
  /** 0–1 progress along the course. */
  progress: number
  peakCount: number
  lastCue: AudioCue | null
  cueSeq: number
  /** Seconds since win/lose resolved. */
  outroT: number
  /** 0–1 boss door smash (win only). */
  doorBreak: number
  /** 0–1 charge into the boss gate. */
  slamProgress: number
  timeScale: number
  fovPunch: number
  laneFlash: LaneFlash | null
  banner: Banner | null
  /** Ghost peak count shown when current < peak. */
  showPeakGhost: boolean
  winKind: WinKind
  gatesHit: number
}

/** Crowd sits in the lower third; world scrolls toward the camera. */
export const CROWD_Y = 720
export const LANE_PAD = 48
export const GATE_HALF_W = 118
export const GATE_GAP = 28
export const GATE_DEPTH = 56
export const MAX_UNITS = 96
export const BASE_SPEED = 280
export const MAX_SPEED = 460
export const START_COUNT = 5
export const GATE_OPEN_DUR = 0.55
export const GATE_GHOST_DUR = 0.85
