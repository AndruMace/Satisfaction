import type { GameControlsProps } from '../../shared/module'
import { useSquish } from './SquishSession'

export function SquishControls({ shell }: GameControlsProps) {
  const squish = useSquish()
  const { snap } = squish
  const pct = Math.min(100, Math.round(snap.fillRatio * 100))

  return (
    <>
      <div className="settings-row">
        <button
          type="button"
          className={`spectacle-toggle ${squish.auto ? 'spectacle-toggle--on' : ''}`}
          onClick={() => squish.setAuto(!squish.auto)}
        >
          Auto drop · {squish.auto ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={`spectacle-toggle ${squish.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => squish.setRunning(!squish.running)}
        >
          {squish.running ? 'Running' : 'Paused'}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => squish.reset()}>
          Reset
        </button>
      </div>

      <p className="squish-hint">
        Soft gel shapes pack into the glass jar. Tap the rim to drop the next piece.
        {snap.phase === 'won'
          ? ' Lid sealed — perfect fill!'
          : snap.phase === 'crowded'
            ? ' Crowded — last pieces need to squeeze…'
            : ''}{' '}
        Volume {pct}%.
      </p>

      {shell.recordingError && (
        <p className="recording-error" role="alert">
          {shell.recordingError}
        </p>
      )}
    </>
  )
}
