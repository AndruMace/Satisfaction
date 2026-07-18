import type { ReactNode } from 'react'
import { LaserProvider } from './LaserSession'

/** Wraps GameShell content so GameView + Controls share Laser session state. */
export function LaserRouletteShell({ children }: { children: ReactNode }) {
  return <LaserProvider>{children}</LaserProvider>
}
