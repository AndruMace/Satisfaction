import type { GameControlsProps } from '../../shared/module'
import { downloadBlob } from '../../shared/recorder'
import { COURSES } from './courses'
import { useGateRush } from './GateRushSession'
import type { CourseId } from './types'

export function GateControls({ shell }: GameControlsProps) {
  const rush = useGateRush()
  const { snap } = rush
  const ended = snap.phase === 'won' || snap.phase === 'lost'
  const busy = snap.phase === 'running' || snap.phase === 'boss'
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
      <div className="course-pills" role="tablist" aria-label="Course selection">
        {COURSES.map((course) => (
          <button
            key={course.id}
            type="button"
            role="tab"
            aria-selected={rush.courseId === course.id}
            className={`pill ${rush.courseId === course.id ? 'pill--active' : ''}`}
            disabled={busy}
            onClick={() => rush.setCourseId(course.id as CourseId)}
          >
            {course.label}
          </button>
        ))}
      </div>

      <div className="settings-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => rush.play()}
        >
          {snap.phase === 'ready' ? 'Run' : ended ? 'Run Again' : 'Restart'}
        </button>
        <button
          type="button"
          className={`spectacle-toggle ${rush.running ? 'spectacle-toggle--on' : ''}`}
          onClick={() => rush.setRunning(!rush.running)}
        >
          {rush.running ? 'Running' : 'Paused'}
        </button>
        <button type="button" className="btn" onClick={() => rush.reset()}>
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

      <p className="gate-hint">
        {snap.phase === 'ready'
          ? 'Swipe to pick gates. Grow the crowd. Smash the boss.'
          : snap.phase === 'won'
            ? `${
                snap.winKind === 'barely'
                  ? 'Barely cleared'
                  : snap.winKind === 'overkill'
                    ? 'Overkill'
                    : 'Cleared'
              } with ${snap.count} — peak ${snap.peakCount}.`
            : snap.phase === 'lost'
              ? `Wipeout — peak ${snap.peakCount}. Pick better gates.`
              : `Crowd ${snap.count} · boss needs ${snap.bossReq}${
                  snap.streak >= 2 ? ` · streak ×${snap.streak}` : ''
                }`}
      </p>

      {(pendingClip || recordingError) && (
        <p className="hint hint--recording" role={recordingError ? 'alert' : undefined}>
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
