import { useMemo, useState } from 'react'
import { BounceRaceShell } from '../games/bounce-race'
import { BubbleWarShell } from '../games/bubble-war'
import { DominoHeistShell } from '../games/domino-heist'
import { GreedyGrabShell } from '../games/greedy-grab'
import { LaserRouletteShell } from '../games/laser-roulette'
import { isRecordingSupported } from '../shared/recorder'
import type { GameShellApi, SpectatorGameModule } from '../shared/module'
import type { GamePhase } from '../shared/types'

type GameShellProps = {
  module: SpectatorGameModule
}

export function GameShell({ module }: GameShellProps) {
  const [playerCount, setPlayerCount] = useState(4)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [recordClean, setRecordClean] = useState(false)
  const [autoRecord, setAutoRecord] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingClip, setPendingClip] = useState<GameShellApi['pendingClip']>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [launchKey, setLaunchKey] = useState(0)

  const busy = phase === 'racing' || phase === 'countdown'
  const recordingSupported = isRecordingSupported()

  const shell: GameShellApi = useMemo(
    () => ({
      playerCount,
      setPlayerCount,
      phase,
      setPhase,
      busy,
      launchKey,
      launch: () => setLaunchKey((k) => k + 1),
      autoRecord,
      setAutoRecord,
      recordClean,
      setRecordClean,
      isRecording,
      setIsRecording,
      pendingClip,
      setPendingClip,
      recordingError,
      setRecordingError,
      recordingSupported,
    }),
    [
      playerCount,
      phase,
      busy,
      launchKey,
      autoRecord,
      recordClean,
      isRecording,
      pendingClip,
      recordingError,
      recordingSupported,
    ],
  )

  const { GameView, Controls } = module
  const content = (
    <div className={`app app--${module.id} ${recordClean ? 'app--record' : ''}`}>
      <header className="app__brand">
        <h1>{module.title}</h1>
        <p>{module.blurb}</p>
      </header>

      <div className="stage">
        {module.available ? (
          <GameView shell={shell} />
        ) : (
          <div className="coming-soon" role="status">
            <span>Coming soon</span>
          </div>
        )}

        {isRecording && (
          <div className="rec-badge" aria-live="polite">
            <span className="rec-badge__dot" />
            REC
          </div>
        )}

        {!recordClean && module.available && phase === 'idle' && (
          <div className="stage__overlay stage__overlay--idle">
            <span>{module.idleHint ?? 'Tap Launch to start'}</span>
          </div>
        )}
      </div>

      {module.available && (
        <div className="controls">
          <Controls shell={shell} />
        </div>
      )}
    </div>
  )

  if (module.id === 'bounce-race') {
    return <BounceRaceShell>{content}</BounceRaceShell>
  }

  if (module.id === 'domino-heist') {
    return <DominoHeistShell>{content}</DominoHeistShell>
  }

  if (module.id === 'laser-roulette') {
    return <LaserRouletteShell>{content}</LaserRouletteShell>
  }

  if (module.id === 'bubble-war') {
    return <BubbleWarShell>{content}</BubbleWarShell>
  }

  if (module.id === 'greedy-grab') {
    return <GreedyGrabShell>{content}</GreedyGrabShell>
  }

  return content
}
