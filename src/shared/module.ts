import type { ComponentType } from 'react'
import type { GamePhase } from './types'

export type PendingClip = {
  blob: Blob
  filename: string
  durationSec: number
}

/** Shared shell state + actions passed into every game module. */
export type GameShellApi = {
  playerCount: number
  setPlayerCount: (count: number) => void
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  busy: boolean
  launchKey: number
  launch: () => void
  autoRecord: boolean
  setAutoRecord: (enabled: boolean) => void
  recordClean: boolean
  setRecordClean: (enabled: boolean) => void
  isRecording: boolean
  setIsRecording: (recording: boolean) => void
  pendingClip: PendingClip | null
  setPendingClip: (clip: PendingClip | null) => void
  recordingError: string | null
  setRecordingError: (message: string | null) => void
  recordingSupported: boolean
}

export type GameViewProps = {
  shell: GameShellApi
}

export type GameControlsProps = {
  shell: GameShellApi
}

/**
 * Contract every spectator game plugs into GameShell with.
 * Recording starts/stops on phase transitions inside GameView (same as Bounce today).
 */
export type GameVisibility = 'public' | 'studio'

export type SpectatorGameModule = {
  id: string
  title: string
  blurb: string
  /** Idle stage hint; defaults to "Tap Launch to start". */
  idleHint?: string
  /** When false, nav shows the tab but selecting it shows Coming soon. */
  available: boolean
  /** public = linked from the site; studio = reachable via /studio only. */
  visibility: GameVisibility
  GameView: ComponentType<GameViewProps>
  Controls: ComponentType<GameControlsProps>
}
