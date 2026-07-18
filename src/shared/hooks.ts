/** Pre-round prompts to get viewers picking a side. */
export const BET_HOOK_LINES = [
  'Who do you think will win?',
  'Place your bets',
  'Pick a winner',
  "Who's taking this one?",
  'Which color crosses first?',
] as const

export function pickBetHookLine(): string {
  return BET_HOOK_LINES[Math.floor(Math.random() * BET_HOOK_LINES.length)]
}
