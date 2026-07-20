import type { ReactNode } from 'react'
import { DriftTunnelProvider } from './DriftSession'

export function DriftTunnelShell({ children }: { children: ReactNode }) {
  return <DriftTunnelProvider>{children}</DriftTunnelProvider>
}
