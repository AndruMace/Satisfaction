import { VIEW_WIDTH } from '../../shared/types'
import type { Blocker, CourseId, GateOp, GatePair, Hazard } from './types'

export type CourseDef = {
  id: CourseId
  label: string
  blurb: string
  startCount: number
  bossReq: number
  bossAt: number
  gates: Array<{ z: number; left: GateOp; right: GateOp }>
  hazards: Array<{ z: number; x: number; width: number; kind: 'saw' | 'spike' }>
  blockers: Array<{ z: number; req: number }>
}

let nextGateId = 1
let nextHazardId = 1
let nextBlockerId = 1

function op(kind: GateOp['kind'], value: number): GateOp {
  return { kind, value }
}

/** Hand-tuned clip courses — room between gates so each choice reads. */
export const COURSES: CourseDef[] = [
  {
    id: 'clip',
    label: 'Clip',
    blurb: 'Built for the money shot',
    startCount: 5,
    bossReq: 180,
    bossAt: 5600,
    gates: [
      { z: 580, left: op('add', 3), right: op('mul', 2) },
      { z: 1220, left: op('sub', 4), right: op('add', 8) },
      { z: 1860, left: op('mul', 3), right: op('add', 12) },
      { z: 2500, left: op('div', 2), right: op('mul', 2) },
      { z: 3140, left: op('add', 25), right: op('mul', 2) },
      { z: 3780, left: op('mul', 3), right: op('sub', 20) },
      { z: 4420, left: op('div', 2), right: op('add', 40) },
      { z: 5060, left: op('mul', 2), right: op('mul', 4) },
    ],
    hazards: [
      { z: 1500, x: VIEW_WIDTH * 0.28, width: 70, kind: 'saw' },
      { z: 2780, x: VIEW_WIDTH * 0.72, width: 80, kind: 'spike' },
      { z: 4000, x: VIEW_WIDTH * 0.5, width: 90, kind: 'saw' },
    ],
    blockers: [{ z: 3400, req: 40 }],
  },
  {
    id: 'chaos',
    label: 'Chaos',
    blurb: 'Bad gates look tempting',
    startCount: 8,
    bossReq: 220,
    bossAt: 6200,
    gates: [
      { z: 560, left: op('mul', 2), right: op('add', 5) },
      { z: 1180, left: op('add', 50), right: op('mul', 2) },
      { z: 1800, left: op('sub', 30), right: op('div', 2) },
      { z: 2420, left: op('mul', 4), right: op('add', 15) },
      { z: 3040, left: op('div', 3), right: op('mul', 2) },
      { z: 3660, left: op('add', 80), right: op('mul', 3) },
      { z: 4280, left: op('mul', 2), right: op('sub', 50) },
      { z: 4900, left: op('div', 2), right: op('mul', 5) },
      { z: 5520, left: op('mul', 2), right: op('add', 100) },
    ],
    hazards: [
      { z: 1450, x: VIEW_WIDTH * 0.35, width: 75, kind: 'spike' },
      { z: 2000, x: VIEW_WIDTH * 0.65, width: 75, kind: 'saw' },
      { z: 3300, x: VIEW_WIDTH * 0.5, width: 100, kind: 'saw' },
      { z: 4550, x: VIEW_WIDTH * 0.25, width: 70, kind: 'spike' },
      { z: 5150, x: VIEW_WIDTH * 0.75, width: 70, kind: 'spike' },
    ],
    blockers: [{ z: 3900, req: 60 }],
  },
  {
    id: 'gauntlet',
    label: 'Gauntlet',
    blurb: 'Survive the blades',
    startCount: 12,
    bossReq: 150,
    bossAt: 5200,
    gates: [
      { z: 600, left: op('add', 10), right: op('mul', 2) },
      { z: 1300, left: op('mul', 2), right: op('add', 20) },
      { z: 2100, left: op('mul', 3), right: op('div', 2) },
      { z: 2900, left: op('add', 30), right: op('mul', 2) },
      { z: 3700, left: op('mul', 2), right: op('sub', 40) },
      { z: 4500, left: op('mul', 3), right: op('add', 50) },
    ],
    hazards: [
      { z: 950, x: VIEW_WIDTH * 0.5, width: 110, kind: 'saw' },
      { z: 1700, x: VIEW_WIDTH * 0.3, width: 85, kind: 'spike' },
      { z: 1700, x: VIEW_WIDTH * 0.7, width: 85, kind: 'spike' },
      { z: 2500, x: VIEW_WIDTH * 0.45, width: 95, kind: 'saw' },
      { z: 3300, x: VIEW_WIDTH * 0.55, width: 95, kind: 'saw' },
      { z: 4100, x: VIEW_WIDTH * 0.35, width: 80, kind: 'spike' },
      { z: 4100, x: VIEW_WIDTH * 0.65, width: 80, kind: 'spike' },
    ],
    blockers: [{ z: 3000, req: 35 }],
  },
]

export function getCourse(id: CourseId): CourseDef {
  return COURSES.find((c) => c.id === id) ?? COURSES[0]
}

export function buildGates(def: CourseDef): GatePair[] {
  return def.gates.map((g) => ({
    id: nextGateId++,
    z: g.z,
    left: g.left,
    right: g.right,
    hit: false,
    hitSide: null,
    openProgress: 0,
    ghostLife: 0,
  }))
}

export function buildHazards(def: CourseDef): Hazard[] {
  return def.hazards.map((h) => ({
    id: nextHazardId++,
    z: h.z,
    x: h.x,
    width: h.width,
    kind: h.kind,
    hit: false,
    skimmed: false,
  }))
}

export function buildBlockers(def: CourseDef): Blocker[] {
  return def.blockers.map((b) => ({
    id: nextBlockerId++,
    z: b.z,
    req: b.req,
    hit: false,
    smashed: false,
    breakProgress: 0,
  }))
}

export function formatOp(op: GateOp): string {
  switch (op.kind) {
    case 'add':
      return `+${op.value}`
    case 'sub':
      return `-${op.value}`
    case 'mul':
      return `x${op.value}`
    case 'div':
      return `/${op.value}`
  }
}

/** Rough preview of how "good" an op feels for coloring. */
export function opGoodness(op: GateOp, count: number): number {
  const next = applyOp(count, op)
  return next - count
}

export function applyOp(count: number, op: GateOp): number {
  let next = count
  switch (op.kind) {
    case 'add':
      next = count + op.value
      break
    case 'sub':
      next = count - op.value
      break
    case 'mul':
      next = count * op.value
      break
    case 'div':
      next = Math.floor(count / Math.max(1, op.value))
      break
  }
  return Math.max(0, Math.min(99999, Math.floor(next)))
}
