import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { formatMoney } from './format'
import {
  buyUpgrade,
  createWorld,
  resetToReady,
  snapshot,
  startRun,
  type CascadeWorld,
} from './sim'
import { MONEY_GOAL, runLimitForGoal } from './shorts'
import type { CascadePhase, CascadeSnapshot, UpgradeId } from './types'
import {
  type UpgradeDef,
  UPGRADE_DEFS,
  upgradeCost,
} from './upgrades'

export type CascadeSession = {
  treasury: number
  snap: CascadeSnapshot
  worldRef: React.MutableRefObject<CascadeWorld>
  running: boolean
  setRunning: (v: boolean) => void
  setTreasury: (v: number) => void
  setSnap: (s: CascadeSnapshot) => void
  purchase: (id: UpgradeId) => boolean
  play: () => void
  reset: () => void
  moneyGoal: number
  setMoneyGoal: (goal: number) => void
  runLimitSec: number
  upgradeDefs: UpgradeDef[]
  costOf: (id: UpgradeId) => number
  formatMoney: typeof formatMoney
  canBuy: (id: UpgradeId) => boolean
  phase: CascadePhase
}

const CascadeContext = createContext<CascadeSession | null>(null)

export function CascadeProvider({ children }: { children: ReactNode }) {
  const [moneyGoal, setMoneyGoalState] = useState(MONEY_GOAL)
  const moneyGoalRef = useRef(moneyGoal)
  moneyGoalRef.current = moneyGoal

  const worldRef = useRef<CascadeWorld>(createWorld(MONEY_GOAL))
  const [treasury, setTreasury] = useState(0)
  const [snap, setSnap] = useState<CascadeSnapshot>(() =>
    snapshot(worldRef.current),
  )
  const [running, setRunning] = useState(true)

  const costOf = useCallback((id: UpgradeId) => {
    const def = UPGRADE_DEFS.find((d) => d.id === id)!
    const level = worldRef.current.upgrades[id]
    return upgradeCost(def, level)
  }, [])

  const canBuy = useCallback(
    (id: UpgradeId) => {
      if (snap.phase !== 'running') return false
      const def = UPGRADE_DEFS.find((d) => d.id === id)!
      const level = worldRef.current.upgrades[id]
      if (level >= def.maxLevel) return false
      return treasury >= upgradeCost(def, level)
    },
    [treasury, snap.phase],
  )

  const purchase = useCallback((id: UpgradeId) => {
    const def = UPGRADE_DEFS.find((d) => d.id === id)!
    const level = worldRef.current.upgrades[id]
    if (level >= def.maxLevel) return false
    const cost = upgradeCost(def, level)
    const ok = buyUpgrade(worldRef.current, id, cost)
    if (ok) {
      const next = snapshot(worldRef.current)
      setTreasury(next.treasury)
      setSnap(next)
    }
    return ok
  }, [])

  const play = useCallback(() => {
    startRun(worldRef.current, moneyGoalRef.current)
    const next = snapshot(worldRef.current)
    setTreasury(next.treasury)
    setSnap(next)
    setRunning(true)
  }, [])

  const reset = useCallback(() => {
    resetToReady(worldRef.current, moneyGoalRef.current)
    const next = snapshot(worldRef.current)
    setTreasury(next.treasury)
    setSnap(next)
  }, [])

  const setMoneyGoal = useCallback((goal: number) => {
    setMoneyGoalState(goal)
    moneyGoalRef.current = goal
    // Preview goal on ready board without interrupting a live run
    const phase = worldRef.current.phase
    if (phase === 'ready' || phase === 'finished') {
      resetToReady(worldRef.current, goal)
      const next = snapshot(worldRef.current)
      setTreasury(next.treasury)
      setSnap(next)
    }
  }, [])

  const value = useMemo<CascadeSession>(
    () => ({
      treasury,
      snap,
      worldRef,
      running,
      setRunning,
      setTreasury,
      setSnap,
      purchase,
      play,
      reset,
      moneyGoal,
      setMoneyGoal,
      runLimitSec: runLimitForGoal(moneyGoal),
      upgradeDefs: UPGRADE_DEFS,
      costOf,
      formatMoney,
      canBuy,
      phase: snap.phase,
    }),
    [
      treasury,
      snap,
      running,
      purchase,
      play,
      reset,
      moneyGoal,
      setMoneyGoal,
      costOf,
      canBuy,
    ],
  )

  return (
    <CascadeContext.Provider value={value}>{children}</CascadeContext.Provider>
  )
}

/** React to shell Launch key (if wired). */
export function useCascadeLaunch(launchKey: number) {
  const { play } = useCascade()
  const lastKey = useRef(0)
  useEffect(() => {
    if (launchKey === 0 || launchKey === lastKey.current) return
    lastKey.current = launchKey
    play()
  }, [launchKey, play])
}

export function useCascade(): CascadeSession {
  const ctx = useContext(CascadeContext)
  if (!ctx) throw new Error('useCascade must be used within CascadeProvider')
  return ctx
}
