import type { GameControlsProps } from '../../shared/module'
import { useCascade } from './CascadeSession'
import { formatMoney } from './format'

export function CascadeControls({ shell }: GameControlsProps) {
  const cascade = useCascade()
  const snap = cascade.snap

  return (
    <>
      <div className="settings-row">
        <label className="setting">
          <span>Auto run</span>
          <button
            type="button"
            className={`spectacle-toggle ${cascade.running ? 'spectacle-toggle--on' : ''}`}
            onClick={() => cascade.setRunning(!cascade.running)}
          >
            {cascade.running ? 'On' : 'Paused'}
          </button>
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => cascade.reset()}
        >
          Reset
        </button>
      </div>

      <div className="sliders-row cascade-stats">
        <span>
          Emitters · {snap?.emitters.length ?? 1}
        </span>
        <span>
          Interval · {(snap?.dropInterval ?? 0).toFixed(2)}s
        </span>
        <span>
          Bounce · {((snap?.restitution ?? 0) * 100).toFixed(0)}%
        </span>
        <span>
          Dropped · {formatMoney(snap?.ballsDropped ?? 0, 0)}
        </span>
      </div>

      {shell.recordingError && (
        <p className="recording-error" role="alert">
          {shell.recordingError}
        </p>
      )}
    </>
  )
}
