import type { ReactNode } from 'react'
import { GateRushProvider } from './GateRushSession'

/** Wraps GameShell content so GameView + Controls share Gate Rush state. */
export function GateRushShell({ children }: { children: ReactNode }) {
  return <GateRushProvider>{children}</GateRushProvider>
}
