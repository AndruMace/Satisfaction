export type RunSettings = {
  countdown: boolean
  launchFlash: boolean
  nameTags: boolean
  growthSurge: boolean
  hazardDescend: boolean
  mergeTemptation: boolean
  wallSpikes: boolean
  photoFinish: boolean
  popSlowMo: boolean
  rivalryMode: boolean
  juicyPops: boolean
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  countdown: true,
  launchFlash: true,
  nameTags: true,
  growthSurge: true,
  hazardDescend: true,
  mergeTemptation: true,
  wallSpikes: true,
  photoFinish: true,
  popSlowMo: true,
  rivalryMode: true,
  juicyPops: true,
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
  { key: 'growthSurge', label: 'Growth surge', group: 'Escalation' },
  { key: 'hazardDescend', label: 'Hazard descend', group: 'Escalation' },
  { key: 'mergeTemptation', label: 'Merge temptation', group: 'Escalation' },
  { key: 'wallSpikes', label: 'Wall spikes', group: 'Escalation' },
  { key: 'photoFinish', label: 'Photo finish', group: 'Payoff' },
  { key: 'popSlowMo', label: 'Pop slow-mo', group: 'Payoff' },
  { key: 'juicyPops', label: 'Juicy pops', group: 'Payoff' },
  { key: 'rivalryMode', label: 'Rivalry mode', group: 'Style' },
]

export const BUBBLE_HOOK_LINES = [
  'Who pops last?',
  'Pick your bubble',
  'Place your bets',
  "Who's taking this one?",
  'Last bubble standing?',
] as const

export function pickBubbleHookLine(): string {
  return BUBBLE_HOOK_LINES[Math.floor(Math.random() * BUBBLE_HOOK_LINES.length)]
}

export type BubbleMetrics = {
  pops: number
  shoves: number
  finishMargin: number
  upset: boolean
  seed: number
  winner: string | null
}

export function scoreMatch(metrics: BubbleMetrics): number {
  return (
    metrics.pops * 10 +
    metrics.shoves * 0.4 +
    Math.max(0, 200 - metrics.finishMargin) * 0.12 +
    (metrics.upset ? 35 : 0)
  )
}
