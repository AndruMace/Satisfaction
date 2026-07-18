import type { ContestantId } from './types'

export type PlayerProfile = {
  id: ContestantId
  color: string
  label: string
}

export const PLAYER_PROFILES: ReadonlyArray<PlayerProfile> = [
  { id: 'red', color: '#ff3b3b', label: 'Red' },
  { id: 'blue', color: '#3b8bff', label: 'Blue' },
  { id: 'green', color: '#39d98a', label: 'Green' },
  { id: 'yellow', color: '#ffd43b', label: 'Yellow' },
  { id: 'purple', color: '#b56cff', label: 'Purple' },
  { id: 'orange', color: '#ff922b', label: 'Orange' },
]

export function profileIndex(id: ContestantId): number {
  return Math.max(
    0,
    PLAYER_PROFILES.findIndex((profile) => profile.id === id),
  )
}

export function profileLabel(id: ContestantId): string {
  return PLAYER_PROFILES.find((profile) => profile.id === id)?.label ?? id
}
