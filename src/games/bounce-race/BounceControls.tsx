import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { PRESET_OPTIONS, useBounceRace } from './BounceRaceSession'

export function BounceControls({ shell }: GameControlsProps) {
  const bounce = useBounceRace()
  const {
    busy,
    phase,
    launch,
    recordClean,
    setRecordClean,
    autoRecord,
    setAutoRecord,
    recordingSupported,
    pendingClip,
    recordingError,
    setRecordingError,
  } = shell

  return (
    <>
      <div className="course-pills" role="tablist" aria-label="Course selection">
        {PRESET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={bounce.course === option.id}
            className={`pill ${bounce.course === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              bounce.setCourse(option.id)
              shell.setPhase('idle')
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="settings-row">
        <label className="setting">
          <span>Players</span>
          <select
            value={shell.playerCount}
            disabled={busy}
            onChange={(event) => shell.setPlayerCount(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <div className="setting">
          <span>Shape</span>
          <div className="shape-toggle">
            {(['square', 'ball'] as const).map((shape) => (
              <button
                key={shape}
                type="button"
                disabled={busy}
                className={`shape-option ${bounce.playerShape === shape ? 'shape-option--active' : ''}`}
                aria-pressed={bounce.playerShape === shape}
                onClick={() => bounce.setPlayerShape(shape)}
              >
                {shape === 'square' ? 'Square' : 'Ball'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sliders-row">
        <label className="setting setting--slider">
          <span>Barrier HP · {bounce.barrierHealth}</span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={bounce.barrierHealth}
            disabled={busy}
            onChange={(event) => bounce.setBarrierHealth(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Chevron speed · {bounce.wallSpeed}</span>
          <input
            type="range"
            min={10}
            max={120}
            step={1}
            value={bounce.wallSpeed}
            disabled={busy}
            onChange={(event) => bounce.setWallSpeed(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Chevron angle · {bounce.chevronAngle}°</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={bounce.chevronAngle}
            disabled={busy}
            onChange={(event) => bounce.setChevronAngle(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Crush toughness · {bounce.crushMargin}</span>
          <input
            type="range"
            min={0}
            max={16}
            step={1}
            value={bounce.crushMargin}
            disabled={busy}
            title="Higher = harder to get crushed between chevron and platforms"
            onChange={(event) => bounce.setCrushMargin(Number(event.target.value))}
          />
        </label>
      </div>

      {bounce.course === 'procedural' && (
        <div className="seed-row">
          <span className="seed-label">Seed {bounce.seed}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              bounce.newSeed()
              shell.setPhase('idle')
            }}
          >
            New seed
          </button>
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={launch}
          disabled={busy}
        >
          {phase === 'finished'
            ? 'Replay'
            : phase === 'countdown'
              ? 'Countdown…'
              : phase === 'racing'
                ? 'Racing…'
                : 'Launch'}
        </button>
        {phase === 'finished' && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              bounce.nextPreset()
              shell.setPhase('idle')
            }}
          >
            Next course
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={bounce.startReel}
        >
          Best-of reel
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${bounce.randomizeBounces ? 'btn--active' : ''}`}
          aria-pressed={bounce.randomizeBounces}
          disabled={busy}
          title="Adds up to one degree of random variation to each bounce"
          onClick={() => bounce.setRandomizeBounces(!bounce.randomizeBounces)}
        >
          Variation: {bounce.randomizeBounces ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${bounce.showSpectacle ? 'btn--active' : ''}`}
          disabled={busy}
          onClick={() => bounce.setShowSpectacle(!bounce.showSpectacle)}
        >
          Spectacle
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
              ? 'Auto-record each race to a WebM file'
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

      {(pendingClip || recordingError) && (
        <p className="hint hint--recording">
          {recordingError
            ? recordingError
            : pendingClip
              ? `Ready · ${Math.round(pendingClip.durationSec)}s · ${pendingClip.filename}`
              : null}
        </p>
      )}

      {bounce.showSpectacle && (
        <div className="spectacle-panel">
          {(['Hook', 'Escalation', 'Payoff', 'Style'] as const).map((group) => (
            <div key={group} className="spectacle-group">
              <div className="spectacle-group__head">
                <strong>{group}</strong>
                <div className="spectacle-group__actions">
                  <button type="button" disabled={busy} onClick={() => bounce.setGroup(group, true)}>
                    All on
                  </button>
                  <button type="button" disabled={busy} onClick={() => bounce.setGroup(group, false)}>
                    All off
                  </button>
                </div>
              </div>
              <div className="spectacle-toggles">
                {bounce.SETTING_TOGGLES.filter((toggle) => toggle.group === group).map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    disabled={busy}
                    className={`spectacle-toggle ${bounce.settings[toggle.key] ? 'spectacle-toggle--on' : ''}`}
                    aria-pressed={bounce.settings[toggle.key]}
                    onClick={() => bounce.toggleSetting(toggle.key)}
                  >
                    {toggle.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="hint">
        {recordClean
          ? 'Recording mode — only the canvas is visible.'
          : bounce.reelStatus
            ? bounce.reelStatus
            : bounce.lastMetrics
              ? `Last race score ${Math.round(bounce.scoreRace(bounce.lastMetrics))} · ${bounce.lastMetrics.brickBreaks} breaks · ${bounce.lastMetrics.eliminations} outs`
              : bounce.levelHint}
      </p>

      {bounce.highlights.length > 0 && (
        <div className="highlights">
          {bounce.highlights.map((item, index) => (
            <div key={`${item.winner}-${index}`} className="highlight-card">
              <span>#{index + 1}</span>
              <span>{item.winner ?? 'No winner'}</span>
              <span>{Math.round(bounce.scoreRace(item))} pts</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
