import type { UpgradeId, UpgradeState } from './types'

export type UpgradeDef = {
  id: UpgradeId
  label: string
  hint: string
  baseCost: number
  growth: number
  maxLevel: number
}

/** Compressed costs (×100 currency) so a ~55s auto-buy run peaks mid-clip. */
export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'emitter',
    label: 'Add Emitter',
    hint: '+1 ball spawner',
    baseCost: 2000,
    growth: 1.65,
    maxLevel: 6,
  },
  {
    id: 'cooldown',
    label: 'Faster Drops',
    hint: 'Shorter spawn interval',
    baseCost: 3000,
    growth: 1.55,
    maxLevel: 8,
  },
  {
    id: 'bounciness',
    label: 'More Bounce',
    hint: 'Higher ball restitution',
    baseCost: 4500,
    growth: 1.7,
    maxLevel: 6,
  },
  {
    id: 'bumper',
    label: 'Upgrade Peg',
    hint: 'Convert a peg to bumper',
    baseCost: 2500,
    growth: 1.5,
    maxLevel: 18,
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
  return Math.max(0.22, 1.35 * Math.pow(0.86, level))
}

export function restitutionFor(level: number): number {
  return Math.min(0.94, 0.72 + level * 0.028)
}
