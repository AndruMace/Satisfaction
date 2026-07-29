import type { GameControlsProps } from '../../shared/module'
import { downloadBlob } from '../../shared/recorder'
import { useCascade } from './CascadeSession'
import { formatMoney } from './format'
import { GOAL_MAX, GOAL_MIN, GOAL_STEP } from './shorts'

export function CascadeControls({ shell }: GameControlsProps) {
  const cascade = useCascade()
  const snap = cascade.snap
  const ended = snap.phase === 'finished'
  const busy = snap.phase === 'running'
  const {
    autoRecord,
    setAutoRecord,
    recordClean,
    setRecordClean,
    pendingClip,
    recordingError,
    setRecordingError,
    recordingSupported,
  } = shell

  return (
    <>
      <div className="settings-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => cascade.play()}
        >
          {snap.phase === 'ready' ? 'Launch' : ended ? 'Replay' : 'Restart'}
        </button>
        <button
          type="button"
          className={`spectacle-toggle ${cascade.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => cascade.setRunning(!cascade.running)}
          disabled={snap.phase === 'ready'}
        >
          {cascade.running ? 'Running' : 'Paused'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => cascade.reset()}
          disabled={busy}
        >
          Reset
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${recordClean ? 'btn--active' : ''}`}
          onClick={() => setRecordClean(!recordClean)}
        >
          {recordClean ? 'Show UI' : 'Record clean'}
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${autoRecord ? 'btn--active' : ''}`}
          aria-pressed={autoRecord}
          disabled={!recordingSupported || busy}
          title={
            recordingSupported
              ? 'Auto-record each run to a WebM file'
              : 'Recording is not supported in this browser'
          }
          onClick={() => {
            setAutoRecord(!autoRecord)
            setRecordingError(null)
          }}
        >
          Auto-record: {autoRecord ? 'On' : 'Off'}
        </button>
        {pendingClip && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => downloadBlob(pendingClip.blob, pendingClip.filename)}
          >
            Download clip
          </button>
        )}
      </div>

      <div className="sliders-row">
        <label className="setting setting--slider">
          <span>
            Money goal · ${formatMoney(cascade.moneyGoal)} · ~
            {cascade.runLimitSec}s cap
          </span>
          <input
            type="range"
            min={GOAL_MIN}
            max={GOAL_MAX}
            step={GOAL_STEP}
            value={cascade.moneyGoal}
            disabled={busy}
            onChange={(event) =>
              cascade.setMoneyGoal(Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="sliders-row cascade-stats">
        <span>Emitters · {snap.emitters.length}</span>
        <span>Interval · {snap.dropInterval.toFixed(2)}s</span>
        <span>Bounce · {(snap.restitution * 100).toFixed(0)}%</span>
        <span>Dropped · {formatMoney(snap.ballsDropped, 0)}</span>
        <span>Best combo · ×{snap.bestCombo}</span>
      </div>

      <p className="cascade-hint">
        {snap.phase === 'ready'
          ? 'Launch to grow the board — hit the goal before time runs out.'
          : snap.phase === 'finished'
            ? `Run complete · $${formatMoney(snap.treasury)} · best combo ×${snap.bestCombo}.`
            : `Auto-buying upgrades · $${formatMoney(snap.treasury)} / $${formatMoney(snap.moneyGoal)}.`}
      </p>

      {(pendingClip || recordingError) && (
        <p
          className="hint hint--recording"
          role={recordingError ? 'alert' : undefined}
        >
          {recordingError
            ? recordingError
            : pendingClip
              ? `Ready · ${Math.round(pendingClip.durationSec)}s · ${pendingClip.filename}`
              : null}
        </p>
      )}
    </>
  )
}
