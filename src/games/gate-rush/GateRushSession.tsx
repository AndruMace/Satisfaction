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
import { createWorld, resetWorld, setCourse, snapshot, startRun, type GateRushWorld } from './sim'
import type { CourseId, GateRushSnapshot } from './types'

export type GateRushSession = {
  worldRef: MutableRefObject<GateRushWorld>
  snap: GateRushSnapshot
  setSnap: (s: GateRushSnapshot) => void
  running: boolean
  setRunning: (v: boolean) => void
  courseId: CourseId
  setCourseId: (id: CourseId) => void
  play: () => void
  reset: () => void
}

const GateRushContext = createContext<GateRushSession | null>(null)

export function GateRushProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<GateRushWorld>(createWorld('clip'))
  const [snap, setSnap] = useState<GateRushSnapshot>(() => snapshot(worldRef.current))
  const [running, setRunning] = useState(true)
  const [courseId, setCourseIdState] = useState<CourseId>('clip')

  const setCourseId = useCallback((id: CourseId) => {
    setCourse(worldRef.current, id)
    setCourseIdState(id)
    setSnap(snapshot(worldRef.current))
  }, [])

  const play = useCallback(() => {
    startRun(worldRef.current)
    setSnap(snapshot(worldRef.current))
  }, [])

  const reset = useCallback(() => {
    resetWorld(worldRef.current, courseId)
    setSnap(snapshot(worldRef.current))
  }, [courseId])

  const value = useMemo<GateRushSession>(
    () => ({
      worldRef,
      snap,
      setSnap,
      running,
      setRunning,
      courseId,
      setCourseId,
      play,
      reset,
    }),
    [snap, running, courseId, setCourseId, play, reset],
  )

  return <GateRushContext.Provider value={value}>{children}</GateRushContext.Provider>
}

export function useGateRush(): GateRushSession {
  const ctx = useContext(GateRushContext)
  if (!ctx) throw new Error('useGateRush must be used within GateRushProvider')
  return ctx
}
