export type RunSettings = {
  countdown: boolean
  launchFlash: boolean
  nameTags: boolean
  speedSpike: boolean
  extraBeam: boolean
  narrowWedges: boolean
  suddenReverse: boolean
  photoFinish: boolean
  elimSlowMo: boolean
  surviveTimer: boolean
  nearMissFlash: boolean
  rivalryGlow: boolean
  humBed: boolean
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  countdown: true,
  launchFlash: true,
  nameTags: true,
  speedSpike: true,
  extraBeam: true,
  narrowWedges: true,
  suddenReverse: true,
  photoFinish: true,
  elimSlowMo: true,
  surviveTimer: false,
  nearMissFlash: true,
  rivalryGlow: true,
  /** Plan: hum optional, off by default. */
  humBed: false,
}

export type SettingToggle = {
  key: keyof RunSettings
  label: string
  group: 'Hook' | 'Escalation' | 'Payoff' | 'Style'
}

export const SETTING_TOGGLES: SettingToggle[] = [
  { key: 'countdown', label: 'Countdown', group: 'Hook' },
  { key: 'launchFlash', label: 'Launch flash', group: 'Hook' },
  { key: 'nameTags', label: 'Name tags', group: 'Hook' },
  { key: 'speedSpike', label: 'Speed spike', group: 'Escalation' },
  { key: 'extraBeam', label: 'Extra beam', group: 'Escalation' },
  { key: 'narrowWedges', label: 'Narrow wedges', group: 'Escalation' },
  { key: 'suddenReverse', label: 'Sudden reverse', group: 'Escalation' },
  { key: 'elimSlowMo', label: 'Elim slow-mo', group: 'Payoff' },
  { key: 'photoFinish', label: 'Photo finish', group: 'Payoff' },
  { key: 'surviveTimer', label: 'Survive timer', group: 'Payoff' },
  { key: 'nearMissFlash', label: 'Near-miss flash', group: 'Style' },
  { key: 'rivalryGlow', label: 'Rivalry glow', group: 'Style' },
  { key: 'humBed', label: 'Hum bed', group: 'Style' },
]

export { BET_HOOK_LINES as LASER_HOOK_LINES, pickBetHookLine as pickLaserHookLine } from '../../shared/hooks'

export type MatchMetrics = {
  eliminations: number
  nearMisses: number
  duration: number
  finishMargin: number
  upset: boolean
  seed: number
  winner: string | null
}

export function scoreMatch(metrics: MatchMetrics): number {
  return (
    metrics.eliminations * 10 +
    metrics.nearMisses * 2 +
    Math.max(0, 40 - metrics.duration) * 0.6 +
    Math.max(0, 2 - metrics.finishMargin) * 12 +
    (metrics.upset ? 35 : 0)
  )
}
