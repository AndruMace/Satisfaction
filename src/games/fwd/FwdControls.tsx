import type { GameControlsProps } from '../../shared/module'
import { formatDailyTime } from './daily'
import { DailyShareButton } from './DailyShareButton'
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

export function FwdControls({ shell }: GameControlsProps) {
  const fwd = useFwd()
  const { snap } = fwd
  const statusLabel = snap.dailyCompleted
    ? 'Complete'
    : snap.dailyRankedCommitted
      ? 'Ranked'
      : 'Practice'

  return (
    <>
      <div className="settings-row">
        <button
          type="button"
          className={`pill ${fwd.mode === 'explore' ? 'pill--active' : ''}`}
          onClick={() => fwd.setMode('explore')}
        >
          Explore
        </button>
        <button
          type="button"
          className={`pill ${fwd.mode === 'daily' ? 'pill--active' : ''}`}
          onClick={() => fwd.setMode('daily')}
        >
          Daily
        </button>
        <button
          type="button"
          className={`pill ${fwd.mode === 'infinite' ? 'pill--active' : ''}`}
          onClick={() => fwd.setMode('infinite')}
        >
          Infinite
        </button>
      </div>

      {fwd.mode === 'explore' && (
        <div className="settings-row">
          <button type="button" className="btn" onClick={() => fwd.goPrev()}>
            Prev
          </button>
          <span className="fwd-level-pill">
            {snap.levelIndex + 1}/{snap.levelTotal} · {snap.levelName}
          </span>
          <button type="button" className="btn" onClick={() => fwd.goNext()}>
            Next
          </button>
        </div>
      )}

      <p className="fwd-hint">{fwd.hint}</p>

      {fwd.mode === 'infinite' && (
        <section className="fwd-seed-controls" aria-label="Infinite seed controls">
          <div className="fwd-seed-current">
            <span>Current seed</span>
            <code>{snap.seedLabel}</code>
            <button type="button" className="btn" onClick={() => fwd.replaySeed()}>
              Replay
            </button>
          </div>
          <div className="fwd-seed-input">
            <input
              type="text"
              value={fwd.seedInput}
              placeholder="Enter any seed or phrase"
              aria-label="Custom Infinite seed"
              onChange={(event) => fwd.setSeedInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') fwd.runSeed()
              }}
            />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!fwd.seedInput.trim()}
              onClick={() => fwd.runSeed()}
            >
              Run seed
            </button>
          </div>
        </section>
      )}

      {fwd.mode === 'daily' && (
        <section className="fwd-daily-panel" aria-label="Daily puzzle progress">
          <div className="fwd-daily-panel__heading">
            <div>
              <span className="fwd-daily-panel__eyebrow">UTC daily puzzle</span>
              <strong>Fwd Daily #{snap.dailyPuzzleNumber}</strong>
            </div>
            <span
              className={`fwd-daily-panel__mode ${
                snap.dailyCompleted
                  ? 'is-complete'
                  : snap.dailyPractice
                    ? 'is-practice'
                    : ''
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="fwd-daily-stats">
            <span>
              <small>Result</small>
              <strong>
                {snap.dailyCompleted ? formatDailyTime(snap.dailyBestTime) : 'Open'}
              </strong>
            </span>
            <span>
              <small>Deaths</small>
              <strong>{snap.dailyDeaths}</strong>
            </span>
            <span>
              <small>Streak</small>
              <strong>{snap.dailyStreak}</strong>
            </span>
            <span>
              <small>Mode</small>
              <strong>{statusLabel}</strong>
            </span>
          </div>
          {!snap.dailyRankedCommitted && !snap.dailyCompleted && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => fwd.commitDailyRanked()}
            >
              Start Ranked Attempt
            </button>
          )}
          {snap.dailyCompleted && (
            <DailyShareButton className="btn btn--primary" record={dailyRecordFromSnap(snap)} />
          )}
          {fwd.isLocalhost && (
            <div className="fwd-daily-debug">
              <label className="fwd-daily-debug__date">
                <span>Daily date</span>
                <input
                  type="date"
                  value={snap.dailyDate}
                  aria-label="Daily puzzle date"
                  onChange={(event) => fwd.setDailyDateLocal(event.target.value)}
                />
              </label>
              <div className="fwd-daily-debug__actions">
                <button type="button" className="btn" onClick={() => fwd.shiftDailyDateLocal(-1)}>
                  Prev day
                </button>
                <button type="button" className="btn" onClick={() => fwd.resetDailyDateToToday()}>
                  Today
                </button>
                <button type="button" className="btn" onClick={() => fwd.shiftDailyDateLocal(1)}>
                  Next day
                </button>
              </div>
              <button type="button" className="btn fwd-daily-reset" onClick={() => fwd.clearDailyLocal()}>
                Clear Daily (localhost)
              </button>
            </div>
          )}
        </section>
      )}

      {fwd.mode === 'explore' ? (
        <section className="fwd-leaderboard" aria-label={`${snap.levelName} best times`}>
          <h3>Local best times</h3>
          {snap.levelTimes.length > 0 ? (
            <ol>
              {snap.levelTimes.map((time, index) => (
                <li key={`${time}-${index}`}>
                  <span>{formatRunTime(time)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No clears yet</p>
          )}
        </section>
      ) : fwd.mode === 'infinite' ? (
        <div className="fwd-leaderboards">
          <InfiniteBoard
            title="Distance"
            records={snap.distanceLeaders.map((record) => ({
              primary: `${Math.floor(record.distance)}m`,
              secondary: formatRunTime(record.elapsed),
            }))}
          />
          <InfiniteBoard
            title="Score"
            records={snap.scoreLeaders.map((record) => ({
              primary: formatScore(record.score),
              secondary: `${Math.floor(record.distance)}m · ${formatRunTime(record.elapsed)}`,
            }))}
          />
        </div>
      ) : null}

      {fwd.mode !== 'daily' && (
        <div className="settings-row">
          <button
            type="button"
            className={`pill ${fwd.speedPreset === 'normal' ? 'pill--active' : ''}`}
            onClick={() => fwd.setSpeed('normal')}
          >
            Normal
          </button>
          <button
            type="button"
            className={`pill ${fwd.speedPreset === 'fast' ? 'pill--active' : ''}`}
            onClick={() => fwd.setSpeed('fast')}
          >
            Fast
          </button>
        </div>
      )}

      <div className="settings-row">
        {snap.phase === 'idle' ? (
          <button type="button" className="btn btn--primary" onClick={() => fwd.launch()}>
            Launch
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => fwd.retry()}>
            {snap.phase === 'failed' ? 'Retry' : snap.phase === 'cleared' ? 'Replay' : 'Reset'}
          </button>
        )}
        <button
          type="button"
          className={`spectacle-toggle ${fwd.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => fwd.setRunning(!fwd.running)}
        >
          {fwd.running ? 'Running' : 'Paused'}
        </button>
      </div>

      {shell.recordingError && (
        <p className="recording-error" role="alert">
          {shell.recordingError}
        </p>
      )}
    </>
  )
}

function InfiniteBoard({
  title,
  records,
}: {
  title: string
  records: Array<{ primary: string; secondary: string }>
}) {
  return (
    <section className="fwd-leaderboard" aria-label={`Local ${title} leaderboard`}>
      <h3>{title}</h3>
      {records.length > 0 ? (
        <ol>
          {records.map((record, index) => (
            <li key={`${record.primary}-${record.secondary}-${index}`}>
              <span>{record.primary}</span>
              <small>{record.secondary}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>No runs yet</p>
      )}
    </section>
  )
}
