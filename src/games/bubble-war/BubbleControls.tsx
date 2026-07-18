import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { PRESET_OPTIONS, useBubbleWar } from './BubbleWarSession'

export function BubbleControls({ shell }: GameControlsProps) {
  const bubble = useBubbleWar()
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
            aria-selected={bubble.course === option.id}
            className={`pill ${bubble.course === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              bubble.setCourse(option.id)
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
          <span>Growth rate · {bubble.growthRate.toFixed(1)}</span>
          <input
            type="range"
            min={2}
            max={16}
            step={0.5}
            value={bubble.growthRate}
            disabled={busy}
            onChange={(event) => bubble.setGrowthRate(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Hazard density · {Math.round(bubble.hazardDensity * 100)}%</span>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={bubble.hazardDensity}
            disabled={busy}
            onChange={(event) => {
              bubble.setHazardDensity(Number(event.target.value))
              if (bubble.course === 'procedural') shell.setPhase('idle')
            }}
          />
        </label>
      </div>

      {bubble.course === 'procedural' && (
        <div className="seed-row">
          <span className="seed-label">Seed {bubble.seed}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              bubble.newSeed()
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
                ? 'Inflating…'
                : 'Launch'}
        </button>
        {phase === 'finished' && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              bubble.nextPreset()
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
          onClick={bubble.startReel}
        >
          Best-of reel
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${bubble.showSpectacle ? 'btn--active' : ''}`}
          disabled={busy}
          onClick={() => bubble.setShowSpectacle(!bubble.showSpectacle)}
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

      {bubble.showSpectacle && (
        <div className="spectacle-panel">
          {(['Hook', 'Escalation', 'Payoff', 'Style'] as const).map((group) => (
            <div key={group} className="spectacle-group">
              <div className="spectacle-group__head">
                <strong>{group}</strong>
                <div className="spectacle-group__actions">
                  <button type="button" disabled={busy} onClick={() => bubble.setGroup(group, true)}>
                    All on
                  </button>
                  <button type="button" disabled={busy} onClick={() => bubble.setGroup(group, false)}>
                    All off
                  </button>
                </div>
              </div>
              <div className="spectacle-toggles">
                {bubble.SETTING_TOGGLES.filter((toggle) => toggle.group === group).map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    disabled={busy}
                    className={`spectacle-toggle ${bubble.settings[toggle.key] ? 'spectacle-toggle--on' : ''}`}
                    aria-pressed={bubble.settings[toggle.key]}
                    onClick={() => bubble.toggleSetting(toggle.key)}
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
          : bubble.reelStatus
            ? bubble.reelStatus
            : bubble.lastMetrics
              ? `Last match score ${Math.round(bubble.scoreMatch(bubble.lastMetrics))} · ${bubble.lastMetrics.pops} pops · ${bubble.lastMetrics.shoves} shoves`
              : bubble.levelHint}
      </p>

      {bubble.highlights.length > 0 && (
        <div className="highlights">
          {bubble.highlights.map((item, index) => (
            <div key={`${item.winner}-${index}`} className="highlight-card">
              <span>#{index + 1}</span>
              <span>{item.winner ?? 'No winner'}</span>
              <span>{Math.round(bubble.scoreMatch(item))} pts</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
