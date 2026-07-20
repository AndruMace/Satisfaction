import type { GameViewProps } from '../../shared/module'
import { useDominoHeist } from './DominoSession'
import { GameCanvas } from './GameCanvas'

export function DominoGameView({ shell }: GameViewProps) {
  const heist = useDominoHeist()

  return (
    <GameCanvas
      mood={heist.mood}
      seed={heist.seed}
      tune={heist.tune}
      settings={heist.settings}
      launchKey={shell.launchKey}
      autoRecord={shell.autoRecord}
      onPhaseChange={shell.setPhase}
      onMetrics={(metrics) => heist.setLastMetrics(metrics)}
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
