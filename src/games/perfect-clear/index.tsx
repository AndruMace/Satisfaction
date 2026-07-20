import type { ReactNode } from 'react'
import { PerfectClearProvider } from './PerfectClearSession'

/** Wraps GameShell content so GameView + Controls share Perfect Clear state. */
export function PerfectClearShell({ children }: { children: ReactNode }) {
  return <PerfectClearProvider>{children}</PerfectClearProvider>
}
