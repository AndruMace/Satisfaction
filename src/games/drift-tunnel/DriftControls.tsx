import type { GameControlsProps } from '../../shared/module'
import { useDriftTunnel } from './DriftSession'
import { formatRunTime, formatScore } from './format'

export function DriftControls({ shell }: GameControlsProps) {
  const drift = useDriftTunnel()
  const { snap } = drift

  return (
    <>
      <div className="settings-row">
        <button
          type="button"
          className={`pill ${drift.mode === 'explore' ? 'pill--active' : ''}`}
          onClick={() => drift.setMode('explore')}
        >
          Explore
        </button>
        <button
          type="button"
          className={`pill ${drift.mode === 'infinite' ? 'pill--active' : ''}`}
          onClick={() => drift.setMode('infinite')}
        >
          Infinite
        </button>
      </div>

      {drift.mode === 'explore' && (
        <div className="settings-row">
          <button type="button" className="btn" onClick={() => drift.goPrev()}>
            Prev
          </button>
          <span className="drift-level-pill">
            {snap.levelIndex + 1}/{snap.levelTotal} · {snap.levelName}
          </span>
          <button type="button" className="btn" onClick={() => drift.goNext()}>
            Next
          </button>
        </div>
      )}

      <p className="drift-hint">{drift.hint}</p>

      {drift.mode === 'infinite' && (
        <section className="drift-seed-controls" aria-label="Infinite seed controls">
          <div className="drift-seed-current">
            <span>Current seed</span>
            <code>{snap.seedLabel}</code>
            <button type="button" className="btn" onClick={() => drift.replaySeed()}>
              Replay
            </button>
          </div>
          <div className="drift-seed-input">
            <input
              type="text"
              value={drift.seedInput}
              placeholder="Enter any seed or phrase"
              aria-label="Custom Infinite seed"
              onChange={(event) => drift.setSeedInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') drift.runSeed()
              }}
            />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!drift.seedInput.trim()}
              onClick={() => drift.runSeed()}
            >
              Run seed
            </button>
          </div>
        </section>
      )}

      {drift.mode === 'explore' ? (
        <section className="drift-leaderboard" aria-label={`${snap.levelName} best times`}>
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
      ) : (
        <div className="drift-leaderboards">
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
      )}

      <div className="settings-row">
        <button
          type="button"
          className={`pill ${drift.speedPreset === 'normal' ? 'pill--active' : ''}`}
          onClick={() => drift.setSpeed('normal')}
        >
          Normal
        </button>
        <button
          type="button"
          className={`pill ${drift.speedPreset === 'fast' ? 'pill--active' : ''}`}
          onClick={() => drift.setSpeed('fast')}
        >
          Fast
        </button>
      </div>

      <div className="settings-row">
        {snap.phase === 'idle' ? (
          <button type="button" className="btn btn--primary" onClick={() => drift.launch()}>
            Launch
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => drift.retry()}>
            {snap.phase === 'failed' ? 'Retry' : snap.phase === 'cleared' ? 'Replay' : 'Reset'}
          </button>
        )}
        <button
          type="button"
          className={`spectacle-toggle ${drift.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => drift.setRunning(!drift.running)}
        >
          {drift.running ? 'Running' : 'Paused'}
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
    <section className="drift-leaderboard" aria-label={`Local ${title} leaderboard`}>
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
