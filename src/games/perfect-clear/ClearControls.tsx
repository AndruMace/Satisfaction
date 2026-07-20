import type { GameControlsProps } from '../../shared/module'
import { usePerfectClear } from './PerfectClearSession'

export function ClearControls({ shell }: GameControlsProps) {
  const clear = usePerfectClear()
  const { snap } = clear
  const cleared = snap.phase === 'cleared'
  const failed = snap.phase === 'failed'

  return (
    <>
      <div className="settings-row">
        <button type="button" className="btn" onClick={() => clear.goPrev()}>
          Prev
        </button>
        <span className="clear-level-pill">
          Level {clear.levelIndex + 1}/{clear.levelTotal}
        </span>
        <button type="button" className="btn" onClick={() => clear.goNext()}>
          Next
        </button>
      </div>

      <p className="clear-hint">{clear.hint}</p>

      <div className="settings-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => clear.retry()}
        >
          {failed ? 'Retry' : cleared ? 'Replay' : 'Reset'}
        </button>
        {cleared && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => clear.goNext()}
          >
            Next Pattern
          </button>
        )}
        <button
          type="button"
          className={`spectacle-toggle ${clear.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => clear.setRunning(!clear.running)}
        >
          {clear.running ? 'Running' : 'Paused'}
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
