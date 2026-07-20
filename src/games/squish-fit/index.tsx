import type { ReactNode } from 'react'
import { SquishProvider } from './SquishSession'

/** Wraps GameShell content so GameView + Controls share Squish Fit state. */
export function SquishFitShell({ children }: { children: ReactNode }) {
  return <SquishProvider>{children}</SquishProvider>
}
