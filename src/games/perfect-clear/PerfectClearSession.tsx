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
  levelCount,
  nextLevel,
  prevLevel,
  resetLevel,
  snapshot,
  type ClearWorld,
} from './sim'
import type { ClearSnapshot } from './types'

export type PerfectClearSession = {
  worldRef: MutableRefObject<ClearWorld>
  snap: ClearSnapshot
  setSnap: (s: ClearSnapshot) => void
  running: boolean
  setRunning: (v: boolean) => void
  retry: () => void
  goNext: () => void
  goPrev: () => void
  levelIndex: number
  levelTotal: number
  hint: string
}

const PerfectClearContext = createContext<PerfectClearSession | null>(null)

export function PerfectClearProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<ClearWorld>(createWorld(0))
  const [snap, setSnap] = useState<ClearSnapshot>(() => snapshot(worldRef.current))
  const [running, setRunning] = useState(true)
  const [levelIndex, setLevelIndex] = useState(0)

  const sync = useCallback(() => {
    setSnap(snapshot(worldRef.current))
    setLevelIndex(worldRef.current.levelIndex)
  }, [])

  const retry = useCallback(() => {
    resetLevel(worldRef.current)
    sync()
  }, [sync])

  const goNext = useCallback(() => {
    nextLevel(worldRef.current)
    sync()
  }, [sync])

  const goPrev = useCallback(() => {
    prevLevel(worldRef.current)
    sync()
  }, [sync])

  const value = useMemo<PerfectClearSession>(
    () => ({
      worldRef,
      snap,
      setSnap,
      running,
      setRunning,
      retry,
      goNext,
      goPrev,
      levelIndex,
      levelTotal: levelCount(),
      hint: worldRef.current.hint,
    }),
    [snap, running, retry, goNext, goPrev, levelIndex],
  )

  return (
    <PerfectClearContext.Provider value={value}>
      {children}
    </PerfectClearContext.Provider>
  )
}

export function usePerfectClear(): PerfectClearSession {
  const ctx = useContext(PerfectClearContext)
  if (!ctx) {
    throw new Error('usePerfectClear must be used within PerfectClearProvider')
  }
  return ctx
}
