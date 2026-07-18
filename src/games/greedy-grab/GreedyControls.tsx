import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { PRESET_OPTIONS, useGreedyGrab } from './GreedyGrabSession'

export function GreedyControls({ shell }: GameControlsProps) {
  const grab = useGreedyGrab()
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
            aria-selected={grab.course === option.id}
            className={`pill ${grab.course === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              grab.setCourse(option.id)
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

        <label className="setting">
          <span>Deposit</span>
          <div className="shape-toggle">
            <button
              type="button"
              disabled={busy}
              className={`shape-option ${grab.depositRequired ? 'shape-option--active' : ''}`}
              aria-pressed={grab.depositRequired}
              onClick={() => grab.setDepositRequired(true)}
            >
              Required
            </button>
            <button
              type="button"
              disabled={busy}
              className={`shape-option ${!grab.depositRequired ? 'shape-option--active' : ''}`}
              aria-pressed={!grab.depositRequired}
              onClick={() => grab.setDepositRequired(false)}
            >
              Carry OK
            </button>
          </div>
        </label>
      </div>

      <div className="sliders-row">
        <label className="setting setting--slider">
          <span>Greed weight · {grab.greedWeight.toFixed(1)}</span>
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.1}
            value={grab.greedWeight}
            disabled={busy}
            onChange={(event) => grab.setGreedWeight(Number(event.target.value))}
          />
        </label>

        <label className="setting setting--slider">
          <span>Round · {grab.roundLength}s</span>
          <input
            type="range"
            min={20}
            max={90}
            step={5}
            value={grab.roundLength}
            disabled={busy}
            onChange={(event) => grab.setRoundLength(Number(event.target.value))}
          />
        </label>
      </div>

      {grab.course === 'procedural' && (
        <div className="seed-row">
          <span className="seed-label">Seed {grab.seed}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              grab.newSeed()
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
                ? 'Grabbing…'
                : 'Launch'}
        </button>
        {phase === 'finished' && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              grab.nextPreset()
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
          onClick={grab.startReel}
        >
          Best-of reel
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${grab.bankOnElim ? 'btn--active' : ''}`}
          aria-pressed={grab.bankOnElim}
          disabled={busy}
          title="Bank carried coins when falling into a pit"
          onClick={() => grab.setBankOnElim(!grab.bankOnElim)}
        >
          Bank on elim: {grab.bankOnElim ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${grab.showSpectacle ? 'btn--active' : ''}`}
          disabled={busy}
          onClick={() => grab.setShowSpectacle(!grab.showSpectacle)}
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
              ? 'Auto-record each round to a WebM file'
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

      {grab.showSpectacle && (
        <div className="spectacle-panel">
          {(['Hook', 'Escalation', 'Payoff', 'Style'] as const).map((group) => (
            <div key={group} className="spectacle-group">
              <div className="spectacle-group__head">
                <strong>{group}</strong>
                <div className="spectacle-group__actions">
                  <button type="button" disabled={busy} onClick={() => grab.setGroup(group, true)}>
                    All on
                  </button>
                  <button type="button" disabled={busy} onClick={() => grab.setGroup(group, false)}>
                    All off
                  </button>
                </div>
              </div>
              <div className="spectacle-toggles">
                {grab.SETTING_TOGGLES.filter((toggle) => toggle.group === group).map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    disabled={busy}
                    className={`spectacle-toggle ${grab.settings[toggle.key] ? 'spectacle-toggle--on' : ''}`}
                    aria-pressed={grab.settings[toggle.key]}
                    onClick={() => grab.toggleSetting(toggle.key)}
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
          : grab.reelStatus
            ? grab.reelStatus
            : grab.lastMetrics
              ? `Last round score ${Math.round(grab.scoreGrab(grab.lastMetrics))} · ${grab.lastMetrics.coinsCollected} coins · ${grab.lastMetrics.eliminations} outs`
              : grab.levelHint}
      </p>

      {grab.highlights.length > 0 && (
        <div className="highlights">
          {grab.highlights.map((item, index) => (
            <div key={`${item.winner}-${index}`} className="highlight-card">
              <span>#{index + 1}</span>
              <span>{item.winner ?? 'No winner'}</span>
              <span>{Math.round(grab.scoreGrab(item))} pts</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
