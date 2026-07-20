import type { CascadeMetrics } from './types'

export type CascadeRunSettings = {
  countdown: boolean
  nearMissSlowMo: boolean
  finaleHold: boolean
}

export const DEFAULT_RUN_SETTINGS: CascadeRunSettings = {
  countdown: true,
  nearMissSlowMo: true,
  finaleHold: true,
}

/** Live knobs that reshape layout + rigid-body feel. */
export type DominoTune = {
  /** Center-to-center gap as a fraction of domino height. */
  spacing: number
  /** Wider gap fraction used for rare clutch spans. */
  clutchSpacing: number
  /** Linear impulse scale on the kick tile. */
  pushPower: number
  /** Initial angular velocity (rad/s) tipping forward. */
  pushSpin: number
  /** Rigid-body mass density scale. */
  mass: number
  /** World gravity magnitude (Y down). */
  gravity: number
  /** Floor friction. */
  groundFriction: number
  /** Domino–domino friction. */
  dominoFriction: number
  /** Bounciness (keep low for tiles). */
  restitution: number
  linearDamping: number
  angularDamping: number
  /** Layout hazard intensity (gaps / turns). */
  drama: number
  /** Upright tilt (0–1) that counts as tipped. */
  tipThreshold: number
  /** Overall cascade playback speed (1 = realtime). */
  simSpeed: number
}

/** Defaults for collision-driven Rapier cascade. */
export const DEFAULT_TUNE: DominoTune = {
  spacing: 0.48,
  clutchSpacing: 0.58,
  pushPower: 1.2,
  pushSpin: 2.6,
  mass: 1.1,
  gravity: 11,
  groundFriction: 0.4,
  dominoFriction: 0.35,
  restitution: 0,
  linearDamping: 0.03,
  angularDamping: 0.05,
  drama: 1,
  tipThreshold: 0.3,
  simSpeed: 0.65,
}

export type TuneSlider = {
  key: keyof DominoTune
  label: string
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export const TUNE_SLIDERS: TuneSlider[] = [
  {
    key: 'simSpeed',
    label: 'Speed',
    min: 0.3,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'spacing',
    label: 'Spacing',
    min: 0.4,
    max: 0.62,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'clutchSpacing',
    label: 'Clutch gap',
    min: 0.48,
    max: 0.72,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'pushPower',
    label: 'Push power',
    min: 0.3,
    max: 2.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'pushSpin',
    label: 'Push spin',
    min: 1.2,
    max: 4.5,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'mass',
    label: 'Weight',
    min: 0.5,
    max: 2.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'gravity',
    label: 'Gravity',
    min: 7,
    max: 18,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'groundFriction',
    label: 'Floor grip',
    min: 0.15,
    max: 0.85,
    step: 0.02,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'dominoFriction',
    label: 'Tile friction',
    min: 0.15,
    max: 0.8,
    step: 0.02,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'restitution',
    label: 'Bounce',
    min: 0,
    max: 0.15,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'linearDamping',
    label: 'Drag',
    min: 0,
    max: 0.12,
    step: 0.005,
    format: (v) => v.toFixed(3),
  },
  {
    key: 'angularDamping',
    label: 'Spin damp',
    min: 0,
    max: 0.15,
    step: 0.005,
    format: (v) => v.toFixed(3),
  },
  {
    key: 'drama',
    label: 'Drama',
    min: 0.5,
    max: 1.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'tipThreshold',
    label: 'Tip threshold',
    min: 0.2,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
]

export function scoreCascade(m: CascadeMetrics): number {
  return m.nearMisses * 12 + m.tips * 0.4 + Math.min(40, m.durationSec * 2)
}
