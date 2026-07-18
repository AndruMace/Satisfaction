import type { ReactNode } from 'react'
import { BubbleWarProvider } from './BubbleWarSession'

/** Wraps GameShell content so GameView + Controls share Bubble War session state. */
export function BubbleWarShell({ children }: { children: ReactNode }) {
  return <BubbleWarProvider>{children}</BubbleWarProvider>
}
