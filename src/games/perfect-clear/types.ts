import type { GamePhase } from '../../shared/types'

export type { GamePhase }
export { VIEW_WIDTH, VIEW_HEIGHT } from '../../shared/types'

export type NodeKind = 'normal' | 'heavy'

export type ClearNode = {
  id: number
  x: number
  y: number
  size: number
  kind: NodeKind
  /** Hits remaining before destroy. */
  hp: number
  maxHp: number
  alive: boolean
  /** Brief flash after chip/hit. */
  flash: number
  hue: number
}

export type Spark = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  hue: number
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

export type ClearPhase = 'ready' | 'cascading' | 'cleared' | 'failed'

export type LevelDef = {
  id: string
  name: string
  hint: string
  nodes: Array<{
    x: number
    y: number
    size?: number
    kind?: NodeKind
    hue?: number
  }>
}

export type ClearSnapshot = {
  levelId: string
  levelName: string
  phase: ClearPhase
  nodes: ClearNode[]
  sparks: Spark[]
  particles: Particle[]
  remaining: number
  total: number
  destroyed: number
  stampLife: number
  failLife: number
}

export const SPARK_RADIUS = 3.2
export const SPARK_SPEED = 520
export const SPARK_FRICTION = 3.8
export const SPARK_MIN_SPEED = 28
export const SPARK_MAX_LIFE = 1.85
export const BURST_COUNT_MIN = 4
export const BURST_COUNT_MAX = 6
export const BURST_SPEED = 480
export const NODE_DEFAULT_SIZE = 14
