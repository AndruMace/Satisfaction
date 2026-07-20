import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { formatMoney } from './format'
import {
  buyUpgrade,
  createWorld,
  resetWorld,
  snapshot,
  type CascadeWorld,
} from './sim'
import type { CascadeSnapshot, UpgradeId } from './types'
import {
  type UpgradeDef,
  UPGRADE_DEFS,
  upgradeCost,
} from './upgrades'

export type CascadeSession = {
  treasury: number
  snap: CascadeSnapshot | null
  worldRef: React.MutableRefObject<CascadeWorld>
  running: boolean
  setRunning: (v: boolean) => void
  setTreasury: (v: number) => void
  setSnap: (s: CascadeSnapshot) => void
  purchase: (id: UpgradeId) => boolean
  reset: () => void
  upgradeDefs: UpgradeDef[]
  costOf: (id: UpgradeId) => number
  formatMoney: typeof formatMoney
  canBuy: (id: UpgradeId) => boolean
}

const CascadeContext = createContext<CascadeSession | null>(null)

export function CascadeProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<CascadeWorld>(createWorld())
  const [treasury, setTreasury] = useState(0)
  const [snap, setSnap] = useState<CascadeSnapshot | null>(() =>
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
      const def = UPGRADE_DEFS.find((d) => d.id === id)!
      const level = worldRef.current.upgrades[id]
      if (level >= def.maxLevel) return false
      return treasury >= upgradeCost(def, level)
    },
    [treasury],
  )

  const purchase = useCallback(
    (id: UpgradeId) => {
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
    },
    [],
  )

  const reset = useCallback(() => {
    resetWorld(worldRef.current)
    const next = snapshot(worldRef.current)
    setTreasury(next.treasury)
    setSnap(next)
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
      reset,
      upgradeDefs: UPGRADE_DEFS,
      costOf,
      formatMoney,
      canBuy,
    }),
    [treasury, snap, running, purchase, reset, costOf, canBuy],
  )

  return (
    <CascadeContext.Provider value={value}>{children}</CascadeContext.Provider>
  )
}

export function useCascade(): CascadeSession {
  const ctx = useContext(CascadeContext)
  if (!ctx) throw new Error('useCascade must be used within CascadeProvider')
  return ctx
}
