import { useEffect } from 'react'
import type { GameViewProps } from '../../shared/module'
import { GateCanvas } from './GateCanvas'
import { useGateRush } from './GateRushSession'

export function GateGameView({ shell }: GameViewProps) {
  const rush = useGateRush()
  const { snap } = rush

  useEffect(() => {
    const phase = snap.phase
    if (phase === 'ready') shell.setPhase('idle')
    else if (phase === 'won' || phase === 'lost') shell.setPhase('finished')
    else shell.setPhase('racing')
  }, [snap.phase, shell.setPhase])

  return (
    <div className="gate-layout">
      <GateCanvas
        worldRef={rush.worldRef}
        running={rush.running}
        autoRecord={shell.autoRecord}
        onSnapshot={rush.setSnap}
        onRecordingChange={shell.setIsRecording}
        onRecordingReady={(blob, filename, durationSec) => {
          shell.setPendingClip({ blob, filename, durationSec })
          shell.setRecordingError(null)
        }}
        onRecordingError={(message) => {
          shell.setRecordingError(message)
          shell.setIsRecording(false)
        }}
      />
      <div className="gate-hud" aria-hidden>
        <div className="gate-hud__bar">
          <span>RUN</span>
          <div className="gate-hud__track">
            <div
              className="gate-hud__fill"
              style={{ width: `${Math.round(snap.progress * 100)}%` }}
            />
          </div>
          <span>BOSS</span>
        </div>
        {snap.streak >= 2 && snap.phase === 'running' && (
          <div className="gate-hud__streak">STREAK ×{snap.streak}</div>
        )}
        {snap.banner && (
          <div className="gate-hud__banner" style={{ color: snap.banner.color }}>
            {snap.banner.text}
          </div>
        )}
      </div>
    </div>
  )
}
