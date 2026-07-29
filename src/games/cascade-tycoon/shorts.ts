/** Tuning for the finite short-form challenge run. */

/** Soft-timer baseline at the default money goal. Scales with goal. */
export const RUN_LIMIT_SEC = 55
/** Default goal — ×100 from the pre-scale $5k. */
export const MONEY_GOAL = 500_000
export const GOAL_MIN = 100_000
export const GOAL_MAX = 2_500_000
export const GOAL_STEP = 50_000
export const START_BURST = 5
export const FINISH_HOLD_MS = 1600

/** Soft timer scales with goal so raising the target extends play. */
export function runLimitForGoal(goal: number): number {
  const g = Math.max(GOAL_MIN, goal)
  return Math.max(25, Math.round(RUN_LIMIT_SEC * (g / MONEY_GOAL)))
}

/** Auto-buy priority order. */
export const AUTO_BUY_ORDER = [
  'emitter',
  'cooldown',
  'bumper',
  'bounciness',
] as const

/** Combo: bins with multiplier >= this increment streak. */
export const COMBO_BIN_MIN = 10
/** Bins at or below this break the combo. */
export const COMBO_BREAK_MAX = 2
export const COMBO_TIMEOUT_SEC = 1.6

/** Near-miss: high-earned ball in 10× next to 50× (scaled with pay ×100). */
export const NEAR_MISS_EARNED = 1200

/** Peg audio rate limit (seconds between ticks). */
export const PEG_CUE_COOLDOWN = 0.08
