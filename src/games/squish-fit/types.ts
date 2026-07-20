import type { GamePhase } from '../../shared/types'

export type { GamePhase }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'

export type SoftParticle = {
  x: number
  y: number
  px: number
  py: number
}

export type SoftBody = {
  id: number
  color: string
  glow: string
  particles: SoftParticle[]
  edgeRest: number
  restArea: number
  settled: boolean
}

export type WallSeg = {
  ax: number
  ay: number
  bx: number
  by: number
}

export type ShapeKind = 'blob' | 'squircle' | 'bean' | 'tri' | 'pill'

export type QueueItem = {
  kind: ShapeKind
  color: string
  glow: string
  scale: number
}

export type SquishPhase =
  | 'ready'
  | 'filling'
  | 'crowded'
  | 'sealing'
  | 'won'
  | 'overflow'

export type SquishSnapshot = {
  phase: SquishPhase
  bodies: SoftBody[]
  walls: WallSeg[]
  queue: QueueItem[]
  lidY: number
  lidTarget: number
  fillRatio: number
  stampLife: number
  nextDropIn: number
  dropped: number
  total: number
}

/** Tuned for stable Verlet gel (not explosive). */
export const GRAVITY = 780
export const GLOBAL_DAMP = 0.97
export const PRESSURE = 420
export const EDGE_STIFF = 0.62
export const PARTICLE_RADIUS = 4.2
export const SUBSTEPS = 5
export const CONSTRAINT_ITERS = 6
export const MAX_PARTICLE_SPEED = 14
export const WIN_FILL = 0.86
