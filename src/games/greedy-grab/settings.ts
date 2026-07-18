export type RunSettings = {
  countdown: boolean
  launchFlash: boolean
  nameTags: boolean
  coinRain: boolean
  magnetPulse: boolean
  closingFloor: boolean
  greedSurge: boolean
  fallSlowMo: boolean
  jackpotFlash: boolean
  photoFinish: boolean
  rivalryMode: boolean
  scoreHud: boolean
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  countdown: true,
  launchFlash: true,
  nameTags: true,
  coinRain: true,
  magnetPulse: true,
  closingFloor: true,
  greedSurge: true,
  fallSlowMo: true,
  jackpotFlash: true,
  photoFinish: true,
  rivalryMode: true,
  scoreHud: true,
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
  { key: 'coinRain', label: 'Coin rain', group: 'Escalation' },
  { key: 'magnetPulse', label: 'Magnet pulse', group: 'Escalation' },
  { key: 'closingFloor', label: 'Closing floor', group: 'Escalation' },
  { key: 'greedSurge', label: 'Greed surge', group: 'Escalation' },
  { key: 'fallSlowMo', label: 'Fall slow-mo', group: 'Payoff' },
  { key: 'jackpotFlash', label: 'Jackpot flash', group: 'Payoff' },
  { key: 'photoFinish', label: 'Photo finish', group: 'Payoff' },
  { key: 'rivalryMode', label: 'Rivalry mode', group: 'Style' },
  { key: 'scoreHud', label: 'Score HUD', group: 'Style' },
]

export { BET_HOOK_LINES as GRAB_HOOK_LINES, pickBetHookLine as pickGrabHookLine } from '../../shared/hooks'

export type GrabMetrics = {
  coinsCollected: number
  eliminations: number
  banks: number
  finishMargin: number
  upset: boolean
  seed: number
  winner: string | null
}

export function scoreGrab(metrics: GrabMetrics): number {
  return (
    metrics.coinsCollected * 2 +
    metrics.eliminations * 10 +
    metrics.banks * 6 +
    Math.max(0, 80 - metrics.finishMargin) * 0.4 +
    (metrics.upset ? 35 : 0)
  )
}
