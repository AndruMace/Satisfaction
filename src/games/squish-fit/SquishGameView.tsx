import { useEffect } from 'react'
import type { GameViewProps } from '../../shared/module'
import { SquishCanvas } from './SquishCanvas'
import { useSquish } from './SquishSession'

export function SquishGameView({ shell }: GameViewProps) {
  const squish = useSquish()

  useEffect(() => {
    shell.setPhase('racing')
    return () => shell.setPhase('idle')
  }, [shell.setPhase])

  useEffect(() => {
    if (squish.snap.phase === 'won') shell.setPhase('finished')
    else shell.setPhase('racing')
  }, [squish.snap.phase, shell.setPhase])

  return (
    <div className="squish-layout">
      <SquishCanvas
        worldRef={squish.worldRef}
        running={squish.running}
        onSnapshot={squish.setSnap}
      />
    </div>
  )
}
