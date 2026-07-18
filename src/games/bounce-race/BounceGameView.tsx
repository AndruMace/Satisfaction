import type { GameViewProps } from '../../shared/module'
import { useBounceRace } from './BounceRaceSession'
import { GameCanvas } from './GameCanvas'

export function BounceGameView({ shell }: GameViewProps) {
  const bounce = useBounceRace()

  return (
    <GameCanvas
      level={bounce.level}
      launchKey={shell.launchKey}
      reelKey={bounce.reelKey}
      randomizeBounces={bounce.randomizeBounces}
      playerCount={shell.playerCount}
      playerShape={bounce.playerShape}
      barrierHealth={bounce.barrierHealth}
      wallSpeed={bounce.wallSpeed}
      chevronAngle={bounce.chevronAngle}
      crushMargin={bounce.crushMargin}
      settings={bounce.settings}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onWinner={() => undefined}
      onRaceMetrics={(metrics) => bounce.setLastMetrics(metrics)}
      onReelProgress={(current, total) => {
        bounce.setReelStatus(
          current >= total
            ? 'Picking highlights…'
            : `Best-of reel ${current}/${total}`,
        )
      }}
      onReelComplete={(top) => {
        bounce.setHighlights(top)
        bounce.setReelStatus('Highlight reel ready')
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
