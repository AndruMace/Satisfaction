import { useEffect, useState } from 'react'
import type { GameViewProps } from '../../shared/module'
import { DriftCanvas } from './DriftCanvas'
import { useDriftTunnel } from './DriftSession'
import { formatRunTime, formatScore } from './format'

export function DriftGameView({ shell }: GameViewProps) {
  const drift = useDriftTunnel()
  const { snap } = drift

  useEffect(() => {
    shell.setPhase(snap.phase === 'idle' ? 'idle' : snap.phase === 'racing' ? 'racing' : 'finished')
    return () => shell.setPhase('idle')
  }, [snap.phase, shell])

  const onTouch = (partial: { left?: boolean; right?: boolean; jump?: boolean }) => {
    drift.inputRef.current?.setTouch(partial)
  }

  return (
    <div className="drift-layout">
      <DriftCanvas
        worldRef={drift.worldRef}
        running={drift.running}
        onSnapshot={drift.setSnap}
        inputRef={drift.inputRef}
        resetKey={drift.resetKey}
      />

      <div className="drift-hud" aria-live="polite">
        {snap.mode === 'explore' ? (
          <span>
            {snap.levelName} · {snap.levelIndex + 1}/{snap.levelTotal} ·{' '}
            {formatRunTime(snap.elapsed)}
          </span>
        ) : (
          <span>
            {Math.floor(snap.distance)}m · {formatRunTime(snap.elapsed)}
          </span>
        )}
        <span className="drift-hud__status">
          {snap.mode === 'explore' && snap.hasGhost && (
            <span className="drift-hud__ghost">
              PB GHOST · {formatRunTime(snap.ghostTime)}
            </span>
          )}
          {snap.boostT > 0 && (
            <span className="drift-hud__boost">
              BOOST{snap.boostStacks > 1 ? ` ×${snap.boostStacks}` : ''}
            </span>
          )}
        </span>
      </div>

      {snap.phase === 'idle' && (
        <button
          type="button"
          className="drift-overlay drift-overlay--idle"
          onClick={() => drift.launch()}
        >
          <span className="drift-overlay__title">Drift Tunnel</span>
          <span className="drift-overlay__sub">Tap to launch · flip gravity on the walls</span>
        </button>
      )}

      {snap.phase === 'failed' && (
        <div className="drift-overlay">
          <span className="drift-overlay__title">Into the void</span>
          {snap.mode === 'infinite' ? (
            <>
              <span className="drift-overlay__sub">
                {Math.floor(snap.distance)}m · {formatRunTime(snap.elapsed)}
              </span>
              <InfiniteScoreReveal
                distance={snap.distance}
                elapsed={snap.elapsed}
                score={snap.score}
              />
            </>
          ) : (
            <span className="drift-overlay__sub">
              {snap.levelName} · {formatRunTime(snap.elapsed)}
            </span>
          )}
          <button type="button" className="btn btn--primary" onClick={() => drift.retry()}>
            Retry
          </button>
        </div>
      )}

      {snap.phase === 'cleared' && (
        <div className="drift-overlay">
          <span className="drift-overlay__title">Clear</span>
          <span className="drift-overlay__sub">
            {snap.levelName} · {formatRunTime(snap.elapsed)}
          </span>
          <div className="drift-overlay__actions">
            <button type="button" className="btn" onClick={() => drift.retry()}>
              Replay
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                if (snap.levelIndex + 1 >= snap.levelTotal) drift.setMode('infinite')
                else drift.goNext()
              }}
            >
              {snap.levelIndex + 1 >= snap.levelTotal ? 'Infinite' : 'Next Level'}
            </button>
          </div>
        </div>
      )}

      {snap.phase === 'racing' && (
        <div className="drift-touch" aria-hidden>
          <button
            type="button"
            className="drift-touch__zone drift-touch__zone--left"
            onPointerDown={(e) => {
              e.preventDefault()
              onTouch({ left: true })
            }}
            onPointerUp={() => onTouch({ left: false })}
            onPointerLeave={() => onTouch({ left: false })}
            onPointerCancel={() => onTouch({ left: false })}
          />
          <button
            type="button"
            className="drift-touch__jump"
            onPointerDown={(e) => {
              e.preventDefault()
              onTouch({ jump: true })
            }}
            onPointerUp={() => onTouch({ jump: false })}
            onPointerLeave={() => onTouch({ jump: false })}
            onPointerCancel={() => onTouch({ jump: false })}
          >
            Jump
          </button>
          <button
            type="button"
            className="drift-touch__zone drift-touch__zone--right"
            onPointerDown={(e) => {
              e.preventDefault()
              onTouch({ right: true })
            }}
            onPointerUp={() => onTouch({ right: false })}
            onPointerLeave={() => onTouch({ right: false })}
            onPointerCancel={() => onTouch({ right: false })}
          />
        </div>
      )}
    </div>
  )
}

function InfiniteScoreReveal({
  distance,
  elapsed,
  score,
}: {
  distance: number
  elapsed: number
  score: number
}) {
  const [displayScore, setDisplayScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let raf = 0
    const delay = 280
    const duration = 1450
    const started = performance.now()
    const frame = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started - delay) / duration))
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.floor(score * eased))
      if (progress < 1) raf = requestAnimationFrame(frame)
      else setDone(true)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const averageSpeed = elapsed > 0 ? distance / elapsed : 0
  return (
    <div className={`drift-score-reveal ${done ? 'drift-score-reveal--done' : ''}`}>
      <span className="drift-score-reveal__formula">
        {distance.toFixed(1)}m × {averageSpeed.toFixed(2)} speed × 10
      </span>
      <strong>{formatScore(displayScore)}</strong>
      <span>score</span>
    </div>
  )
}
