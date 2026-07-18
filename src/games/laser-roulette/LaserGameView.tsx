import type { GameViewProps } from '../../shared/module'
import { LaserCanvas } from './LaserCanvas'
import { useLaser } from './LaserSession'

export function LaserGameView({ shell }: GameViewProps) {
  const laser = useLaser()

  return (
    <LaserCanvas
      course={laser.level}
      launchKey={shell.launchKey}
      reelKey={laser.reelKey}
      playerCount={shell.playerCount}
      beamCount={laser.beamCount}
      beamSpeed={laser.beamSpeed}
      aiAggression={laser.aiAggression}
      settings={laser.settings}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onWinner={() => undefined}
      onMatchMetrics={(metrics) => laser.setLastMetrics(metrics)}
      onReelProgress={(current, total) => {
        laser.setReelStatus(
          current >= total
            ? 'Picking highlights…'
            : `Best-of reel ${current}/${total}`,
        )
      }}
      onReelComplete={(top) => {
        laser.setHighlights(top)
        laser.setReelStatus('Highlight reel ready')
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
