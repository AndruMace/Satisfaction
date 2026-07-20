import type { CourseData } from '../types'

export type PresetId = 'sparse' | 'dual' | 'crossfire' | 'dense'

const TAU = Math.PI * 2

/** Single slow blade — roomy hub, long mid-game. */
export const sparseCourse: CourseData = {
  name: 'Slow Sweep',
  beams: [
    { angle: 0, angularSpeed: 0.52, halfWidth: 0.055, length: 1 },
  ],
  hubClear: 0.28,
  escalateAt: 6,
  mistakeBias: 0.14,
  surviveSeconds: 28,
}

/** Counter-rotating pair — classic duel mood. */
export const dualCourse: CourseData = {
  name: 'Slow Dual',
  beams: [
    { angle: 0, angularSpeed: 0.55, halfWidth: 0.046, length: 1 },
    { angle: Math.PI, angularSpeed: -0.48, halfWidth: 0.046, length: 1 },
  ],
  hubClear: 0.26,
  escalateAt: 5.5,
  mistakeBias: 0.14,
  surviveSeconds: 26,
}

/** Three blades at uneven speeds — chase into the hub. */
export const crossfireCourse: CourseData = {
  name: 'Crossfire',
  beams: [
    { angle: 0, angularSpeed: 0.62, halfWidth: 0.042, length: 1 },
    { angle: (TAU * 1) / 3, angularSpeed: 0.52, halfWidth: 0.04, length: 0.94 },
    { angle: (TAU * 2) / 3, angularSpeed: -0.58, halfWidth: 0.04, length: 0.94 },
  ],
  hubClear: 0.25,
  escalateAt: 5,
  mistakeBias: 0.16,
  surviveSeconds: 24,
}

/** Four dense blades — tighter hub, shove spectacle. */
export const denseCourse: CourseData = {
  name: 'Dense Blades',
  beams: [
    { angle: 0, angularSpeed: 0.62, halfWidth: 0.034, length: 1 },
    { angle: Math.PI / 2, angularSpeed: -0.56, halfWidth: 0.032, length: 1 },
    { angle: Math.PI, angularSpeed: 0.52, halfWidth: 0.032, length: 0.96 },
    { angle: (Math.PI * 3) / 2, angularSpeed: -0.64, halfWidth: 0.03, length: 0.96 },
  ],
  hubClear: 0.22,
  escalateAt: 5,
  mistakeBias: 0.18,
  surviveSeconds: 22,
}

export const presetCourses: CourseData[] = [
  sparseCourse,
  dualCourse,
  crossfireCourse,
  denseCourse,
]

const BY_ID: Record<PresetId, CourseData> = {
  sparse: sparseCourse,
  dual: dualCourse,
  crossfire: crossfireCourse,
  dense: denseCourse,
}

export function getPreset(id: PresetId): CourseData {
  return BY_ID[id]
}
