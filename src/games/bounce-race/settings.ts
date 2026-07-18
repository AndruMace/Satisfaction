export type RunSettings = {
  countdown: boolean
  launchFlash: boolean
  nameTags: boolean
  gravityPulse: boolean
  speedSurge: boolean
  wallLateBoost: boolean
  suddenDeath: boolean
  finalStretch: boolean
  comebackBait: boolean
  brickCascades: boolean
  crushSlowMo: boolean
  photoFinish: boolean
  perfectBounce: boolean
  rivalryMode: boolean
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  countdown: true,
  launchFlash: true,
  nameTags: true,
  gravityPulse: true,
  speedSurge: true,
  wallLateBoost: true,
  suddenDeath: true,
  finalStretch: true,
  comebackBait: true,
  brickCascades: true,
  crushSlowMo: true,
  photoFinish: true,
  perfectBounce: true,
  rivalryMode: true,
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
  { key: 'gravityPulse', label: 'Gravity pulse', group: 'Escalation' },
  { key: 'speedSurge', label: 'Speed surge', group: 'Escalation' },
  { key: 'wallLateBoost', label: 'Wall late boost', group: 'Escalation' },
  { key: 'suddenDeath', label: 'Sudden death', group: 'Escalation' },
  { key: 'finalStretch', label: 'Final stretch', group: 'Escalation' },
  { key: 'comebackBait', label: 'Comeback bait', group: 'Escalation' },
  { key: 'brickCascades', label: 'Brick cascades', group: 'Payoff' },
  { key: 'crushSlowMo', label: 'Crush slow-mo', group: 'Payoff' },
  { key: 'photoFinish', label: 'Photo finish', group: 'Payoff' },
  { key: 'perfectBounce', label: 'Perfect bounce', group: 'Payoff' },
  { key: 'rivalryMode', label: 'Rivalry mode', group: 'Style' },
]

export { BET_HOOK_LINES as RACE_HOOK_LINES, pickBetHookLine as pickRaceHookLine } from '../../shared/hooks'

export type RaceMetrics = {
  brickBreaks: number
  eliminations: number
  finishMargin: number
  upset: boolean
  seed: number
  winner: string | null
}

export function scoreRace(metrics: RaceMetrics): number {
  return (
    metrics.brickBreaks * 3 +
    metrics.eliminations * 8 +
    Math.max(0, 400 - metrics.finishMargin) * 0.08 +
    (metrics.upset ? 40 : 0)
  )
}
