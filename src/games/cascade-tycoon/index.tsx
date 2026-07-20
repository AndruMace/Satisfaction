import type { ReactNode } from 'react'
import { CascadeProvider } from './CascadeSession'

/** Wraps GameShell content so GameView + Controls share Cascade Tycoon state. */
export function CascadeTycoonShell({ children }: { children: ReactNode }) {
  return <CascadeProvider>{children}</CascadeProvider>
}
