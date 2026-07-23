import { useEffect, useState } from 'react'
import type { GameViewProps } from '../../shared/module'
import { formatDailyTime } from './daily'
import { DailyShareButton } from './DailyShareButton'
import { FwdCanvas } from './FwdCanvas'
import { useFwd } from './FwdSession'
import { formatRunTime, formatScore } from './format'

function dailyRecordFromSnap(snap: ReturnType<typeof useFwd>['snap']) {
  return {
    date: snap.dailyDate,
    puzzleNumber: snap.dailyPuzzleNumber,
    rankedCommitted: snap.dailyRankedCommitted,
    clears: snap.dailyClears.map((elapsed) => ({ elapsed })),
    deaths: snap.dailyDeaths,
    streak: snap.dailyStreak,
  }
}

export function FwdGameView({ shell }: GameViewProps) {
  const fwd = useFwd()
  const { snap } = fwd

  useEffect(() => {
    shell.setPhase(snap.phase === 'idle' ? 'idle' : snap.phase === 'racing' ? 'racing' : 'finished')
    return () => shell.setPhase('idle')
  }, [snap.phase, shell])

  useEffect(() => {
    if (snap.phase !== 'racing') fwd.inputRef.current?.reset()
  }, [snap.phase, fwd.inputRef])

  const onTouch = (partial: { left?: boolean; right?: boolean; jump?: boolean }) => {
    fwd.inputRef.current?.setTouch(partial)
  }

  const dailyHudLabel = snap.dailyCompleted
    ? 'COMPLETE'
    : snap.dailyPractice
      ? 'PRACTICE'
      : 'RANKED'

  return (
    <div className={`fwd-layout${snap.phase === 'racing' ? ' fwd-layout--playing' : ''}`}>
      <FwdCanvas
        worldRef={fwd.worldRef}
        running={fwd.running}
        onSnapshot={fwd.setSnap}
        inputRef={fwd.inputRef}
        resetKey={fwd.resetKey}
      />

      <div className="fwd-hud" aria-live="polite">
        {snap.mode === 'explore' ? (
          <span>
            {snap.levelName} · {snap.levelIndex + 1}/{snap.levelTotal} ·{' '}
            {formatRunTime(snap.elapsed)}
          </span>
        ) : snap.mode === 'daily' ? (
          <span>
            DAILY #{snap.dailyPuzzleNumber} ·{' '}
            <span className={snap.dailyPractice && !snap.dailyCompleted ? 'fwd-hud__practice' : undefined}>
              {dailyHudLabel}
            </span>{' '}
            · {formatRunTime(snap.elapsed)}
          </span>
        ) : (
          <span>
            {Math.floor(snap.distance)}m · {formatRunTime(snap.elapsed)}
          </span>
        )}
        <span className="fwd-hud__status">
          {snap.mode === 'explore' && snap.hasGhost && (
            <span className="fwd-hud__ghost">
              PB GHOST · {formatRunTime(snap.ghostTime)}
            </span>
          )}
          {snap.boostT > 0 && (
            <span className="fwd-hud__boost">
              BOOST{snap.boostStacks > 1 ? ` ×${snap.boostStacks}` : ''}
            </span>
          )}
        </span>
      </div>

      {snap.phase === 'idle' && (
        <button
          type="button"
          className={`fwd-overlay fwd-overlay--idle${
            snap.mode === 'daily' && snap.dailyPractice && !snap.dailyCompleted
              ? ' fwd-overlay--practice'
              : ''
          }`}
          onClick={() => fwd.launch()}
        >
          {snap.mode === 'daily' ? (
            <>
              <span className="fwd-overlay__title">
                {snap.dailyCompleted
                  ? 'Practice Again'
                  : snap.dailyPractice
                    ? 'Practice Run'
                    : 'Ranked Attempt'}
              </span>
              <span className="fwd-overlay__sub">
                {snap.dailyCompleted
                  ? 'Practice freely — your ranked time and deaths stay locked.'
                  : snap.dailyPractice
                    ? 'Auto-run, jump gaps, flip onto walls. Practice doesn’t count — start ranked when you’re ready.'
                    : 'Auto-run, jump gaps, flip onto walls. Deaths don’t end the attempt — only a clear locks it in.'}
              </span>
            </>
          ) : (
            <>
              <span className="fwd-overlay__title">Fwd</span>
              <span className="fwd-overlay__sub">Tap to launch · flip gravity on the walls</span>
            </>
          )}
        </button>
      )}

      {snap.phase === 'failed' && (
        <div className="fwd-overlay">
          <span className="fwd-overlay__title">Into the void</span>
          {snap.mode === 'infinite' ? (
            <>
              <span className="fwd-overlay__sub">
                {Math.floor(snap.distance)}m · {formatRunTime(snap.elapsed)}
              </span>
              <InfiniteScoreReveal
                distance={snap.distance}
                elapsed={snap.elapsed}
                score={snap.score}
              />
            </>
          ) : snap.mode === 'daily' ? (
            <span className="fwd-overlay__sub">
              {snap.dailyCompleted
                ? 'Practice run · ranked result locked'
                : snap.dailyPractice
                  ? 'Practice run · deaths do not count yet'
                  : `${snap.dailyDeaths} ${snap.dailyDeaths === 1 ? 'death' : 'deaths'} · ranked attempt still open`}
            </span>
          ) : (
            <span className="fwd-overlay__sub">
              {snap.levelName} · {formatRunTime(snap.elapsed)}
            </span>
          )}
          <button type="button" className="btn btn--primary" onClick={() => fwd.retry()}>
            Retry
          </button>
        </div>
      )}

      {snap.phase === 'cleared' && (
        <div className="fwd-overlay">
          <span className="fwd-overlay__title">Clear</span>
          <span className="fwd-overlay__sub">
            {snap.levelName} ·{' '}
            {snap.mode === 'daily' ? formatDailyTime(snap.elapsed) : formatRunTime(snap.elapsed)}
          </span>
          {snap.mode === 'daily' ? (
            <>
              <span className="fwd-overlay__sub">
                {snap.dailyCompleted && snap.dailyClears[0] === snap.elapsed
                  ? `Ranked clear locked · ${snap.dailyDeaths} ${snap.dailyDeaths === 1 ? 'death' : 'deaths'}`
                  : snap.dailyCompleted
                    ? `Practice clear · ranked ${formatDailyTime(snap.dailyBestTime)}`
                    : 'Practice clear · start ranked when you are ready'}
              </span>
              <div className="fwd-overlay__actions">
                {snap.dailyCompleted ? (
                  <DailyShareButton record={dailyRecordFromSnap(snap)} />
                ) : !snap.dailyRankedCommitted ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => fwd.commitDailyRanked()}
                  >
                    Start Ranked Attempt
                  </button>
                ) : null}
                <button type="button" className="btn btn--primary" onClick={() => fwd.retry()}>
                  {snap.dailyCompleted
                    ? 'Practice Again'
                    : snap.dailyRankedCommitted
                      ? 'Continue Ranked'
                      : 'Practice Again'}
                </button>
              </div>
            </>
          ) : (
            <div className="fwd-overlay__actions">
              <button type="button" className="btn" onClick={() => fwd.retry()}>
                Replay
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (snap.levelIndex + 1 >= snap.levelTotal) fwd.setMode('infinite')
                  else fwd.goNext()
                }}
              >
                {snap.levelIndex + 1 >= snap.levelTotal ? 'Infinite' : 'Next Level'}
              </button>
            </div>
          )}
        </div>
      )}

      {snap.phase === 'racing' && (
        <div className="fwd-touch" aria-hidden>
          <button
            type="button"
            className="fwd-touch__zone fwd-touch__zone--left"
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
            className="fwd-touch__jump"
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
            className="fwd-touch__zone fwd-touch__zone--right"
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
    <div className={`fwd-score-reveal ${done ? 'fwd-score-reveal--done' : ''}`}>
      <span className="fwd-score-reveal__formula">
        {distance.toFixed(1)}m × {averageSpeed.toFixed(2)} speed × 10
      </span>
      <strong>{formatScore(displayScore)}</strong>
      <span>score</span>
    </div>
  )
}
