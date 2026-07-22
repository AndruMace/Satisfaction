import type { ReactNode } from 'react'
import { FwdProvider } from './FwdSession'

export function FwdShell({ children }: { children: ReactNode }) {
  return <FwdProvider>{children}</FwdProvider>
}
