import type { UpgradeId, UpgradeState } from './types'

export type UpgradeDef = {
  id: UpgradeId
  label: string
  hint: string
  baseCost: number
  growth: number
  maxLevel: number
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'emitter',
    label: 'Add Emitter',
    hint: '+1 ball spawner',
    baseCost: 25,
    growth: 2.4,
    maxLevel: 8,
  },
  {
    id: 'cooldown',
    label: 'Faster Drops',
    hint: 'Shorter spawn interval',
    baseCost: 40,
    growth: 2.15,
    maxLevel: 12,
  },
  {
    id: 'bounciness',
    label: 'More Bounce',
    hint: 'Higher ball restitution',
    baseCost: 60,
    growth: 2.3,
    maxLevel: 10,
  },
  {
    id: 'bumper',
    label: 'Upgrade Peg',
    hint: 'Convert a peg to bumper',
    baseCost: 35,
    growth: 1.85,
    maxLevel: 40,
  },
]

export const DEFAULT_UPGRADES: UpgradeState = {
  emitter: 0,
  cooldown: 0,
  bounciness: 0,
  bumper: 0,
}

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.growth, level))
}

/** Base drop interval seconds → shortened by cooldown upgrades. */
export function dropIntervalFor(level: number): number {
  return Math.max(0.28, 1.65 * Math.pow(0.88, level))
}

export function restitutionFor(level: number): number {
  return Math.min(0.94, 0.72 + level * 0.022)
}
