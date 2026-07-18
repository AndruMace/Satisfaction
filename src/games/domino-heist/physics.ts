import { PLAYER_PROFILES } from '../../shared/profiles'
import type { RunSettings } from './settings'
import {
  BASE_TIP_GAP,
  BASE_TIP_SPEED,
  type Blocker,
  type Chain,
  type ChainId,
  DOMINO_H,
  DOMINO_W,
  type Domino,
  type ImpactEvent,
  type LevelData,
  MAX_DOMINOS,
  type Particle,
  STALL_ELIM_SEC,
  TIP_ANGLE,
  TIP_CONTACT,
} from './types'

export type PhysicsConfig = {
  tipForce: number
  chaos: number
  wind: number
  settings: RunSettings
  heistAlarm: boolean
}

/** Pack lanes so adjacent tip arcs can clash (cross-color interference). */
function laneXs(playerCount: number, width: number): number[] {
  const count = Math.max(2, Math.min(6, playerCount))
  const spacing = Math.min(70, 48 + (6 - count) * 5)
  const total = spacing * (count - 1)
  const start = (width - total) / 2
  const xs: number[] = []
  for (let i = 0; i < count; i++) {
    xs.push(start + i * spacing)
  }
  return xs
}

function gapAfter(
  level: LevelData,
  chainSlot: number,
  index: number,
  applyGaps: boolean,
): number {
  if (!applyGaps) return 0
  let gap = 0
  for (const tooth of level.missingTeeth) {
    if (tooth.chainSlot === chainSlot && tooth.afterIndex === index) {
      gap = Math.max(gap, tooth.gapPx)
    }
  }
  return gap
}

/**
 * Place chainLength dominos + vault so spacing stays tippable at tipForce≈1,
 * while still ending on the vault. Gaps consume budget and create local stalls.
 */
export function createChains(
  level: LevelData,
  playerCount: number,
  applyMissingTeeth = true,
): Chain[] {
  const profiles = PLAYER_PROFILES.slice(0, Math.max(2, Math.min(6, playerCount)))
  const xs = laneXs(profiles.length, level.bounds.width)
  const chains: Chain[] = []
  let nextId = 1
  let total = 0

  for (let slot = 0; slot < profiles.length; slot++) {
    const profile = profiles[slot]
    const dominos: Domino[] = []
    const tipDir: 1 | -1 = slot % 2 === 0 ? 1 : -1

    const gaps: number[] = []
    let gapTotal = 0
    for (let i = 0; i < level.chainLength; i++) {
      const g = gapAfter(level, slot, i, applyMissingTeeth)
      gaps.push(g)
      gapTotal += g
    }

    // Intervals from first piece through vault tip.
    const intervals = level.chainLength
    const span = Math.max(1, level.vaultY - level.startY)
    const baseStep = Math.max(DOMINO_H * 0.95, (span - gapTotal) / intervals)

    let y = level.startY
    for (let i = 0; i < level.chainLength; i++) {
      if (total >= MAX_DOMINOS - profiles.length) break
      dominos.push({
        id: nextId++,
        chainId: profile.id,
        index: i,
        x: xs[slot],
        y,
        w: DOMINO_W,
        h: DOMINO_H,
        angle: 0,
        tipDir,
        angularVel: 0,
        state: 'upright',
        isVault: false,
        struckBy: 0,
      })
      total += 1
      y += baseStep + gaps[i]
    }

    dominos.push({
      id: nextId++,
      chainId: profile.id,
      index: dominos.length,
      x: xs[slot],
      y: level.vaultY,
      w: DOMINO_W + 4,
      h: DOMINO_H + 8,
      angle: 0,
      tipDir,
      angularVel: 0,
      state: 'upright',
      isVault: true,
      struckBy: 0,
    })
    total += 1

    chains.push({
      id: profile.id,
      color: profile.color,
      label: profile.label,
      alive: true,
      tipFront: -1,
      stallTimer: 0,
      dominos,
    })
  }

  return chains
}

export function createBlockers(level: LevelData, settings: RunSettings): Blocker[] {
  if (!settings.crossTraffic) return []
  return level.blockers.map((spec) => {
    const travel = level.bounds.width - 80 - spec.width
    return {
      id: spec.id,
      x: 40 + spec.phase * travel,
      y: spec.y,
      w: spec.width,
      h: spec.height,
      vx: spec.speed * (spec.phase > 0.5 ? -1 : 1),
      baseSpeed: spec.speed,
    }
  })
}

export function spawnShatterParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count = 10,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 80 + Math.random() * 220
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

export function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }
    p.vy += 420 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
}

function startTip(domino: Domino, force: number, chaos: number) {
  if (domino.state !== 'upright') return false
  domino.state = 'tipping'
  const jitter = (Math.random() - 0.5) * chaos * 0.8
  domino.angularVel = (BASE_TIP_SPEED * force + jitter) * domino.tipDir
  return true
}

/** Max center-to-center Y gap this tip force can bridge. */
export function maxTipGap(tipForce: number): number {
  return BASE_TIP_GAP + tipForce * 28
}

function canReachNext(current: Domino, next: Domino, tipForce: number): boolean {
  const dy = next.y - current.y
  const dx = Math.abs(next.x - current.x)
  if (dx > 52) return false
  if (dy < -10) return false
  return dy <= maxTipGap(tipForce)
}

function tipLeanX(domino: Domino): number {
  return domino.x + Math.sin(domino.angle) * domino.h * 0.52
}

function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function shatterDomino(
  chain: Chain,
  domino: Domino,
  particles: Particle[],
  impacts: ImpactEvent[],
  kind: ImpactEvent['kind'],
) {
  if (domino.state === 'shattered') return
  domino.state = 'shattered'
  domino.angularVel = 0
  spawnShatterParticles(particles, domino.x, domino.y, chain.color, 12)
  impacts.push({
    chainId: chain.id,
    kind,
    x: domino.x,
    y: domino.y,
    noteIndex: domino.index,
    speed: BASE_TIP_SPEED * 1.2,
  })
}

function eliminateChain(
  chain: Chain,
  particles: Particle[],
  impacts: ImpactEvent[],
  reason: 'stalled' | 'wiped' = 'wiped',
) {
  if (!chain.alive) return
  chain.alive = false
  // Mark the break point for HUD (stall tip / last fallen).
  const breakAt =
    chain.dominos[Math.max(0, chain.tipFront)] ??
    chain.dominos[chain.dominos.length - 1]
  for (const domino of chain.dominos) {
    if (domino.state === 'upright' || domino.state === 'tipping') {
      domino.state = 'shattered'
      domino.angularVel = 0
      spawnShatterParticles(particles, domino.x, domino.y, chain.color, 8)
    }
  }
  impacts.push({
    chainId: chain.id,
    kind: 'eliminated',
    x: breakAt?.x ?? 0,
    y: breakAt?.y ?? 0,
    noteIndex: chain.tipFront,
    speed: 3,
    reason,
  })
  if (breakAt) spawnShatterParticles(particles, breakAt.x, breakAt.y, chain.color, 16)
}

function refreshChainAlive(chain: Chain, particles: Particle[], impacts: ImpactEvent[]) {
  if (!chain.alive) return
  // Fully tipped chain (vault down) is a win path, not an elimination.
  if (chain.dominos.some((d) => d.isVault && d.state === 'fallen')) return
  const standing = chain.dominos.filter(
    (d) => d.state === 'upright' || d.state === 'tipping',
  )
  if (standing.length === 0) {
    eliminateChain(chain, particles, impacts, 'wiped')
  }
}

export function kickstartChains(chains: Chain[], tipForce: number, chaos: number) {
  for (const chain of chains) {
    const first = chain.dominos[0]
    if (first) startTip(first, tipForce, chaos)
  }
}

export function stepPhysics(
  chains: Chain[],
  blockers: Blocker[],
  level: LevelData,
  config: PhysicsConfig,
  dt: number,
  particles: Particle[],
): ImpactEvent[] {
  const impacts: ImpactEvent[] = []
  const speedMul = config.heistAlarm ? 1.55 : 1
  const tipForce = config.tipForce * speedMul
  const chaos = config.settings.tipChaos ? config.chaos : 0
  const wind = config.settings.windGusts ? config.wind : 0

  // Blockers
  for (const blocker of blockers) {
    const speed = blocker.baseSpeed * (config.heistAlarm ? 1.35 : 1)
    blocker.vx = Math.sign(blocker.vx || 1) * speed
    blocker.x += blocker.vx * dt
    const minX = 36
    const maxX = level.bounds.width - blocker.w - 36
    if (blocker.x < minX) {
      blocker.x = minX
      blocker.vx = Math.abs(blocker.vx)
    } else if (blocker.x > maxX) {
      blocker.x = maxX
      blocker.vx = -Math.abs(blocker.vx)
    }
  }

  // Tip simulation
  for (const chain of chains) {
    if (!chain.alive) continue

    let anyTipping = false

    for (const domino of chain.dominos) {
      if (domino.state !== 'tipping') continue
      anyTipping = true

      let ang = domino.angularVel
      ang += wind * domino.tipDir * dt * 0.9
      if (chaos > 0) {
        ang += (Math.random() - 0.5) * chaos * dt * 2.2
      }
      domino.angularVel = ang
      domino.angle += domino.angularVel * dt

      const abs = Math.abs(domino.angle)
      if (abs > TIP_CONTACT && abs < TIP_ANGLE) {
        // Skip shattered gaps — high tip force can bridge a missing/broken tooth.
        let next: Domino | null = null
        for (let i = domino.index + 1; i < chain.dominos.length; i++) {
          const cand = chain.dominos[i]
          if (cand.state === 'shattered') continue
          if (cand.state === 'upright') {
            next = cand
            break
          }
          break
        }
        if (next && canReachNext(domino, next, tipForce)) {
          if (startTip(next, tipForce * (0.92 + Math.random() * 0.12), chaos)) {
            chain.tipFront = Math.max(chain.tipFront, next.index)
            chain.stallTimer = 0
            impacts.push({
              chainId: chain.id,
              kind: 'tip',
              x: next.x,
              y: next.y,
              noteIndex: next.index,
              speed: Math.abs(domino.angularVel),
            })
          }
        }
      }

      if (abs >= TIP_ANGLE) {
        domino.angle = TIP_ANGLE * Math.sign(domino.angle || domino.tipDir)
        domino.angularVel = 0
        domino.state = 'fallen'
        chain.tipFront = Math.max(chain.tipFront, domino.index)
        if (domino.isVault) {
          impacts.push({
            chainId: chain.id,
            kind: 'vault',
            x: domino.x,
            y: domino.y,
            noteIndex: domino.index,
            speed: tipForce * 4,
          })
        }
      }
    }

    // Stall: cascade died mid-course (gap, shatter, or unreachable vault).
    if (!anyTipping && chain.tipFront >= 0) {
      const vaultFallen = chain.dominos.some((d) => d.isVault && d.state === 'fallen')
      if (vaultFallen) {
        chain.stallTimer = 0
      } else {
        const nextUpright = (() => {
          for (let i = chain.tipFront + 1; i < chain.dominos.length; i++) {
            const cand = chain.dominos[i]
            if (cand.state === 'shattered') continue
            if (cand.state === 'upright') return cand
            return null
          }
          return null
        })()
        const donor = [...chain.dominos]
          .slice(0, Math.max(0, chain.tipFront) + 1)
          .reverse()
          .find((d) => d.state === 'fallen')

        if (
          nextUpright &&
          donor &&
          canReachNext(donor, nextUpright, tipForce)
        ) {
          startTip(nextUpright, tipForce * 0.9, chaos)
          chain.tipFront = Math.max(chain.tipFront, nextUpright.index)
          chain.stallTimer = 0
        } else {
          chain.stallTimer += dt
          if (chain.stallTimer >= STALL_ELIM_SEC) {
            eliminateChain(chain, particles, impacts, 'stalled')
          }
        }
      }
    } else if (anyTipping) {
      chain.stallTimer = 0
    }

    refreshChainAlive(chain, particles, impacts)
  }

  // Cross-color collisions — use tip lean so packed lanes actually interfere
  for (let a = 0; a < chains.length; a++) {
    for (let b = a + 1; b < chains.length; b++) {
      const ca = chains[a]
      const cb = chains[b]
      if (!ca.alive || !cb.alive) continue
      for (const da of ca.dominos) {
        if (da.state !== 'tipping' && da.state !== 'fallen') continue
        const ax = tipLeanX(da)
        for (const db of cb.dominos) {
          if (db.state !== 'tipping' && db.state !== 'upright') continue
          const dy = Math.abs(da.y - db.y)
          const dx = Math.abs(ax - tipLeanX(db))
          if (dy > 32 || dx > 40) continue

          if (da.state === 'tipping' && db.state === 'upright' && dx < 36) {
            const roll = Math.random()
            if (roll < 0.28 + chaos * 0.1) {
              shatterDomino(cb, db, particles, impacts, 'collide')
            } else if (roll < 0.48 + chaos * 0.08) {
              db.tipDir = (db.tipDir * -1) as 1 | -1
              startTip(db, tipForce * 0.7, chaos)
              impacts.push({
                chainId: cb.id,
                kind: 'collide',
                x: db.x,
                y: db.y,
                noteIndex: db.index,
                speed: 2,
              })
            } else if (roll < 0.62) {
              // Stall neighbor briefly by nudging it the wrong way without full tip
              db.angle += db.tipDir * 0.08
            }
          }
          if (da.state === 'tipping' && db.state === 'tipping' && dx < 30) {
            if (Math.random() < 0.18 + chaos * 0.05) {
              shatterDomino(ca, da, particles, impacts, 'collide')
            }
            if (Math.random() < 0.18 + chaos * 0.05) {
              shatterDomino(cb, db, particles, impacts, 'collide')
            }
          }
        }
      }
    }
  }

  // Blocker hits — interrupt tipping cascades more than wipe upright lines
  for (const blocker of blockers) {
    for (const chain of chains) {
      if (!chain.alive) continue
      for (const domino of chain.dominos) {
        if (domino.state === 'shattered' || domino.state === 'fallen') continue
        if (domino.struckBy === blocker.id) continue
        if (
          !aabbOverlap(
            blocker.x,
            blocker.y,
            blocker.w,
            blocker.h,
            domino.x - domino.w / 2,
            domino.y - domino.h / 2,
            domino.w,
            domino.h,
          )
        ) {
          continue
        }

        domino.struckBy = blocker.id

        if (domino.state === 'tipping') {
          if (Math.random() < 0.42 + chaos * 0.08) {
            shatterDomino(chain, domino, particles, impacts, 'blocker')
          } else {
            // Divert / slow the tip instead of always ending the run.
            domino.angularVel *= 0.35
            if (Math.random() < 0.45) {
              domino.tipDir = (domino.tipDir * -1) as 1 | -1
              domino.angularVel = Math.abs(domino.angularVel) * domino.tipDir
            }
            impacts.push({
              chainId: chain.id,
              kind: 'blocker',
              x: domino.x,
              y: domino.y,
              noteIndex: domino.index,
              speed: 1.4,
            })
          }
        } else if (domino.state === 'upright' && Math.random() < 0.16 + chaos * 0.05) {
          shatterDomino(chain, domino, particles, impacts, 'blocker')
        }
      }
      refreshChainAlive(chain, particles, impacts)
    }
  }

  return impacts
}

export function leadingProgress(chains: Chain[], vaultY: number, startY: number): number {
  let best = 0
  const span = Math.max(1, vaultY - startY)
  for (const chain of chains) {
    if (!chain.alive) continue
    const idx = Math.max(0, chain.tipFront)
    const d = chain.dominos[idx]
    if (d) best = Math.max(best, (d.y - startY) / span)
  }
  return Math.max(0, Math.min(1, best))
}

export function checkVaultWinner(chains: Chain[]): ChainId | null {
  for (const chain of chains) {
    const vault = chain.dominos.find((d) => d.isVault)
    if (vault?.state === 'fallen') return chain.id
  }
  return null
}

export function tipFrontMargin(chains: Chain[]): number {
  const fronts = chains
    .filter((c) => c.alive)
    .map((c) => c.dominos[Math.max(0, c.tipFront)]?.y ?? 0)
    .sort((a, b) => b - a)
  if (fronts.length < 2) return 80
  return fronts[0] - fronts[1]
}
