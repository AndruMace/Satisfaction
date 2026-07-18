import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { PRESET_OPTIONS, useLaser } from './LaserSession'

export function LaserControls({ shell }: GameControlsProps) {
  const laser = useLaser()
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

  const beamLabel =
    laser.beamCount <= 0
      ? `Beams · course (${laser.level.beams.length})`
      : `Beams · ${laser.beamCount}`

  return (
    <>
      <div className="course-pills" role="tablist" aria-label="Course selection">
        {PRESET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={laser.course === option.id}
            className={`pill ${laser.course === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              laser.setCourse(option.id)
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
      </div>

      <div className="sliders-row">
        <label className="setting setting--slider">
          <span>{beamLabel}</span>
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={laser.beamCount}
            disabled={busy}
            onChange={(event) => laser.setBeamCount(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Beam speed · {laser.beamSpeed.toFixed(2)}×</span>
          <input
            type="range"
            min={0.4}
            max={2.2}
            step={0.05}
            value={laser.beamSpeed}
            disabled={busy}
            onChange={(event) => laser.setBeamSpeed(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>AI aggression · {laser.aiAggression.toFixed(2)}</span>
          <input
            type="range"
            min={0.2}
            max={1.5}
            step={0.05}
            value={laser.aiAggression}
            disabled={busy}
            onChange={(event) => laser.setAiAggression(Number(event.target.value))}
          />
        </label>
      </div>

      {laser.course === 'procedural' && (
        <div className="seed-row">
          <span className="seed-label">Seed {laser.seed}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              laser.newSeed()
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
              laser.nextPreset()
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
          onClick={laser.startReel}
        >
          Best-of reel
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${laser.showSpectacle ? 'btn--active' : ''}`}
          disabled={busy}
          onClick={() => laser.setShowSpectacle(!laser.showSpectacle)}
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
              ? 'Auto-record each match to a WebM file'
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

      {laser.showSpectacle && (
        <div className="spectacle-panel">
          {(['Hook', 'Escalation', 'Payoff', 'Style'] as const).map((group) => (
            <div key={group} className="spectacle-group">
              <div className="spectacle-group__head">
                <strong>{group}</strong>
                <div className="spectacle-group__actions">
                  <button type="button" disabled={busy} onClick={() => laser.setGroup(group, true)}>
                    All on
                  </button>
                  <button type="button" disabled={busy} onClick={() => laser.setGroup(group, false)}>
                    All off
                  </button>
                </div>
              </div>
              <div className="spectacle-toggles">
                {laser.SETTING_TOGGLES.filter((toggle) => toggle.group === group).map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    disabled={busy}
                    className={`spectacle-toggle ${laser.settings[toggle.key] ? 'spectacle-toggle--on' : ''}`}
                    aria-pressed={laser.settings[toggle.key]}
                    onClick={() => laser.toggleSetting(toggle.key)}
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
          : laser.reelStatus
            ? laser.reelStatus
            : laser.lastMetrics
              ? `Last match score ${Math.round(laser.scoreMatch(laser.lastMetrics))} · ${laser.lastMetrics.eliminations} outs · ${laser.lastMetrics.nearMisses} near-misses`
              : laser.levelHint}
      </p>

      {laser.highlights.length > 0 && (
        <div className="highlights">
          {laser.highlights.map((item, index) => (
            <div key={`${item.winner}-${index}`} className="highlight-card">
              <span>#{index + 1}</span>
              <span>{item.winner ?? 'No winner'}</span>
              <span>{Math.round(laser.scoreMatch(item))} pts</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
