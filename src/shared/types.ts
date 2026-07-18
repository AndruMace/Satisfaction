/** Shared contestant identity across spectator games. */
export type ContestantId =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'

export type GamePhase = 'idle' | 'countdown' | 'racing' | 'finished'

export type Winner = ContestantId | null

/** Canonical Shorts stage size (9:16). */
export const VIEW_WIDTH = 540
export const VIEW_HEIGHT = 960
