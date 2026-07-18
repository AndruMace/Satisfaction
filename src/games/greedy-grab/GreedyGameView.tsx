import type { GameViewProps } from '../../shared/module'
import { GrabCanvas } from './GrabCanvas'
import { useGreedyGrab } from './GreedyGrabSession'

export function GreedyGameView({ shell }: GameViewProps) {
  const grab = useGreedyGrab()

  return (
    <GrabCanvas
      level={grab.level}
      launchKey={shell.launchKey}
      reelKey={grab.reelKey}
      playerCount={shell.playerCount}
      greedWeight={grab.greedWeight}
      roundLength={grab.roundLength}
      depositRequired={grab.depositRequired}
      bankOnElim={grab.bankOnElim}
      settings={grab.settings}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onWinner={() => undefined}
      onGrabMetrics={(metrics) => grab.setLastMetrics(metrics)}
      onReelProgress={(current, total) => {
        grab.setReelStatus(
          current >= total
            ? 'Picking highlights…'
            : `Best-of reel ${current}/${total}`,
        )
      }}
      onReelComplete={(top) => {
        grab.setHighlights(top)
        grab.setReelStatus('Highlight reel ready')
      }}
      onRecordingChange={shell.setIsRecording}
      onRecordingReady={(blob, filename, durationSec) => {
        shell.setPendingClip({ blob, filename, durationSec })
        shell.setRecordingError(null)
      }}
      onRecordingError={(message) => {
        shell.setRecordingError(message)
        shell.setIsRecording(false)
      }}
    />
  )
}
