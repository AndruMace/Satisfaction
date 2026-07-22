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
  clearDailyProgress,
  commitDailyRankedAttempt,
  exploreLevelTotal,
  nextLevel,
  prevLevel,
  resetRun,
  setDailyDate,
  setSpeedPreset,
  snapshot,
  startInfiniteSeed,
  startRun,
  switchMode,
  type FwdWorld,
} from './sim'
import type { FwdMode, FwdSnapshot, SpeedPreset } from './types'
import { isDailyLocalhost, shiftUtcDate, utcDateKey } from './daily'

export type FwdSession = {
  worldRef: MutableRefObject<FwdWorld>
  inputRef: MutableRefObject<InputController | null>
  snap: FwdSnapshot
  setSnap: (s: FwdSnapshot) => void
  running: boolean
  setRunning: (v: boolean) => void
  resetKey: number
  mode: FwdMode
  speedPreset: SpeedPreset
  seedInput: string
  setSeedInput: (value: string) => void
  setMode: (mode: FwdMode) => void
  setSpeed: (preset: SpeedPreset) => void
  launch: () => void
  retry: () => void
  runSeed: () => void
  replaySeed: () => void
  goNext: () => void
  goPrev: () => void
  commitDailyRanked: () => void
  clearDailyLocal: () => void
  setDailyDateLocal: (date: string) => void
  shiftDailyDateLocal: (days: number) => void
  resetDailyDateToToday: () => void
  isLocalhost: boolean
  levelTotal: number
  hint: string
}

const FwdContext = createContext<FwdSession | null>(null)

export function FwdProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<FwdWorld>(createWorld('daily', 0, 'normal'))
  const inputRef = useRef<InputController | null>(null)
  const [snap, setSnap] = useState<FwdSnapshot>(() => snapshot(worldRef.current))
  const [running, setRunning] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [mode, setModeState] = useState<FwdMode>('daily')
  const [speedPreset, setSpeedState] = useState<SpeedPreset>('normal')
  const [seedInput, setSeedInput] = useState('')

  const bump = useCallback(() => {
    setSnap(snapshot(worldRef.current))
    setResetKey((k) => k + 1)
  }, [])

  const setMode = useCallback(
    (m: FwdMode) => {
      switchMode(worldRef.current, m)
      setModeState(m)
      if (m === 'daily') setSpeedState('normal')
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

  const commitDailyRanked = useCallback(() => {
    commitDailyRankedAttempt(worldRef.current)
    bump()
  }, [bump])

  const clearDailyLocal = useCallback(() => {
    if (!isDailyLocalhost()) return
    clearDailyProgress(worldRef.current)
    bump()
  }, [bump])

  const setDailyDateLocal = useCallback(
    (date: string) => {
      if (!isDailyLocalhost()) return
      setDailyDate(worldRef.current, date)
      bump()
    },
    [bump],
  )

  const shiftDailyDateLocal = useCallback(
    (days: number) => {
      if (!isDailyLocalhost()) return
      const next = shiftUtcDate(worldRef.current.dailyDate, days)
      setDailyDate(worldRef.current, next)
      bump()
    },
    [bump],
  )

  const resetDailyDateToToday = useCallback(() => {
    if (!isDailyLocalhost()) return
    setDailyDate(worldRef.current, utcDateKey())
    bump()
  }, [bump])

  const value = useMemo<FwdSession>(
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
      commitDailyRanked,
      clearDailyLocal,
      setDailyDateLocal,
      shiftDailyDateLocal,
      resetDailyDateToToday,
      isLocalhost: isDailyLocalhost(),
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
      commitDailyRanked,
      clearDailyLocal,
      setDailyDateLocal,
      shiftDailyDateLocal,
      resetDailyDateToToday,
    ],
  )

  return <FwdContext.Provider value={value}>{children}</FwdContext.Provider>
}

export function useFwd(): FwdSession {
  const ctx = useContext(FwdContext)
  if (!ctx) throw new Error('useFwd must be used within FwdProvider')
  return ctx
}
