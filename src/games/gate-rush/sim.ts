import { VIEW_WIDTH } from '../../shared/types'
import {
  applyOp,
  buildBlockers,
  buildGates,
  buildHazards,
  formatOp,
  getCourse,
  opGoodness,
  type CourseDef,
} from './courses'
import {
  BASE_SPEED,
  CROWD_Y,
  GATE_DEPTH,
  GATE_GAP,
  GATE_GHOST_DUR,
  GATE_HALF_W,
  GATE_OPEN_DUR,
  LANE_PAD,
  MAX_SPEED,
  MAX_UNITS,
  type AudioCue,
  type Banner,
  type Blocker,
  type CourseId,
  type CrowdUnit,
  type GatePair,
  type GateRushSnapshot,
  type GateSide,
  type Hazard,
  type LaneFlash,
  type Particle,
  type Popup,
  type RushPhase,
  type WinKind,
} from './types'

let nextPopupId = 1

export type GateRushWorld = {
  phase: RushPhase
  courseId: CourseId
  count: number
  displayCount: number
  displayVel: number
  x: number
  targetX: number
  distance: number
  speed: number
  speedBoost: number
  gates: GatePair[]
  hazards: Hazard[]
  blockers: Blocker[]
  bossAt: number
  bossReq: number
  streak: number
  bestStreak: number
  shake: number
  flash: number
  popups: Popup[]
  particles: Particle[]
  units: CrowdUnit[]
  peakCount: number
  lastCue: AudioCue | null
  cueSeq: number
  bossTimer: number
  pointerActive: boolean
  steerDir: number
  outroT: number
  doorBreak: number
  slamProgress: number
  timeScale: number
  timeScaleTimer: number
  fovPunch: number
  laneFlash: LaneFlash | null
  banner: Banner | null
  gatesHit: number
  speedUpFired: boolean
  bossAheadFired: boolean
  winKind: WinKind
  lastTensionBucket: number
}

function emitCue(world: GateRushWorld, cue: AudioCue) {
  world.lastCue = cue
  world.cueSeq += 1
}

function spawnUnits(count: number): CrowdUnit[] {
  const n = Math.min(MAX_UNITS, Math.max(1, Math.ceil(Math.sqrt(count) * 5.2)))
  const units: CrowdUnit[] = []
  const radius = Math.min(145, 28 + Math.sqrt(count) * 8)
  // Grid-ish rings so the army reads as a blob, not random dots
  const rings = Math.max(1, Math.ceil(Math.sqrt(n / 3)))
  let placed = 0
  for (let ring = 0; ring < rings && placed < n; ring++) {
    const onRing = Math.min(n - placed, Math.max(1, Math.floor((ring + 1) * 5.5)))
    const r = (radius * (ring + 0.55)) / rings
    for (let i = 0; i < onRing && placed < n; i++) {
      const a = (i / onRing) * Math.PI * 2 + ring * 0.35
      const jitter = 0.75 + Math.random() * 0.35
      units.push({
        ox: Math.cos(a) * r * jitter * 0.95,
        oy: Math.sin(a) * r * jitter * 0.55,
        phase: Math.random() * Math.PI * 2,
        hue: 36 + Math.random() * 42,
      })
      placed++
    }
  }
  return units
}

function rebuildUnits(world: GateRushWorld) {
  world.units = spawnUnits(Math.max(1, world.count))
}

function addPopup(
  world: GateRushWorld,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  life = 0.9,
) {
  world.popups.push({
    id: nextPopupId++,
    text,
    x,
    y,
    life,
    maxLife: life,
    color,
    scale,
    vy: -90 - Math.random() * 40,
  })
  if (world.popups.length > 18) world.popups.shift()
}

function burst(
  world: GateRushWorld,
  x: number,
  y: number,
  color: string,
  n: number,
  speed = 180,
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.35 + Math.random())
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 4,
    })
  }
  if (world.particles.length > 200) {
    world.particles.splice(0, world.particles.length - 200)
  }
}

function setBanner(world: GateRushWorld, text: string, color: string, life = 1.4) {
  world.banner = { text, color, life, maxLife: life }
  emitCue(world, { kind: 'banner' })
}

function triggerSlowMo(world: GateRushWorld, scale: number, duration: number) {
  world.timeScale = Math.min(world.timeScale, scale)
  world.timeScaleTimer = Math.max(world.timeScaleTimer, duration)
}

function laneBounds() {
  const mid = VIEW_WIDTH / 2
  const leftCenter = mid - GATE_HALF_W / 2 - GATE_GAP / 2
  const rightCenter = mid + GATE_HALF_W / 2 + GATE_GAP / 2
  return { leftCenter, rightCenter, mid }
}

function pickSide(x: number): GateSide {
  return x < VIEW_WIDTH / 2 ? 'left' : 'right'
}

function worldFromCourse(def: CourseDef): GateRushWorld {
  return {
    phase: 'ready',
    courseId: def.id,
    count: def.startCount,
    displayCount: def.startCount,
    displayVel: 0,
    x: VIEW_WIDTH / 2,
    targetX: VIEW_WIDTH / 2,
    distance: 0,
    speed: BASE_SPEED,
    speedBoost: 0,
    gates: buildGates(def),
    hazards: buildHazards(def),
    blockers: buildBlockers(def),
    bossAt: def.bossAt,
    bossReq: def.bossReq,
    streak: 0,
    bestStreak: 0,
    shake: 0,
    flash: 0,
    popups: [],
    particles: [],
    units: spawnUnits(def.startCount),
    peakCount: def.startCount,
    lastCue: null,
    cueSeq: 0,
    bossTimer: 0,
    pointerActive: false,
    steerDir: 0,
    outroT: 0,
    doorBreak: 0,
    slamProgress: 0,
    timeScale: 1,
    timeScaleTimer: 0,
    fovPunch: 0,
    laneFlash: null,
    banner: null,
    gatesHit: 0,
    speedUpFired: false,
    bossAheadFired: false,
    winKind: 'normal',
    lastTensionBucket: -1,
  }
}

export function createWorld(courseId: CourseId = 'clip'): GateRushWorld {
  return worldFromCourse(getCourse(courseId))
}

export function resetWorld(world: GateRushWorld, courseId?: CourseId) {
  const next = worldFromCourse(getCourse(courseId ?? world.courseId))
  Object.assign(world, next)
}

export function setCourse(world: GateRushWorld, courseId: CourseId) {
  resetWorld(world, courseId)
}

export function startRun(world: GateRushWorld) {
  if (world.phase !== 'ready' && world.phase !== 'won' && world.phase !== 'lost') {
    return
  }
  const courseId = world.courseId
  resetWorld(world, courseId)
  world.phase = 'running'
  emitCue(world, { kind: 'start' })
  addPopup(world, 'GO!', VIEW_WIDTH / 2, CROWD_Y - 80, '#ffe14a', 1.4)
  burst(world, VIEW_WIDTH / 2, CROWD_Y, '#ffe14a', 24, 220)
}

export function setSteer(world: GateRushWorld, x: number | null) {
  if (x === null) {
    world.pointerActive = false
    return
  }
  world.pointerActive = true
  world.steerDir = 0
  const min = LANE_PAD + 20
  const max = VIEW_WIDTH - LANE_PAD - 20
  world.targetX = Math.max(min, Math.min(max, x))
}

export function setSteerDir(world: GateRushWorld, dir: number) {
  world.steerDir = Math.max(-1, Math.min(1, dir))
  if (dir !== 0) world.pointerActive = false
}

function hitGate(world: GateRushWorld, gate: GatePair) {
  const side = pickSide(world.x)
  const op = side === 'left' ? gate.left : gate.right
  const other = side === 'left' ? gate.right : gate.left
  const before = world.count
  const after = applyOp(before, op)
  const otherAfter = applyOp(before, other)
  const delta = after - before
  const good = delta > 0
  const big = (op.kind === 'mul' && op.value >= 3) || delta >= before
  const nearSplit = Math.abs(world.x - VIEW_WIDTH / 2) < 36 && otherAfter > after

  gate.hit = true
  gate.hitSide = side
  gate.openProgress = 0.01
  gate.ghostLife = GATE_GHOST_DUR
  world.count = after
  world.peakCount = Math.max(world.peakCount, after)
  world.gatesHit += 1

  if (good) {
    world.streak += 1
    world.bestStreak = Math.max(world.bestStreak, world.streak)
    if (world.streak >= 2) {
      emitCue(world, { kind: 'streak', n: world.streak })
      addPopup(
        world,
        `STREAK x${world.streak}`,
        VIEW_WIDTH / 2,
        CROWD_Y - 200,
        '#ffe14a',
        1.2,
        1.1,
      )
    }
  } else {
    world.streak = 0
  }

  // Display count overshoot on big gains
  if (delta > 0) {
    world.displayVel = big ? delta * 2.2 : delta * 1.2
    world.displayCount = before
  }

  const { leftCenter, rightCenter } = laneBounds()
  const px = side === 'left' ? leftCenter : rightCenter
  const color = good ? '#3dff9a' : '#ff3d6e'
  addPopup(world, formatOp(op), px, CROWD_Y - 140, color, big ? 1.85 : 1.2, big ? 1.15 : 0.9)
  if (delta !== 0) {
    const sign = delta > 0 ? '+' : ''
    addPopup(world, `${sign}${delta}`, world.x, CROWD_Y - 40, color, big ? 1.15 : 0.9)
  }

  world.laneFlash = { side, good, life: 0.45 }
  world.shake = Math.min(20, 4 + Math.abs(delta) * 0.04 + (big ? 10 : 0))
  world.flash = good ? (big ? 0.42 : 0.2) : 0.16
  if (big) {
    world.fovPunch = Math.max(world.fovPunch, 1)
    triggerSlowMo(world, 0.28, 0.45)
  }
  burst(world, px, CROWD_Y - 100, color, big ? 48 : 24, big ? 280 : 170)
  rebuildUnits(world)
  emitCue(world, { kind: 'gate', good, big })

  if (nearSplit) {
    world.shake = Math.max(world.shake, 6)
    addPopup(world, 'CLOSE CALL', VIEW_WIDTH / 2, CROWD_Y - 240, '#ffb020', 1.05, 0.85)
    emitCue(world, { kind: 'nearMiss' })
  }

  // Escalation: speed up after 3rd gate
  if (!world.speedUpFired && world.gatesHit >= 3) {
    world.speedUpFired = true
    world.speedBoost = 70
    setBanner(world, 'SPEED UP', '#ffe14a')
  }

  if (after <= 0) {
    world.count = 0
    // Brief oh-no hold before wipe
    triggerSlowMo(world, 0.22, 0.55)
    world.phase = 'lost'
    world.winKind = 'normal'
    emitCue(world, { kind: 'lose' })
    addPopup(world, 'WIPED', VIEW_WIDTH / 2, CROWD_Y - 120, '#ff3d6e', 1.8, 1.2)
  }
}

function hitHazard(world: GateRushWorld, hazard: Hazard) {
  const half = hazard.width * 0.5
  const dist = Math.abs(world.x - hazard.x)
  if (dist > half + 28) return

  hazard.hit = true
  const loss = Math.max(
    1,
    Math.floor(world.count * (hazard.kind === 'saw' ? 0.28 : 0.18)) + 2,
  )
  const before = world.count
  world.count = Math.max(0, world.count - loss)
  world.streak = 0
  world.shake = 10
  world.flash = 0.2
  addPopup(world, `-${loss}`, hazard.x, CROWD_Y - 100, '#ff8a5c', 1.2)
  burst(world, hazard.x, CROWD_Y - 20, '#ff8a5c', 28, 200)
  rebuildUnits(world)
  emitCue(world, { kind: 'hazard' })

  if (world.count <= 0) {
    world.count = 0
    world.phase = 'lost'
    emitCue(world, { kind: 'lose' })
    addPopup(world, 'WIPED', VIEW_WIDTH / 2, CROWD_Y - 120, '#ff3d6e', 1.8)
  } else if (before > 0) {
    emitCue(world, { kind: 'tick', count: world.count })
  }
}

function checkHazardSkim(world: GateRushWorld) {
  for (const hazard of world.hazards) {
    if (hazard.hit || hazard.skimmed) continue
    if (world.distance < hazard.z - 10 || world.distance >= hazard.z + 36) continue
    const half = hazard.width * 0.5
    const dist = Math.abs(world.x - hazard.x)
    // Edge skim: outside hit radius but within near-miss band
    if (dist > half + 28 && dist < half + 70) {
      hazard.skimmed = true
      world.shake = Math.max(world.shake, 5)
      world.fovPunch = Math.max(world.fovPunch, 0.35)
      addPopup(world, 'CLOSE!', hazard.x, CROWD_Y - 90, '#ffe14a', 1.15, 0.8)
      burst(world, hazard.x, CROWD_Y - 10, '#ffe14a', 14, 160)
      emitCue(world, { kind: 'nearMiss' })
    }
  }
}

function hitBlocker(world: GateRushWorld, blocker: Blocker) {
  blocker.hit = true
  if (world.count >= blocker.req) {
    blocker.smashed = true
    blocker.breakProgress = 0.01
    world.shake = Math.max(world.shake, 12)
    world.flash = Math.max(world.flash, 0.28)
    world.fovPunch = Math.max(world.fovPunch, 0.7)
    triggerSlowMo(world, 0.32, 0.35)
    addPopup(world, 'CLEARED!', VIEW_WIDTH / 2, CROWD_Y - 160, '#3dff9a', 1.4)
    burst(world, VIEW_WIDTH / 2, CROWD_Y - 80, '#3dff9a', 36, 240)
    emitCue(world, { kind: 'impact', won: true, style: 'normal' })
  } else {
    world.phase = 'lost'
    world.shake = 14
    world.flash = 0.35
    triggerSlowMo(world, 0.25, 0.5)
    addPopup(world, 'BLOCKED', VIEW_WIDTH / 2, CROWD_Y - 140, '#ff3d6e', 1.6)
    addPopup(
      world,
      `${world.count} / ${blocker.req}`,
      VIEW_WIDTH / 2,
      CROWD_Y - 80,
      '#ff8a5c',
      1.1,
    )
    emitCue(world, { kind: 'lose' })
  }
}

function classifyWin(world: GateRushWorld): WinKind {
  const ratio = world.count / Math.max(1, world.bossReq)
  if (ratio <= 1.15) return 'barely'
  if (ratio >= 2.5) return 'overkill'
  return 'normal'
}

function enterBoss(world: GateRushWorld) {
  world.phase = 'boss'
  world.bossTimer = 0
  world.slamProgress = 0
  world.doorBreak = 0
  world.outroT = 0
  world.speed = 0
  emitCue(world, { kind: 'boss' })
  addPopup(world, `NEED ${world.bossReq}`, VIEW_WIDTH / 2, 280, '#ffe14a', 1.3)
}

function resolveBoss(world: GateRushWorld) {
  const won = world.count >= world.bossReq
  const style = won ? classifyWin(world) : 'normal'
  world.winKind = style
  emitCue(world, { kind: 'impact', won, style })

  if (won) {
    world.phase = 'won'
    world.flash = 0.7
    world.shake = 26
    world.doorBreak = 0.05
    const slow =
      style === 'barely' ? 0.22 : style === 'overkill' ? 0.26 : 0.3
    const dur = style === 'barely' || style === 'overkill' ? 0.75 : 0.55
    triggerSlowMo(world, slow, dur)
    world.fovPunch = 1
    burst(world, VIEW_WIDTH / 2, 360, '#ffe14a', 70, 360)
    burst(world, VIEW_WIDTH / 2, 360, '#3dff9a', 50, 300)
    burst(world, VIEW_WIDTH / 2, 400, '#ffffff', 30, 240)
    addPopup(
      world,
      style === 'barely' ? 'JUST MADE IT!' : style === 'overkill' ? 'OVERKILL!' : 'SMASH!',
      VIEW_WIDTH / 2,
      300,
      style === 'barely' ? '#ffe14a' : '#3dff9a',
      2.1,
    )
  } else {
    world.phase = 'lost'
    world.shake = 16
    world.flash = 0.4
    world.doorBreak = 0
    triggerSlowMo(world, 0.28, 0.55)
    burst(world, VIEW_WIDTH / 2, 360, '#ff3d6e', 42, 220)
    addPopup(world, 'TOO WEAK', VIEW_WIDTH / 2, 300, '#ff3d6e', 1.9)
    addPopup(
      world,
      `${world.count} / ${world.bossReq}`,
      VIEW_WIDTH / 2,
      380,
      '#ff8a5c',
      1.15,
    )
    emitCue(world, { kind: 'lose' })
  }
}

function stepOutro(world: GateRushWorld, dt: number) {
  world.outroT += dt

  if (world.phase === 'won') {
    world.doorBreak = Math.min(1, world.outroT / 0.45)
    if (world.outroT < 1.4) {
      world.distance += (220 + world.outroT * 80) * dt
    }
    if (world.outroT < 1.6 && Math.random() < dt * 28) {
      const side = (Math.random() - 0.5) * VIEW_WIDTH * 0.7
      burst(
        world,
        VIEW_WIDTH / 2 + side,
        280 + Math.random() * 200,
        Math.random() > 0.5 ? '#ffe14a' : '#3dff9a',
        8,
        200 + Math.random() * 160,
      )
    }
    if (world.outroT >= 0.55 && world.outroT - dt < 0.55) {
      addPopup(
        world,
        `${world.count} STRONG`,
        VIEW_WIDTH / 2,
        420,
        '#ffe14a',
        1.35,
      )
      emitCue(world, { kind: 'win', style: world.winKind })
      world.flash = Math.max(world.flash, 0.35)
      world.shake = Math.max(world.shake, 10)
    }
  } else if (world.phase === 'lost') {
    if (world.outroT < 0.45) {
      world.distance = Math.max(world.bossAt - 120, world.distance - 160 * dt)
    }
  }
}

function stepJuice(world: GateRushWorld, dt: number) {
  // Count roll with optional overshoot
  if (world.displayVel !== 0) {
    world.displayCount += world.displayVel * dt
    world.displayVel *= Math.exp(-dt * 6)
    if (world.displayVel > 0 && world.displayCount > world.count * 1.08) {
      world.displayVel *= -0.35
    }
    if (
      Math.abs(world.displayVel) < 8 &&
      Math.abs(world.displayCount - world.count) < 0.5
    ) {
      world.displayCount = world.count
      world.displayVel = 0
    }
  } else {
    const diff = world.count - world.displayCount
    world.displayCount += diff * Math.min(1, dt * 14)
    if (Math.abs(diff) < 0.05) world.displayCount = world.count
  }

  world.shake = Math.max(0, world.shake - dt * 28)
  world.flash = Math.max(0, world.flash - dt * 1.6)
  world.fovPunch = Math.max(0, world.fovPunch - dt * 2.4)

  if (world.timeScaleTimer > 0) {
    world.timeScaleTimer -= dt
    if (world.timeScaleTimer <= 0) {
      world.timeScaleTimer = 0
      world.timeScale = 1
    }
  } else {
    world.timeScale = 1
  }

  if (world.laneFlash) {
    world.laneFlash.life -= dt
    if (world.laneFlash.life <= 0) world.laneFlash = null
  }

  if (world.banner) {
    world.banner.life -= dt
    if (world.banner.life <= 0) world.banner = null
  }

  for (const gate of world.gates) {
    if (!gate.hit) continue
    if (gate.openProgress < 1) {
      gate.openProgress = Math.min(1, gate.openProgress + dt / GATE_OPEN_DUR)
    }
    if (gate.ghostLife > 0) gate.ghostLife -= dt
  }

  for (const b of world.blockers) {
    if (b.smashed && b.breakProgress < 1) {
      b.breakProgress = Math.min(1, b.breakProgress + dt / 0.4)
    }
  }

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i]
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 280 * dt
    if (p.life <= 0) world.particles.splice(i, 1)
  }

  for (let i = world.popups.length - 1; i >= 0; i--) {
    const p = world.popups[i]
    p.life -= dt
    p.y += p.vy * dt
    p.vy *= 0.96
    if (p.life <= 0) world.popups.splice(i, 1)
  }

  for (const u of world.units) {
    u.phase += dt * (8 + (u.hue % 10) * 0.2)
  }
}

export function stepWorld(world: GateRushWorld, rawDt: number) {
  const dt = rawDt * world.timeScale
  stepJuice(world, dt)

  if (world.phase === 'won' || world.phase === 'lost') {
    stepOutro(world, dt)
    return
  }

  if (world.phase === 'boss') {
    world.bossTimer += dt
    const charge = Math.min(1, world.bossTimer / 1.15)
    world.slamProgress = charge * charge
    world.x += (VIEW_WIDTH / 2 - world.x) * dt * 5
    world.distance = world.bossAt - 20 + world.slamProgress * 28
    if (charge >= 1) resolveBoss(world)
    return
  }

  if (world.phase !== 'running') return

  const minX = LANE_PAD + 20
  const maxX = VIEW_WIDTH - LANE_PAD - 20
  if (!world.pointerActive && world.steerDir !== 0) {
    world.targetX = Math.max(
      minX,
      Math.min(maxX, world.targetX + world.steerDir * 520 * dt),
    )
  }
  const steerRate = world.pointerActive ? 12 : world.steerDir !== 0 ? 10 : 7
  world.x += (world.targetX - world.x) * Math.min(1, dt * steerRate)
  world.x = Math.max(minX, Math.min(maxX, world.x))

  const progress = world.distance / world.bossAt
  world.speedBoost = Math.max(0, world.speedBoost - dt * 12)
  world.speed = Math.min(
    MAX_SPEED,
    BASE_SPEED + progress * 90 + world.streak * 8 + world.speedBoost,
  )
  world.distance += world.speed * dt

  // Boss ahead banner
  if (!world.bossAheadFired && progress >= 0.75) {
    world.bossAheadFired = true
    setBanner(world, 'BOSS AHEAD', '#ff3d6e')
  }

  // Tension bed as count approaches boss req
  const tension = Math.min(1, world.count / Math.max(1, world.bossReq))
  const bucket = Math.floor(tension * 8)
  if (bucket !== world.lastTensionBucket && tension >= 0.4 && progress > 0.35) {
    world.lastTensionBucket = bucket
    emitCue(world, { kind: 'tension', ratio: tension })
  }

  for (const gate of world.gates) {
    if (gate.hit) continue
    if (world.distance >= gate.z && world.distance < gate.z + GATE_DEPTH + 40) {
      hitGate(world, gate)
      if (world.phase !== 'running') return
    }
  }

  checkHazardSkim(world)

  for (const hazard of world.hazards) {
    if (hazard.hit) continue
    if (world.distance >= hazard.z - 10 && world.distance < hazard.z + 36) {
      hitHazard(world, hazard)
      if (world.phase !== 'running') return
    }
  }

  for (const blocker of world.blockers) {
    if (blocker.hit) continue
    if (world.distance >= blocker.z - 10 && world.distance < blocker.z + 40) {
      hitBlocker(world, blocker)
      if (world.phase !== 'running') return
    }
  }

  if (world.distance >= world.bossAt - 20) {
    enterBoss(world)
  }
}

export function snapshot(world: GateRushWorld): GateRushSnapshot {
  return {
    phase: world.phase,
    count: world.count,
    displayCount: world.displayCount,
    x: world.x,
    distance: world.distance,
    speed: world.speed,
    gates: world.gates,
    hazards: world.hazards,
    blockers: world.blockers,
    bossAt: world.bossAt,
    bossReq: world.bossReq,
    streak: world.streak,
    bestStreak: world.bestStreak,
    shake: world.shake,
    flash: world.flash,
    popups: world.popups,
    particles: world.particles,
    units: world.units,
    courseId: world.courseId,
    progress: Math.min(1, world.distance / world.bossAt),
    peakCount: world.peakCount,
    lastCue: world.lastCue,
    cueSeq: world.cueSeq,
    outroT: world.outroT,
    doorBreak: world.doorBreak,
    slamProgress: world.slamProgress,
    timeScale: world.timeScale,
    fovPunch: world.fovPunch,
    laneFlash: world.laneFlash,
    banner: world.banner,
    showPeakGhost: world.peakCount > world.count && world.phase === 'running',
    winKind: world.winKind,
    gatesHit: world.gatesHit,
  }
}

export function previewGateColors(gate: GatePair, count: number) {
  const leftDelta = opGoodness(gate.left, count)
  const rightDelta = opGoodness(gate.right, count)
  return {
    leftGood: leftDelta >= rightDelta,
    rightGood: rightDelta > leftDelta,
    leftDelta,
    rightDelta,
  }
}
