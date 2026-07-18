import type { CourseData } from '../types'

export type PresetId = 'sparse' | 'dual' | 'crossfire' | 'dense'

const TAU = Math.PI * 2

export const sparseCourse: CourseData = {
  name: 'Sparse',
  beams: [
    { angle: 0, angularSpeed: 0.55, halfWidth: 0.055, length: 1 },
  ],
  escalateAt: 6,
  mistakeBias: 0.08,
  surviveSeconds: 28,
}

export const dualCourse: CourseData = {
  name: 'Dual',
  beams: [
    { angle: 0, angularSpeed: 0.7, halfWidth: 0.05, length: 1 },
    { angle: Math.PI, angularSpeed: -0.62, halfWidth: 0.05, length: 1 },
  ],
  escalateAt: 5,
  mistakeBias: 0.12,
  surviveSeconds: 24,
}

export const crossfireCourse: CourseData = {
  name: 'Crossfire',
  beams: [
    { angle: 0, angularSpeed: 0.85, halfWidth: 0.048, length: 1 },
    { angle: (TAU * 1) / 3, angularSpeed: 0.72, halfWidth: 0.045, length: 0.92 },
    { angle: (TAU * 2) / 3, angularSpeed: -0.78, halfWidth: 0.045, length: 0.92 },
  ],
  escalateAt: 4.5,
  mistakeBias: 0.16,
  surviveSeconds: 22,
}

export const denseCourse: CourseData = {
  name: 'Dense',
  beams: [
    { angle: 0, angularSpeed: 1.05, halfWidth: 0.042, length: 1 },
    { angle: Math.PI / 2, angularSpeed: -0.95, halfWidth: 0.04, length: 1 },
    { angle: Math.PI, angularSpeed: 0.88, halfWidth: 0.04, length: 0.95 },
    { angle: (Math.PI * 3) / 2, angularSpeed: -1.1, halfWidth: 0.038, length: 0.95 },
  ],
  escalateAt: 3.5,
  mistakeBias: 0.22,
  surviveSeconds: 18,
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
