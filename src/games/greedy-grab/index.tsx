import type { ReactNode } from 'react'
import { GreedyGrabProvider } from './GreedyGrabSession'

/** Wraps GameShell content so GameView + Controls share Greedy Grab session state. */
export function GreedyGrabShell({ children }: { children: ReactNode }) {
  return <GreedyGrabProvider>{children}</GreedyGrabProvider>
}
