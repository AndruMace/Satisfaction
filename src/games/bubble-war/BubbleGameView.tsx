import type { GameViewProps } from '../../shared/module'
import { useBubbleWar } from './BubbleWarSession'
import { GameCanvas } from './GameCanvas'

export function BubbleGameView({ shell }: GameViewProps) {
  const bubble = useBubbleWar()

  return (
    <GameCanvas
      level={bubble.level}
      launchKey={shell.launchKey}
      reelKey={bubble.reelKey}
      playerCount={shell.playerCount}
      growthRate={bubble.growthRate}
      hazardDensity={bubble.hazardDensity}
      settings={bubble.settings}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onWinner={() => undefined}
      onMatchMetrics={(metrics) => bubble.setLastMetrics(metrics)}
      onReelProgress={(current, total) => {
        bubble.setReelStatus(
          current >= total
            ? 'Picking highlights…'
            : `Best-of reel ${current}/${total}`,
        )
      }}
      onReelComplete={(top) => {
        bubble.setHighlights(top)
        bubble.setReelStatus('Highlight reel ready')
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
