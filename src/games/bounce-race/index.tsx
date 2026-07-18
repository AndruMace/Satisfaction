import type { ReactNode } from 'react'
import { BounceRaceProvider } from './BounceRaceSession'

/** Wraps GameShell content so GameView + Controls share Bounce session state. */
export function BounceRaceShell({ children }: { children: ReactNode }) {
  return <BounceRaceProvider>{children}</BounceRaceProvider>
}
