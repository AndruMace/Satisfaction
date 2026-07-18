import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { PRESET_OPTIONS, useDominoHeist } from './DominoSession'

export function DominoControls({ shell }: GameControlsProps) {
  const heist = useDominoHeist()
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
            aria-selected={heist.course === option.id}
            className={`pill ${heist.course === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              heist.setCourse(option.id)
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
          <span>Tip force · {heist.tipForce.toFixed(2)}</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={heist.tipForce}
            disabled={busy}
            onChange={(event) => heist.setTipForce(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Chaos / wind · {heist.chaos.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={heist.chaos}
            disabled={busy}
            onChange={(event) => heist.setChaos(Number(event.target.value))}
          />
        </label>
      </div>

      {heist.course === 'procedural' && (
        <div className="seed-row">
          <span className="seed-label">Seed {heist.seed}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              heist.newSeed()
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
                ? 'Heisting…'
                : 'Launch'}
        </button>
        {phase === 'finished' && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              heist.nextPreset()
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
          onClick={heist.startReel}
        >
          Best-of reel
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${heist.showSpectacle ? 'btn--active' : ''}`}
          disabled={busy}
          onClick={() => heist.setShowSpectacle(!heist.showSpectacle)}
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
              ? 'Auto-record each heist to a WebM file'
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

      {heist.showSpectacle && (
        <div className="spectacle-panel">
          {(['Hook', 'Escalation', 'Payoff', 'Style'] as const).map((group) => (
            <div key={group} className="spectacle-group">
              <div className="spectacle-group__head">
                <strong>{group}</strong>
                <div className="spectacle-group__actions">
                  <button type="button" disabled={busy} onClick={() => heist.setGroup(group, true)}>
                    All on
                  </button>
                  <button type="button" disabled={busy} onClick={() => heist.setGroup(group, false)}>
                    All off
                  </button>
                </div>
              </div>
              <div className="spectacle-toggles">
                {heist.SETTING_TOGGLES.filter((toggle) => toggle.group === group).map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    disabled={busy}
                    className={`spectacle-toggle ${heist.settings[toggle.key] ? 'spectacle-toggle--on' : ''}`}
                    aria-pressed={heist.settings[toggle.key]}
                    onClick={() => heist.toggleSetting(toggle.key)}
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
          : heist.reelStatus
            ? heist.reelStatus
            : heist.lastMetrics
              ? `Last heist score ${Math.round(heist.scoreHeist(heist.lastMetrics))} · ${heist.lastMetrics.tips} tips · ${heist.lastMetrics.shatters} shatters · ${heist.lastMetrics.eliminations} outs`
              : heist.levelHint}
      </p>

      {heist.highlights.length > 0 && (
        <div className="highlights">
          {heist.highlights.map((item, index) => (
            <div key={`${item.winner}-${index}`} className="highlight-card">
              <span>#{index + 1}</span>
              <span>{item.winner ?? 'No winner'}</span>
              <span>{Math.round(heist.scoreHeist(item))} pts</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
