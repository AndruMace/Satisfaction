import { VIEW_WIDTH } from '../../shared/types'

/** Sim distance → world meters. Negative Z = forward (Three.js camera-friendly). */
export const Z_SCALE = 0.024
/** Road half-width in world units (maps full VIEW_WIDTH). */
export const ROAD_HALF = 5.4
export const ROAD_WIDTH = ROAD_HALF * 2
export const UNIT_RADIUS = 0.16
export const GATE_W = 4.6
export const GATE_H = 3.2
export const GATE_D = 0.55
export const GATE_GAP_W = 0.55

/** Sim X → world X. Small sim X (left) → negative world X (screen left when looking -Z). */
export function toWorldX(simX: number): number {
  return ((simX / VIEW_WIDTH) - 0.5) * ROAD_WIDTH
}

export function toWorldZ(simZ: number): number {
  return -simZ * Z_SCALE
}

export function fromWorldX(worldX: number): number {
  return ((worldX / ROAD_WIDTH) + 0.5) * VIEW_WIDTH
}
