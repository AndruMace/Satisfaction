import { useEffect } from 'react'
import type { GameViewProps } from '../../shared/module'
import { ClearCanvas } from './ClearCanvas'
import { usePerfectClear } from './PerfectClearSession'

export function ClearGameView({ shell }: GameViewProps) {
  const clear = usePerfectClear()

  useEffect(() => {
    shell.setPhase('racing')
    return () => shell.setPhase('idle')
  }, [shell.setPhase])

  useEffect(() => {
    if (clear.snap.phase === 'cleared') shell.setPhase('finished')
    else shell.setPhase('racing')
  }, [clear.snap.phase, shell.setPhase])

  return (
    <div className="clear-layout">
      <ClearCanvas
        worldRef={clear.worldRef}
        running={clear.running}
        onSnapshot={clear.setSnap}
      />
    </div>
  )
}
