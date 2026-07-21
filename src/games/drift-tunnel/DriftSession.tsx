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
import type { InputController } from './input'
import {
  createWorld,
  exploreLevelTotal,
  nextLevel,
  prevLevel,
  resetRun,
  setSpeedPreset,
  snapshot,
  startInfiniteSeed,
  startRun,
  switchMode,
  type DriftWorld,
} from './sim'
import type { DriftMode, DriftSnapshot, SpeedPreset } from './types'

export type DriftSession = {
  worldRef: MutableRefObject<DriftWorld>
  inputRef: MutableRefObject<InputController | null>
  snap: DriftSnapshot
  setSnap: (s: DriftSnapshot) => void
  running: boolean
  setRunning: (v: boolean) => void
  resetKey: number
  mode: DriftMode
  speedPreset: SpeedPreset
  seedInput: string
  setSeedInput: (value: string) => void
  setMode: (mode: DriftMode) => void
  setSpeed: (preset: SpeedPreset) => void
  launch: () => void
  retry: () => void
  runSeed: () => void
  replaySeed: () => void
  goNext: () => void
  goPrev: () => void
  levelTotal: number
  hint: string
}

const DriftContext = createContext<DriftSession | null>(null)

export function DriftTunnelProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<DriftWorld>(createWorld('explore', 0, 'normal'))
  const inputRef = useRef<InputController | null>(null)
  const [snap, setSnap] = useState<DriftSnapshot>(() => snapshot(worldRef.current))
  const [running, setRunning] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [mode, setModeState] = useState<DriftMode>('explore')
  const [speedPreset, setSpeedState] = useState<SpeedPreset>('normal')
  const [seedInput, setSeedInput] = useState('')

  const bump = useCallback(() => {
    setSnap(snapshot(worldRef.current))
    setResetKey((k) => k + 1)
  }, [])

  const setMode = useCallback(
    (m: DriftMode) => {
      switchMode(worldRef.current, m)
      setModeState(m)
      bump()
    },
    [bump],
  )

  const setSpeed = useCallback(
    (preset: SpeedPreset) => {
      setSpeedPreset(worldRef.current, preset)
      setSpeedState(preset)
      setSnap(snapshot(worldRef.current))
    },
    [],
  )

  const launch = useCallback(() => {
    startRun(worldRef.current)
    bump()
  }, [bump])

  const retry = useCallback(() => {
    resetRun(worldRef.current)
    bump()
  }, [bump])

  const runSeed = useCallback(() => {
    const value = seedInput.trim()
    if (!value) return
    startInfiniteSeed(worldRef.current, value)
    setModeState('infinite')
    bump()
  }, [seedInput, bump])

  const replaySeed = useCallback(() => {
    const value = worldRef.current.seedLabel
    if (!value) return
    startInfiniteSeed(worldRef.current, value)
    setModeState('infinite')
    setSeedInput(value)
    bump()
  }, [bump])

  const goNext = useCallback(() => {
    nextLevel(worldRef.current)
    setModeState('explore')
    bump()
  }, [bump])

  const goPrev = useCallback(() => {
    prevLevel(worldRef.current)
    setModeState('explore')
    bump()
  }, [bump])

  const value = useMemo<DriftSession>(
    () => ({
      worldRef,
      inputRef,
      snap,
      setSnap,
      running,
      setRunning,
      resetKey,
      mode,
      speedPreset,
      seedInput,
      setSeedInput,
      setMode,
      setSpeed,
      launch,
      retry,
      runSeed,
      replaySeed,
      goNext,
      goPrev,
      levelTotal: exploreLevelTotal(),
      hint: worldRef.current.hint,
    }),
    [
      snap,
      running,
      resetKey,
      mode,
      speedPreset,
      seedInput,
      setMode,
      setSpeed,
      launch,
      retry,
      runSeed,
      replaySeed,
      goNext,
      goPrev,
    ],
  )

  return <DriftContext.Provider value={value}>{children}</DriftContext.Provider>
}

export function useDriftTunnel(): DriftSession {
  const ctx = useContext(DriftContext)
  if (!ctx) throw new Error('useDriftTunnel must be used within DriftTunnelProvider')
  return ctx
}
