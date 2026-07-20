import { useState } from 'react'
import { downloadBlob } from '../../shared/recorder'
import type { GameControlsProps } from '../../shared/module'
import { MOOD_OPTIONS, useDominoHeist } from './DominoSession'
import { TUNE_SLIDERS } from './settings'

export function DominoControls({ shell }: GameControlsProps) {
  const heist = useDominoHeist()
  const [exportStatus, setExportStatus] = useState<string | null>(null)
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

  const exportSettings = async () => {
    const payload = {
      mood: heist.mood,
      seed: heist.seed,
      tune: heist.tune,
    }
    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setExportStatus('Copied')
      window.setTimeout(() => setExportStatus(null), 1600)
    } catch {
      setExportStatus('Copy failed')
      window.setTimeout(() => setExportStatus(null), 2000)
    }
  }

  return (
    <>
      <div className="course-pills" role="tablist" aria-label="Layout mood">
        {MOOD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={heist.mood === option.id}
            className={`pill ${heist.mood === option.id ? 'pill--active' : ''}`}
            onClick={() => {
              heist.setMood(option.id)
              shell.setPhase('idle')
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="tune-panel">
        <div className="tune-panel__head">
          <span className="tune-panel__title">Cascade tweaks</span>
          <div className="tune-panel__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void exportSettings()}
            >
              {exportStatus ?? 'Export settings'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                heist.resetTune()
                shell.setPhase('idle')
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="tune-grid" role="group" aria-label="Physics and layout">
          {TUNE_SLIDERS.map((slider) => {
            const value = heist.tune[slider.key]
            const display = slider.format ? slider.format(value) : String(value)
            return (
              <label key={slider.key} className="setting setting--slider">
                <span>
                  {slider.label} · {display}
                </span>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={value}
                  disabled={busy}
                  onChange={(event) => {
                    heist.setTune({ [slider.key]: Number(event.target.value) })
                    shell.setPhase('idle')
                  }}
                />
              </label>
            )
          })}
        </div>
      </div>

      <div className="seed-row">
        <span className="seed-label">{heist.levelHint}</span>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => {
            heist.newSeed()
            shell.setPhase('idle')
          }}
        >
          New seed
        </button>
      </div>

      <div className="action-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => launch()}
        >
          {phase === 'finished' ? 'Replay' : 'Launch'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => {
            heist.nextMood()
            shell.setPhase('idle')
          }}
        >
          Next layout
        </button>
        <button
          type="button"
          className={`btn ${recordClean ? 'btn--active' : 'btn--ghost'}`}
          onClick={() => setRecordClean(!recordClean)}
        >
          Record clean
        </button>
        <button
          type="button"
          className={`btn ${autoRecord ? 'btn--active' : 'btn--ghost'}`}
          disabled={!recordingSupported}
          onClick={() => setAutoRecord(!autoRecord)}
        >
          Auto-record
        </button>
        {pendingClip && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => downloadBlob(pendingClip.blob, pendingClip.filename)}
          >
            Download
          </button>
        )}
      </div>

      {heist.lastMetrics && (
        <p className="hint">
          {heist.lastMetrics.tips} tips · {heist.lastMetrics.nearMisses} near-misses ·{' '}
          {heist.lastMetrics.durationSec.toFixed(1)}s
        </p>
      )}

      {recordingError && (
        <p className="hint">
          {recordingError}{' '}
          <button type="button" className="btn btn--ghost" onClick={() => setRecordingError(null)}>
            Dismiss
          </button>
        </p>
      )}

      {!recordingSupported && (
        <p className="hint">Recording needs a Chromium browser with WebCodecs.</p>
      )}
    </>
  )
}
