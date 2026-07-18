export type RunSettings = {
  countdown: boolean
  launchFlash: boolean
  nameTags: boolean
  windGusts: boolean
  missingTeeth: boolean
  crossTraffic: boolean
  heistAlarm: boolean
  tipChaos: boolean
  photoFinish: boolean
  shatterSlowMo: boolean
  rivalryMode: boolean
  vaultGlow: boolean
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  countdown: true,
  launchFlash: true,
  nameTags: true,
  windGusts: true,
  missingTeeth: true,
  crossTraffic: true,
  heistAlarm: true,
  tipChaos: true,
  photoFinish: true,
  shatterSlowMo: true,
  rivalryMode: true,
  vaultGlow: true,
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
  { key: 'windGusts', label: 'Wind gusts', group: 'Escalation' },
  { key: 'missingTeeth', label: 'Missing teeth', group: 'Escalation' },
  { key: 'crossTraffic', label: 'Cross traffic', group: 'Escalation' },
  { key: 'heistAlarm', label: 'Heist alarm', group: 'Escalation' },
  { key: 'tipChaos', label: 'Tip chaos', group: 'Escalation' },
  { key: 'shatterSlowMo', label: 'Shatter slow-mo', group: 'Payoff' },
  { key: 'photoFinish', label: 'Photo finish', group: 'Payoff' },
  { key: 'vaultGlow', label: 'Vault glow', group: 'Payoff' },
  { key: 'rivalryMode', label: 'Rivalry mode', group: 'Style' },
]

export { BET_HOOK_LINES as HEIST_HOOK_LINES, pickBetHookLine as pickHeistHookLine } from '../../shared/hooks'

export type HeistMetrics = {
  tips: number
  shatters: number
  eliminations: number
  finishMargin: number
  upset: boolean
  seed: number
  winner: string | null
}

export function scoreHeist(metrics: HeistMetrics): number {
  return (
    metrics.tips * 0.4 +
    metrics.shatters * 5 +
    metrics.eliminations * 10 +
    Math.max(0, 80 - metrics.finishMargin) * 0.35 +
    (metrics.upset ? 45 : 0)
  )
}
