import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import {
  createWorld,
  resetWorld,
  snapshot,
  type SquishWorld,
} from './sim'
import type { SquishSnapshot } from './types'

export type SquishSession = {
  worldRef: MutableRefObject<SquishWorld>
  snap: SquishSnapshot
  setSnap: (s: SquishSnapshot) => void
  running: boolean
  setRunning: (v: boolean) => void
  auto: boolean
  setAuto: (v: boolean) => void
  reset: () => void
}

const SquishContext = createContext<SquishSession | null>(null)

export function SquishProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<SquishWorld>(createWorld())
  const [snap, setSnap] = useState<SquishSnapshot>(() => snapshot(worldRef.current))
  const [running, setRunning] = useState(true)
  const [auto, setAutoState] = useState(true)

  const setAuto = useCallback((v: boolean) => {
    worldRef.current.auto = v
    setAutoState(v)
  }, [])

  const reset = useCallback(() => {
    resetWorld(worldRef.current)
    worldRef.current.auto = auto
    setSnap(snapshot(worldRef.current))
  }, [auto])

  const value = useMemo<SquishSession>(
    () => ({
      worldRef,
      snap,
      setSnap,
      running,
      setRunning,
      auto,
      setAuto,
      reset,
    }),
    [snap, running, auto, setAuto, reset],
  )

  return <SquishContext.Provider value={value}>{children}</SquishContext.Provider>
}

export function useSquish(): SquishSession {
  const ctx = useContext(SquishContext)
  if (!ctx) throw new Error('useSquish must be used within SquishProvider')
  return ctx
}
