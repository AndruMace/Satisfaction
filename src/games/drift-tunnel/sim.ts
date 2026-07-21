import { getLevel, levelCount } from './levels'
import { generateChunk, nextSeed } from './procedural'
import { cloneRings, getTile, isWalkable, solidRing } from './tunnel'
import {
  BASE_SPEED,
  BOOST_DURATION,
  BOOST_MULT,
  FACE_LATERAL,
  FACE_OUTWARD,
  FLIP_EDGE,
  GRAVITY,
  ICE_ACCEL,
  ICE_FRICTION,
  JUMP_VELOCITY,
  RING_DEPTH,
  STRAFE_ACCEL,
  STRAFE_FRICTION,
  TUNNEL_HALF,
  type DriftInput,
  type DriftMode,
  type DriftPhase,
  type DriftSnapshot,
  type ExploreGhostRun,
  type FaceIndex,
  type GhostSample,
  type InfiniteRunRecord,
  type Ring,
  type SpeedPreset,
} from './types'

const LEVEL_TIMES_KEY = 'drift-tunnel-level-times-v1'
const INFINITE_DISTANCE_KEY = 'drift-tunnel-infinite-distance-v1'
const INFINITE_SCORE_KEY = 'drift-tunnel-infinite-score-v1'
const EXPLORE_GHOSTS_KEY = 'drift-tunnel-explore-ghosts-v1'
const STREAM_AHEAD = 48
const CULL_BEHIND = 12
const RUN_START_Z = 1.2
const GHOST_SAMPLE_INTERVAL = 0.1
const MAX_GHOST_SAMPLES = 18_000
/** Collision-only ledge extending 10% of a tile into either edge of a gap. */
const SUPPORT_OVERHANG = RING_DEPTH * 0.1

export type DriftWorld = {
  mode: DriftMode
  phase: DriftPhase
  levelIndex: number
  levelName: string
  hint: string
  rings: Ring[]
  ringOffset: number
  z: number
  face: FaceIndex
  lateral: number
  height: number
  vHeight: number
  vLateral: number
  speed: number
  speedPreset: SpeedPreset
  boostT: number
  flipCooldown: number
  alive: boolean
  distance: number
  bestDistance: number
  elapsed: number
  score: number
  levelTimes: number[]
  distanceLeaders: InfiniteRunRecord[]
  scoreLeaders: InfiniteRunRecord[]
  seed: number
  runSeed: number
  seedLabel: string
  runSamples: GhostSample[]
  ghostSampleAccumulator: number
  ghostRun: ExploreGhostRun | null
  ghostCursor: number
  jumpBuffered: boolean
  jumpHeld: boolean
  wasGrounded: boolean
  falling: boolean
  supportRing: number
  supportFace: FaceIndex
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function validTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function loadLevelTimes(levelIndex: number): number[] {
  const all = readStorage<unknown[]>(LEVEL_TIMES_KEY, [])
  const times = Array.isArray(all[levelIndex]) ? all[levelIndex] : []
  return (times as unknown[]).filter(validTime).sort((a, b) => a - b).slice(0, 10)
}

function saveLevelTime(levelIndex: number, elapsed: number): number[] {
  const all = readStorage<unknown[]>(LEVEL_TIMES_KEY, [])
  while (all.length < levelCount()) all.push([])
  const current = Array.isArray(all[levelIndex]) ? all[levelIndex] as unknown[] : []
  const times = [...current.filter(validTime), elapsed].sort((a, b) => a - b).slice(0, 10)
  all[levelIndex] = times
  writeStorage(LEVEL_TIMES_KEY, all)
  return times
}

function validInfiniteRecord(value: unknown): value is InfiniteRunRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<InfiniteRunRecord>
  return (
    typeof record.distance === 'number' &&
    Number.isFinite(record.distance) &&
    record.distance > 0 &&
    typeof record.elapsed === 'number' &&
    Number.isFinite(record.elapsed) &&
    record.elapsed > 0 &&
    typeof record.score === 'number' &&
    Number.isFinite(record.score) &&
    record.score >= 0
  )
}

function loadInfiniteBoard(
  key: string,
  compare: (a: InfiniteRunRecord, b: InfiniteRunRecord) => number,
): InfiniteRunRecord[] {
  const records = readStorage<unknown[]>(key, [])
  return records.filter(validInfiniteRecord).sort(compare).slice(0, 10)
}

function loadDistanceLeaders(): InfiniteRunRecord[] {
  return loadInfiniteBoard(INFINITE_DISTANCE_KEY, (a, b) => b.distance - a.distance)
}

function loadScoreLeaders(): InfiniteRunRecord[] {
  return loadInfiniteBoard(INFINITE_SCORE_KEY, (a, b) => b.score - a.score)
}

function saveInfiniteResult(record: InfiniteRunRecord): {
  distanceLeaders: InfiniteRunRecord[]
  scoreLeaders: InfiniteRunRecord[]
} {
  const distanceLeaders = [...loadDistanceLeaders(), record]
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 10)
  const scoreLeaders = [...loadScoreLeaders(), record]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
  writeStorage(INFINITE_DISTANCE_KEY, distanceLeaders)
  writeStorage(INFINITE_SCORE_KEY, scoreLeaders)
  return { distanceLeaders, scoreLeaders }
}

function validGhostSample(value: unknown): value is GhostSample {
  if (!Array.isArray(value) || value.length !== 5) return false
  const [elapsed, distance, face, lateral, height] = value
  return (
    typeof elapsed === 'number' &&
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    typeof distance === 'number' &&
    Number.isFinite(distance) &&
    distance >= 0 &&
    typeof face === 'number' &&
    Number.isInteger(face) &&
    face >= 0 &&
    face <= 3 &&
    typeof lateral === 'number' &&
    Number.isFinite(lateral) &&
    typeof height === 'number' &&
    Number.isFinite(height)
  )
}

function loadExploreGhost(levelIndex: number): ExploreGhostRun | null {
  const all = readStorage<unknown[]>(EXPLORE_GHOSTS_KEY, [])
  const candidate = all[levelIndex] as Partial<ExploreGhostRun> | undefined
  if (!candidate || !validTime(candidate.elapsed) || !Array.isArray(candidate.samples)) return null
  const samples = candidate.samples.filter(validGhostSample).slice(0, MAX_GHOST_SAMPLES)
  if (samples.length < 2) return null
  return { elapsed: candidate.elapsed, samples }
}

function recordGhostSample(world: DriftWorld, force = false) {
  if (world.mode !== 'explore') return
  if (!force && world.ghostSampleAccumulator < GHOST_SAMPLE_INTERVAL) return
  if (!force) world.ghostSampleAccumulator -= GHOST_SAMPLE_INTERVAL
  if (world.runSamples.length >= MAX_GHOST_SAMPLES) return
  const last = world.runSamples.at(-1)
  if (force && last && Math.abs(last[0] - world.elapsed) < 0.001) return
  world.runSamples.push([
    world.elapsed,
    world.distance,
    world.face,
    world.lateral,
    world.height,
  ])
}

function saveExploreGhost(world: DriftWorld) {
  recordGhostSample(world, true)
  if (world.runSamples.length < 2) return
  const leaderboardBest = world.levelTimes[0] ?? Number.POSITIVE_INFINITY
  if (world.elapsed > leaderboardBest + 0.0001) {
    world.ghostRun = loadExploreGhost(world.levelIndex)
    return
  }
  const previous = loadExploreGhost(world.levelIndex)
  if (previous && previous.elapsed <= world.elapsed) {
    world.ghostRun = previous
    return
  }
  const ghost: ExploreGhostRun = {
    elapsed: world.elapsed,
    samples: world.runSamples,
  }
  const all = readStorage<unknown[]>(EXPLORE_GHOSTS_KEY, [])
  while (all.length < levelCount()) all.push(null)
  all[world.levelIndex] = ghost
  writeStorage(EXPLORE_GHOSTS_KEY, all)
  world.ghostRun = ghost
}

function randomSeedLabel(): string {
  try {
    const value = new Uint32Array(1)
    crypto.getRandomValues(value)
    return value[0]!.toString(16).padStart(8, '0').toUpperCase()
  } catch {
    return ((Math.random() * 0xffffffff) >>> 0).toString(16).padStart(8, '0').toUpperCase()
  }
}

function hashSeed(label: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 1
}

/** Distance rewards survival; average speed rewards Fast mode and boost routing. */
export function calculateInfiniteScore(distance: number, elapsed: number): number {
  if (distance <= 0 || elapsed <= 0) return 0
  const averageSpeed = distance / elapsed
  return Math.floor(distance * averageSpeed * 10)
}

function baseSpeed(preset: SpeedPreset): number {
  return BASE_SPEED[preset]
}

export function createWorld(
  mode: DriftMode = 'explore',
  levelIndex = 0,
  speedPreset: SpeedPreset = 'normal',
): DriftWorld {
  const world: DriftWorld = {
    mode,
    phase: 'idle',
    levelIndex,
    levelName: '',
    hint: '',
    rings: [],
    ringOffset: 0,
    z: 0,
    face: 0,
    lateral: 0,
    height: 0,
    vHeight: 0,
    vLateral: 0,
    speed: baseSpeed(speedPreset),
    speedPreset,
    boostT: 0,
    flipCooldown: 0,
    alive: true,
    distance: 0,
    bestDistance: 0,
    elapsed: 0,
    score: 0,
    levelTimes: [],
    distanceLeaders: [],
    scoreLeaders: [],
    seed: (Math.random() * 0xffffffff) >>> 0,
    runSeed: 0,
    seedLabel: '',
    runSamples: [],
    ghostSampleAccumulator: 0,
    ghostRun: null,
    ghostCursor: 0,
    jumpBuffered: false,
    jumpHeld: false,
    wasGrounded: true,
    falling: false,
    supportRing: 1,
    supportFace: 0,
  }
  resetRun(world, mode, levelIndex)
  world.phase = 'idle'
  return world
}

export function resetRun(
  world: DriftWorld,
  mode: DriftMode = world.mode,
  levelIndex: number = world.levelIndex,
  infiniteSeedLabel?: string,
) {
  world.mode = mode
  world.levelIndex = levelIndex
  world.ringOffset = 0
  world.z = RUN_START_Z
  world.face = 0
  world.lateral = 0
  world.height = 0
  world.vHeight = 0
  world.vLateral = 0
  world.speed = baseSpeed(world.speedPreset)
  world.boostT = 0
  world.flipCooldown = 0
  world.alive = true
  world.distance = 0
  world.elapsed = 0
  world.score = 0
  world.runSamples = []
  world.ghostSampleAccumulator = 0
  world.ghostRun = null
  world.ghostCursor = 0
  world.jumpBuffered = false
  world.jumpHeld = false
  world.wasGrounded = true
  world.falling = false
  world.supportRing = Math.floor(world.z / RING_DEPTH)
  world.supportFace = 0
  world.phase = 'racing'
  world.distanceLeaders = loadDistanceLeaders()
  world.scoreLeaders = loadScoreLeaders()
  world.bestDistance = world.distanceLeaders[0]?.distance ?? 0

  if (mode === 'explore') {
    const level = getLevel(levelIndex)
    world.levelName = level.name
    world.hint = level.hint
    world.rings = cloneRings(level.rings)
    world.levelTimes = loadLevelTimes(levelIndex)
    world.ghostRun = loadExploreGhost(levelIndex)
    world.seedLabel = ''
    world.runSamples = [[0, 0, 0, 0, 0]]
  } else {
    world.levelName = 'Infinite'
    world.hint = 'How far can you drift?'
    world.seedLabel = infiniteSeedLabel?.trim() || randomSeedLabel()
    world.runSeed = hashSeed(world.seedLabel)
    world.seed = world.runSeed
    const intro: Ring[] = Array.from({ length: 10 }, () => solidRing())
    world.rings = [...cloneRings(intro), ...generateChunk(world.seed, 0, 40)]
    world.seed = nextSeed(world.seed)
    world.levelTimes = []
  }
}

export function setSpeedPreset(world: DriftWorld, preset: SpeedPreset) {
  world.speedPreset = preset
  if (world.boostT <= 0) world.speed = baseSpeed(preset)
}

export function startRun(world: DriftWorld) {
  if (world.phase === 'idle') {
    world.phase = 'racing'
  } else if (world.phase === 'failed' || world.phase === 'cleared') {
    resetRun(world)
  }
}

export function startInfiniteSeed(world: DriftWorld, seedLabel: string) {
  resetRun(world, 'infinite', 0, seedLabel)
}

export function nextLevel(world: DriftWorld) {
  const next = (world.levelIndex + 1) % levelCount()
  resetRun(world, 'explore', next)
}

export function prevLevel(world: DriftWorld) {
  const prev = (world.levelIndex - 1 + levelCount()) % levelCount()
  resetRun(world, 'explore', prev)
}

export function switchMode(world: DriftWorld, mode: DriftMode) {
  resetRun(world, mode, mode === 'explore' ? world.levelIndex : 0)
  world.phase = 'idle'
}

export function exploreLevelTotal(): number {
  return levelCount()
}

function ringIndexAt(world: DriftWorld, z: number): number {
  return Math.floor(z / RING_DEPTH) - world.ringOffset
}

function tileUnder(world: DriftWorld) {
  const idx = ringIndexAt(world, world.z)
  return getTile(world.rings, idx, world.face)
}

type SupportInfo = {
  tile: NonNullable<ReturnType<typeof getTile>>
  absRing: number
}

/**
 * Returns visible support or a small invisible lip from an adjacent block.
 * The lip exists only inside a gap, so the rendered geometry stays honest.
 */
function supportAt(
  world: DriftWorld,
  z = world.z,
  face = world.face,
): SupportInfo | null {
  const absRing = Math.floor(z / RING_DEPTH)
  const localRing = absRing - world.ringOffset
  const current = getTile(world.rings, localRing, face)
  if (isWalkable(current)) return { tile: current!, absRing }

  const positionInRing = z - absRing * RING_DEPTH
  if (positionInRing <= SUPPORT_OVERHANG) {
    const previous = getTile(world.rings, localRing - 1, face)
    if (isWalkable(previous)) return { tile: previous!, absRing: absRing - 1 }
  }
  if (positionInRing >= RING_DEPTH - SUPPORT_OVERHANG) {
    const next = getTile(world.rings, localRing + 1, face)
    if (isWalkable(next)) return { tile: next!, absRing: absRing + 1 }
  }
  return null
}

function hasSupport(world: DriftWorld, z = world.z, face = world.face): boolean {
  return supportAt(world, z, face) !== null
}

function ensureStream(world: DriftWorld) {
  if (world.mode !== 'infinite') return
  const playerRing = Math.floor(world.z / RING_DEPTH)
  const localIdx = playerRing - world.ringOffset
  const ahead = world.rings.length - localIdx
  if (ahead < STREAM_AHEAD) {
    const chunk = generateChunk(world.seed, world.distance, 32)
    world.seed = nextSeed(world.seed)
    world.rings.push(...chunk)
  }
  if (localIdx > CULL_BEHIND) {
    const cull = localIdx - CULL_BEHIND
    world.rings.splice(0, cull)
    world.ringOffset += cull
  }
}

function tryFlip(world: DriftWorld, input: DriftInput): boolean {
  if (world.flipCooldown > 0 || world.falling) return false
  // Allow grounded flips and mid-air latch flips (Run-like)
  if (world.height > 1.8) return false

  // Camera looks down +Z, so screen-left is positive world tangent.
  if (input.left && world.lateral >= FLIP_EDGE) {
    const nextFace = ((world.face + 1) % 4) as FaceIndex
    const support = supportAt(world, world.z, nextFace)
    if (!support) return false
    leaveSupport(world)
    world.face = nextFace
    world.lateral = -0.32
    world.vLateral = Math.min(world.vLateral, 0)
    world.flipCooldown = 0.22
    world.height = 0
    world.vHeight = 0
    world.supportRing = support.absRing
    world.supportFace = nextFace
    return true
  } else if (input.right && world.lateral <= -FLIP_EDGE) {
    const nextFace = ((world.face + 3) % 4) as FaceIndex
    const support = supportAt(world, world.z, nextFace)
    if (!support) return false
    leaveSupport(world)
    world.face = nextFace
    world.lateral = 0.32
    world.vLateral = Math.max(world.vLateral, 0)
    world.flipCooldown = 0.22
    world.height = 0
    world.vHeight = 0
    world.supportRing = support.absRing
    world.supportFace = nextFace
    return true
  }
  return false
}

function applyTileEffects(world: DriftWorld, support: SupportInfo | null) {
  if (!support) return

  if (support.tile.kind === 'boost' && world.boostT <= 0) {
    world.boostT = BOOST_DURATION
  }
  if (support.tile.kind === 'crumble') {
    support.tile.contacted = true
  }
}

function leaveSupport(world: DriftWorld) {
  const idx = world.supportRing - world.ringOffset
  const t = getTile(world.rings, idx, world.supportFace)
  if (t?.kind === 'crumble' && t.contacted) {
    t.crumbled = true
  }
}

export function stepWorld(world: DriftWorld, dt: number, input: DriftInput) {
  if (world.phase !== 'racing' || !world.alive) return

  const clampedDt = Math.min(dt, 0.05)
  ensureStream(world)

  if (world.flipCooldown > 0) world.flipCooldown -= clampedDt
  if (world.boostT > 0) {
    world.boostT -= clampedDt
    world.speed = baseSpeed(world.speedPreset) * BOOST_MULT
  } else {
    world.speed = baseSpeed(world.speedPreset)
  }

  // Buffer only the rising edge. Holding jump can never rescue a missed gap.
  if (input.jump && !world.jumpHeld) world.jumpBuffered = true
  world.jumpHeld = input.jump

  // Substeps prevent fast/boost mode from skipping narrow gap rings.
  const steps = Math.max(1, Math.ceil((world.speed * clampedDt) / (RING_DEPTH * 0.25)))
  const stepDt = clampedDt / steps
  for (let step = 0; step < steps; step++) {
    world.elapsed += stepDt
    stepMotion(world, stepDt, input)
    world.distance = Math.max(0, world.z - RUN_START_Z)
    if (!world.alive) return
    if (world.mode === 'explore') {
      world.ghostSampleAccumulator += stepDt
      recordGhostSample(world)
    }
  }

  if (world.mode === 'explore') {
    const endZ = world.rings.length * RING_DEPTH - RING_DEPTH * 0.5
    if (world.z >= endZ) {
      world.phase = 'cleared'
      world.alive = false
      world.levelTimes = saveLevelTime(world.levelIndex, world.elapsed)
      saveExploreGhost(world)
    }
  }
}

function stepMotion(world: DriftWorld, dt: number, input: DriftInput) {
  if (world.falling) {
    world.vHeight -= GRAVITY * dt
    world.height += world.vHeight * dt
    world.z += world.speed * dt
    if (world.height < -1.2) fail(world)
    return
  }

  const under = supportAt(world)?.tile ?? tileUnder(world)
  const onIce = under?.kind === 'ice' && isWalkable(under)
  const accel = onIce ? ICE_ACCEL : STRAFE_ACCEL
  const friction = onIce ? ICE_FRICTION : STRAFE_FRICTION
  let wish = 0
  // The chase camera looks along +Z, which mirrors world X on screen.
  if (input.left) wish += 1
  if (input.right) wish -= 1
  world.vLateral += wish * accel * dt
  world.vLateral *= Math.exp(-friction * dt)
  world.lateral = Math.max(-0.5, Math.min(0.5, world.lateral + world.vLateral * dt))

  tryFlip(world, input)

  const grounded = world.height <= 0.001 && hasSupport(world)
  if (world.jumpBuffered && grounded) {
    leaveSupport(world)
    world.vHeight = JUMP_VELOCITY
    world.height = 0.02
    world.jumpBuffered = false
    world.wasGrounded = false
  }

  world.vHeight -= GRAVITY * dt
  world.height += world.vHeight * dt
  world.z += world.speed * dt

  const support = supportAt(world)
  if (world.height <= 0) {
    if (support) {
      const ring = support.absRing
      if (ring !== world.supportRing || world.face !== world.supportFace) {
        leaveSupport(world)
        world.supportRing = ring
        world.supportFace = world.face
      }
      world.height = 0
      world.vHeight = 0
      world.wasGrounded = true
      applyTileEffects(world, support)
    } else {
      // Missing a surface latches an irreversible fall. A later ring cannot
      // snap the player back up and jump input is ignored.
      leaveSupport(world)
      world.falling = true
      world.jumpBuffered = false
      world.wasGrounded = false
      world.vHeight = Math.min(world.vHeight, -1.5)
    }
  } else {
    world.wasGrounded = false
  }
}

function fail(world: DriftWorld) {
  world.distance = Math.max(0, world.z - RUN_START_Z)
  world.score =
    world.mode === 'infinite'
      ? calculateInfiniteScore(world.distance, world.elapsed)
      : 0
  world.alive = false
  world.phase = 'failed'
  if (world.mode === 'infinite') {
    const leaders = saveInfiniteResult({
      distance: world.distance,
      elapsed: world.elapsed,
      score: world.score,
    })
    world.distanceLeaders = leaders.distanceLeaders
    world.scoreLeaders = leaders.scoreLeaders
    world.bestDistance = leaders.distanceLeaders[0]?.distance ?? world.distance
  }
}

export function snapshot(world: DriftWorld): DriftSnapshot {
  return {
    phase: world.phase,
    mode: world.mode,
    levelIndex: world.levelIndex,
    levelTotal: levelCount(),
    levelName: world.levelName,
    distance: world.distance,
    bestDistance: world.bestDistance,
    elapsed: world.elapsed,
    score: world.score,
    levelTimes: world.levelTimes,
    distanceLeaders: world.distanceLeaders,
    scoreLeaders: world.scoreLeaders,
    hasGhost: world.ghostRun !== null,
    ghostTime: world.ghostRun?.elapsed ?? 0,
    seedLabel: world.seedLabel,
    speed: world.speed,
    face: world.face,
    boostT: world.boostT,
    alive: world.alive,
    ringsAhead: Math.max(0, world.rings.length - ringIndexAt(world, world.z)),
  }
}

/** World-space position of the runner. */
export function playerWorldPos(world: DriftWorld): {
  x: number
  y: number
  z: number
  up: [number, number, number]
  right: [number, number, number]
} {
  return stateWorldPos(world.z, world.face, world.lateral, world.height)
}

function stateWorldPos(
  z: number,
  face: FaceIndex,
  lateral: number,
  height: number,
): {
  x: number
  y: number
  z: number
  up: [number, number, number]
  right: [number, number, number]
} {
  const out = FACE_OUTWARD[face]!
  const lat = FACE_LATERAL[face]!
  const half = TUNNEL_HALF
  const lateralDist = lateral * (half * 2)
  // Surface sits at outward * half; up is -outward
  const x = out[0]! * (half - height) + lat[0]! * lateralDist
  const y = out[1]! * (half - height) + lat[1]! * lateralDist
  const up: [number, number, number] = [-out[0]!, -out[1]!, -out[2]!]
  const right: [number, number, number] = [lat[0]!, lat[1]!, lat[2]!]
  return { x, y, z, up, right }
}

export function ghostWorldPos(world: DriftWorld): {
  x: number
  y: number
  z: number
  up: [number, number, number]
  right: [number, number, number]
} | null {
  const ghost = world.ghostRun
  if (
    world.mode !== 'explore' ||
    world.phase !== 'racing' ||
    !ghost ||
    world.elapsed > ghost.elapsed
  ) {
    return null
  }

  const samples = ghost.samples
  while (
    world.ghostCursor + 1 < samples.length &&
    samples[world.ghostCursor + 1]![0] <= world.elapsed
  ) {
    world.ghostCursor++
  }
  const a = samples[world.ghostCursor] ?? samples[0]!
  const b = samples[Math.min(world.ghostCursor + 1, samples.length - 1)] ?? a
  const span = Math.max(0.0001, b[0] - a[0])
  const alpha = Math.max(0, Math.min(1, (world.elapsed - a[0]) / span))
  const pa = stateWorldPos(RUN_START_Z + a[1], a[2], a[3], a[4])
  const pb = stateWorldPos(RUN_START_Z + b[1], b[2], b[3], b[4])
  const upX = pa.up[0] + (pb.up[0] - pa.up[0]) * alpha
  const upY = pa.up[1] + (pb.up[1] - pa.up[1]) * alpha
  const upZ = pa.up[2] + (pb.up[2] - pa.up[2]) * alpha
  const upLength = Math.hypot(upX, upY, upZ) || 1
  const rightX = pa.right[0] + (pb.right[0] - pa.right[0]) * alpha
  const rightY = pa.right[1] + (pb.right[1] - pa.right[1]) * alpha
  const rightZ = pa.right[2] + (pb.right[2] - pa.right[2]) * alpha
  const rightLength = Math.hypot(rightX, rightY, rightZ) || 1
  return {
    x: pa.x + (pb.x - pa.x) * alpha,
    y: pa.y + (pb.y - pa.y) * alpha,
    z: pa.z + (pb.z - pa.z) * alpha,
    up: [upX / upLength, upY / upLength, upZ / upLength],
    right: [rightX / rightLength, rightY / rightLength, rightZ / rightLength],
  }
}

export function faceQuaternion(face: FaceIndex): { x: number; y: number; z: number; w: number } {
  // Roll so "up" matches face gravity
  const angle = (-face * Math.PI) / 2
  const half = angle * 0.5
  return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) }
}
