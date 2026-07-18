import type { ReactNode } from 'react'
import { DominoHeistProvider } from './DominoSession'

/** Wraps GameShell content so GameView + Controls share Domino session state. */
export function DominoHeistShell({ children }: { children: ReactNode }) {
  return <DominoHeistProvider>{children}</DominoHeistProvider>
}
