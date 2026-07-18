import type { GameViewProps } from '../../shared/module'
import { useDominoHeist } from './DominoSession'
import { GameCanvas } from './GameCanvas'

export function DominoGameView({ shell }: GameViewProps) {
  const heist = useDominoHeist()

  return (
    <GameCanvas
      level={heist.level}
      launchKey={shell.launchKey}
      reelKey={heist.reelKey}
      playerCount={shell.playerCount}
      tipForce={heist.tipForce}
      chaos={heist.chaos}
      settings={heist.settings}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onWinner={() => undefined}
      onRaceMetrics={(metrics) => heist.setLastMetrics(metrics)}
      onReelProgress={(current, total) => {
        heist.setReelStatus(
          current >= total
            ? 'Picking highlights…'
            : `Best-of reel ${current}/${total}`,
        )
      }}
      onReelComplete={(top) => {
        heist.setHighlights(top)
        heist.setReelStatus('Highlight reel ready')
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
