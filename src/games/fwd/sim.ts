import { getLevel, levelCount } from './levels'
import { generateChunk, nextSeed } from './procedural'
import {
  buildDailyCourse,
  clearDailyDay,
  commitDailyRanked,
  dailyBest,
  emptyDailyRecord,
  isDailyComplete,
  isDailyLocalhost,
  isDailyPractice,
  isValidUtcDateKey,
  loadDailyRecord,
  recordDailyClear,
  recordDailyDeath,
  utcDateKey,
  type DailyRecord,
} from './daily'
import { cloneRings, getTile, isWalkable, solidRing } from './tunnel'
import {
  BASE_SPEED,
  BOOST_DECAY_DURATION,
  BOOST_DURATION,
  BOOST_MULT,
  COYOTE_TIME,
  FACE_LATERAL,
  FACE_OUTWARD,
  FLIP_EDGE,
  GRAVITY,
  ICE_ACCEL,
  ICE_FRICTION,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  RING_DEPTH,
  STRAFE_ACCEL,
  STRAFE_FRICTION,
  TUNNEL_HALF,
  type FwdInput,
  type FwdMode,
  type FwdPhase,
  type FwdSnapshot,
  type ExploreGhostRun,
  type FaceIndex,
  type GhostSample,
  type InfiniteRunRecord,
  type Ring,
  type SpeedPreset,
} from './types'

const LEVEL_TIMES_KEY = 'fwd-level-times-v1'
const INFINITE_DISTANCE_KEY = 'fwd-infinite-distance-v1'
const INFINITE_SCORE_KEY = 'fwd-infinite-score-v1'
const EXPLORE_GHOSTS_KEY = 'fwd-explore-ghosts-v1'
const STREAM_AHEAD = 48
const CULL_BEHIND = 12
const RUN_START_Z = 1.2
const GHOST_SAMPLE_INTERVAL = 0.1
const MAX_GHOST_SAMPLES = 18_000
/** Collision-only ledge extending 10% of a tile into either edge of a gap. */
const SUPPORT_OVERHANG = RING_DEPTH * 0.1
/** The runner has visible depth; landings use a matching longitudinal footprint. */
const PLAYER_HALF_DEPTH = RING_DEPTH * 0.12
/** Small descending snap that makes visually convincing landings deterministic. */
const LANDING_SNAP_HEIGHT = 0.07
/** Keep swept movement shorter than the narrowest collision feature. */
const MAX_PHYSICS_STEP = SUPPORT_OVERHANG * 0.5

export type FwdWorld = {
  mode: FwdMode
  phase: FwdPhase
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
  boostStacks: number
  boostPower: number
  boostDecayT: number
  boostDecayFrom: number
  boostSegmentsHit: Set<string>
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
  jumpBufferT: number
  coyoteT: number
  jumpHeld: boolean
  wasGrounded: boolean
  falling: boolean
  supportRing: number
  supportFace: FaceIndex
  dailyDate: string
  dailyRecord: DailyRecord
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

function recordGhostSample(world: FwdWorld, force = false) {
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

function saveExploreGhost(world: FwdWorld) {
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

function boostedSpeed(world: FwdWorld): number {
  return (
    baseSpeed(world.speedPreset) *
    (1 + (BOOST_MULT - 1) * world.boostPower)
  )
}

export function createWorld(
  mode: FwdMode = 'explore',
  levelIndex = 0,
  speedPreset: SpeedPreset = 'normal',
): FwdWorld {
  const world: FwdWorld = {
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
    boostStacks: 0,
    boostPower: 0,
    boostDecayT: 0,
    boostDecayFrom: 0,
    boostSegmentsHit: new Set(),
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
    jumpBufferT: 0,
    coyoteT: COYOTE_TIME,
    jumpHeld: false,
    wasGrounded: true,
    falling: false,
    supportRing: 1,
    supportFace: 0,
    dailyDate: utcDateKey(),
    dailyRecord: emptyDailyRecord(utcDateKey()),
  }
  resetRun(world, mode, levelIndex)
  world.phase = 'idle'
  return world
}

export function resetRun(
  world: FwdWorld,
  mode: FwdMode = world.mode,
  levelIndex: number = world.levelIndex,
  infiniteSeedLabel?: string,
) {
  world.mode = mode
  if (mode === 'daily') {
    world.speedPreset = 'normal'
  }
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
  world.boostStacks = 0
  world.boostPower = 0
  world.boostDecayT = 0
  world.boostDecayFrom = 0
  world.boostSegmentsHit.clear()
  world.flipCooldown = 0
  world.alive = true
  world.distance = 0
  world.elapsed = 0
  world.score = 0
  world.runSamples = []
  world.ghostSampleAccumulator = 0
  world.ghostRun = null
  world.ghostCursor = 0
  world.jumpBufferT = 0
  world.coyoteT = COYOTE_TIME
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
  } else if (mode === 'daily') {
    const date = isValidUtcDateKey(world.dailyDate) ? world.dailyDate : utcDateKey()
    const course = buildDailyCourse(date)
    world.dailyDate = course.date
    world.dailyRecord = loadDailyRecord(course.date)
    world.levelName = `Daily #${course.puzzleNumber}`
    world.hint = 'Practice freely, then lock in one ranked clear. Deaths only count after you go ranked.'
    world.rings = course.rings
    world.levelTimes = []
    world.seedLabel = course.date
    world.runSeed = course.seed
  } else {
    world.levelName = 'Infinite'
    world.hint = 'How far can you go?'
    world.seedLabel = infiniteSeedLabel?.trim() || randomSeedLabel()
    world.runSeed = hashSeed(world.seedLabel)
    world.seed = world.runSeed
    const intro: Ring[] = Array.from({ length: 10 }, () => solidRing())
    world.rings = [...cloneRings(intro), ...generateChunk(world.seed, 0, 40)]
    world.seed = nextSeed(world.seed)
    world.levelTimes = []
  }
}

export function commitDailyRankedAttempt(world: FwdWorld) {
  if (world.mode !== 'daily') return
  world.dailyRecord = commitDailyRanked(world.dailyDate)
}

export function clearDailyProgress(world: FwdWorld) {
  if (world.mode !== 'daily') return
  const date = world.dailyDate
  world.dailyRecord = clearDailyDay(date)
  world.dailyDate = date
  resetRun(world, 'daily')
  world.phase = 'idle'
}

export function setDailyDate(world: FwdWorld, date: string) {
  if (world.mode !== 'daily') return
  if (!isDailyLocalhost() || !isValidUtcDateKey(date)) return
  world.dailyDate = date
  resetRun(world, 'daily')
  world.phase = 'idle'
}

export function setSpeedPreset(world: FwdWorld, preset: SpeedPreset) {
  if (world.mode === 'daily') return
  world.speedPreset = preset
  world.speed =
    world.boostPower > 0 ? boostedSpeed(world) : baseSpeed(world.speedPreset)
}

export function startRun(world: FwdWorld) {
  if (world.phase === 'idle') {
    world.phase = 'racing'
  } else if (world.phase === 'failed' || world.phase === 'cleared') {
    resetRun(world)
  }
}

export function startInfiniteSeed(world: FwdWorld, seedLabel: string) {
  resetRun(world, 'infinite', 0, seedLabel)
}

export function nextLevel(world: FwdWorld) {
  const next = (world.levelIndex + 1) % levelCount()
  resetRun(world, 'explore', next)
}

export function prevLevel(world: FwdWorld) {
  const prev = (world.levelIndex - 1 + levelCount()) % levelCount()
  resetRun(world, 'explore', prev)
}

export function switchMode(world: FwdWorld, mode: FwdMode) {
  resetRun(world, mode, mode === 'explore' ? world.levelIndex : 0)
  world.phase = 'idle'
}

export function exploreLevelTotal(): number {
  return levelCount()
}

function ringIndexAt(world: FwdWorld, z: number): number {
  return Math.floor(z / RING_DEPTH) - world.ringOffset
}

function tileUnder(world: FwdWorld) {
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
  world: FwdWorld,
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

/**
 * Landing support uses the runner's visible footprint instead of only its
 * center point. Ground movement still uses supportAt, so gaps are not made
 * globally shorter.
 */
function landingSupportAt(
  world: FwdWorld,
  z: number,
  face = world.face,
): SupportInfo | null {
  const centered = supportAt(world, z, face)
  if (centered) return centered

  const firstRing = Math.floor((z - PLAYER_HALF_DEPTH) / RING_DEPTH)
  const lastRing = Math.floor((z + PLAYER_HALF_DEPTH) / RING_DEPTH)
  let best: SupportInfo | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let absRing = firstRing; absRing <= lastRing; absRing++) {
    const localRing = absRing - world.ringOffset
    const tile = getTile(world.rings, localRing, face)
    if (!isWalkable(tile)) continue
    const center = (absRing + 0.5) * RING_DEPTH
    const distance = Math.abs(center - z)
    if (distance < bestDistance) {
      best = { tile: tile!, absRing }
      bestDistance = distance
    }
  }
  return best
}

/** Interpolate where the descending feet cross the floor, then test support. */
function sweptLandingSupport(
  world: FwdWorld,
  previousZ: number,
  previousHeight: number,
): SupportInfo | null {
  if (world.vHeight > 0 || world.height > LANDING_SNAP_HEIGHT) return null

  let landingZ = world.z
  if (previousHeight > 0 && world.height <= 0) {
    const heightDelta = previousHeight - world.height
    const t = heightDelta > 0 ? previousHeight / heightDelta : 1
    landingZ = previousZ + (world.z - previousZ) * Math.max(0, Math.min(1, t))
  }
  return landingSupportAt(world, landingZ)
}

function ensureStream(world: FwdWorld) {
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

function tryFlip(world: FwdWorld, input: FwdInput): boolean {
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
    world.coyoteT = COYOTE_TIME
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
    world.coyoteT = COYOTE_TIME
    return true
  }
  return false
}

function boostSegmentKey(world: FwdWorld, support: SupportInfo): string {
  const face = world.face
  let start = support.absRing
  let end = support.absRing

  while (
    getTile(world.rings, start - 1 - world.ringOffset, face)?.kind === 'boost'
  ) {
    start--
  }
  while (
    getTile(world.rings, end + 1 - world.ringOffset, face)?.kind === 'boost'
  ) {
    end++
  }
  return `${face}:${start}:${end}`
}

function applyTileEffects(world: FwdWorld, support: SupportInfo | null) {
  if (!support) return

  if (support.tile.kind === 'boost') {
    const segmentKey = boostSegmentKey(world, support)
    if (!world.boostSegmentsHit.has(segmentKey)) {
      if (world.boostT <= 0) {
        world.boostStacks = 0
        world.boostSegmentsHit.clear()
      }
      world.boostSegmentsHit.add(segmentKey)
      world.boostStacks++
      world.boostPower += 1
      world.boostT = BOOST_DURATION
      world.boostDecayT = 0
      world.boostDecayFrom = 0
      world.speed = boostedSpeed(world)
    }
  } else if (world.boostT <= 0 && world.boostPower <= 0) {
    world.boostSegmentsHit.clear()
  }
  if (support.tile.kind === 'crumble') {
    support.tile.contacted = true
  }
}

function leaveSupport(world: FwdWorld) {
  const idx = world.supportRing - world.ringOffset
  const t = getTile(world.rings, idx, world.supportFace)
  if (t?.kind === 'crumble' && t.contacted) {
    t.crumbled = true
  }
}

function settleOnSupport(world: FwdWorld, support: SupportInfo) {
  if (support.absRing !== world.supportRing || world.face !== world.supportFace) {
    leaveSupport(world)
    world.supportRing = support.absRing
    world.supportFace = world.face
  }
  world.falling = false
  world.height = 0
  world.vHeight = 0
  world.coyoteT = COYOTE_TIME
  world.wasGrounded = true
  applyTileEffects(world, support)
}

function canBeginBoostDecay(world: FwdWorld): boolean {
  return (
    !world.falling &&
    world.height <= 0.001 &&
    supportAt(world) !== null
  )
}

export function stepWorld(world: FwdWorld, dt: number, input: FwdInput) {
  if (world.phase !== 'racing' || !world.alive) return

  const clampedDt = Math.min(dt, 0.05)
  ensureStream(world)

  if (world.flipCooldown > 0) world.flipCooldown -= clampedDt
  if (world.boostT > 0) {
    world.boostT = Math.max(0, world.boostT - clampedDt)
    if (world.boostT > 0) {
      world.speed = boostedSpeed(world)
    } else {
      world.boostStacks = 0
      if (canBeginBoostDecay(world)) {
        world.boostDecayFrom = world.boostPower
        world.boostDecayT = 0
      }
      world.speed = boostedSpeed(world)
    }
  } else if (world.boostPower > 0) {
    if (world.boostDecayFrom <= 0 && canBeginBoostDecay(world)) {
      world.boostDecayFrom = world.boostPower
      world.boostDecayT = 0
    }
    if (world.boostDecayFrom > 0) {
      world.boostDecayT = Math.min(
        BOOST_DECAY_DURATION,
        world.boostDecayT + clampedDt,
      )
      const t = world.boostDecayT / BOOST_DECAY_DURATION
      const smooth = t * t * (3 - 2 * t)
      world.boostPower = world.boostDecayFrom * (1 - smooth)
      if (world.boostDecayT >= BOOST_DECAY_DURATION) {
        world.boostPower = 0
        world.boostDecayFrom = 0
        world.boostSegmentsHit.clear()
      }
      world.speed =
        world.boostPower > 0
          ? boostedSpeed(world)
          : baseSpeed(world.speedPreset)
    } else {
      // Preserve the full boost while airborne; decay starts after landing.
      world.speed = boostedSpeed(world)
    }
  } else {
    world.boostStacks = 0
    world.speed = baseSpeed(world.speedPreset)
  }

  // Buffer the rising edge briefly so render/input timing cannot lose a jump.
  if (input.jump && !world.jumpHeld) world.jumpBufferT = JUMP_BUFFER_TIME
  world.jumpHeld = input.jump

  // Substeps prevent fast/boost mode from skipping the support lips at gaps.
  const steps = Math.max(1, Math.ceil((world.speed * clampedDt) / MAX_PHYSICS_STEP))
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

  if (world.mode !== 'infinite') {
    const endZ = world.rings.length * RING_DEPTH - RING_DEPTH * 0.5
    if (world.z >= endZ) {
      world.phase = 'cleared'
      world.alive = false
      if (world.mode === 'explore') {
        world.levelTimes = saveLevelTime(world.levelIndex, world.elapsed)
        saveExploreGhost(world)
      } else {
        world.dailyRecord = recordDailyClear(world.dailyDate, world.elapsed)
      }
    }
  }
}

function stepMotion(world: FwdWorld, dt: number, input: FwdInput) {
  const previousZ = world.z
  const previousHeight = world.height

  if (world.falling) {
    world.jumpBufferT = Math.max(0, world.jumpBufferT - dt)
    world.coyoteT = Math.max(0, world.coyoteT - dt)
    if (world.jumpBufferT > 0 && world.coyoteT > 0) {
      world.falling = false
      world.vHeight = JUMP_VELOCITY
      world.height = 0.02
      world.jumpBufferT = 0
      world.coyoteT = 0
      world.wasGrounded = false
    }
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

  const flipped = tryFlip(world, input)
  if (!flipped) {
    // The mascot has visible width. Stop its center at the corner when there
    // is no adjacent surface to receive a flip instead of clipping the wall.
    if (world.lateral > FLIP_EDGE) {
      world.lateral = FLIP_EDGE
      world.vLateral = Math.min(0, world.vLateral)
    } else if (world.lateral < -FLIP_EDGE) {
      world.lateral = -FLIP_EDGE
      world.vLateral = Math.max(0, world.vLateral)
    }
  }

  const currentSupport = world.height <= 0.001 ? supportAt(world) : null
  const grounded = currentSupport !== null
  const nearLeftFlip =
    input.left &&
    world.lateral >= FLIP_EDGE - 0.03 &&
    supportAt(world, world.z, ((world.face + 1) % 4) as FaceIndex) !== null
  const nearRightFlip =
    input.right &&
    world.lateral <= -FLIP_EDGE + 0.03 &&
    supportAt(world, world.z, ((world.face + 3) % 4) as FaceIndex) !== null
  const pendingFlip = !flipped && world.flipCooldown <= 0 && (nearLeftFlip || nearRightFlip)
  if (grounded) {
    world.coyoteT = COYOTE_TIME
    // Contact effects happen before jump resolution, so jumping on the first
    // frame of a boost/crumble tile still counts as touching that tile.
    applyTileEffects(world, currentSupport)
  } else {
    world.coyoteT = Math.max(0, world.coyoteT - dt)
  }
  world.jumpBufferT = Math.max(0, world.jumpBufferT - dt)

  if (
    world.jumpBufferT > 0 &&
    (grounded || world.coyoteT > 0) &&
    !pendingFlip
  ) {
    leaveSupport(world)
    world.vHeight = JUMP_VELOCITY
    world.height = 0.02
    world.jumpBufferT = 0
    world.coyoteT = 0
    world.wasGrounded = false
  }

  world.vHeight -= GRAVITY * dt
  world.height += world.vHeight * dt
  world.z += world.speed * dt

  const landingSupport = sweptLandingSupport(world, previousZ, previousHeight)
  if (landingSupport) {
    settleOnSupport(world, landingSupport)
  } else if (world.height <= 0) {
      // A missing surface starts a fall. Coyote time may still turn the first
      // instant into a jump; after that, later rings cannot snap the player up.
      leaveSupport(world)
      world.falling = true
      world.wasGrounded = false
      world.vHeight = Math.min(world.vHeight, -1.5)
  } else {
    world.wasGrounded = false
  }
}

function fail(world: FwdWorld) {
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
  } else if (world.mode === 'daily') {
    world.dailyRecord = recordDailyDeath(world.dailyDate)
  }
}

export function snapshot(world: FwdWorld): FwdSnapshot {
  const best = dailyBest(world.dailyRecord)
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
    boostStacks: world.boostStacks,
    alive: world.alive,
    ringsAhead: Math.max(0, world.rings.length - ringIndexAt(world, world.z)),
    dailyDate: world.dailyDate,
    dailyPuzzleNumber: world.dailyRecord.puzzleNumber,
    dailyClears: world.dailyRecord.clears.map((clear) => clear.elapsed),
    dailyDeaths: world.dailyRecord.deaths,
    dailyStreak: world.dailyRecord.streak,
    dailyBestTime: best?.elapsed ?? 0,
    dailyBestAttempt: best?.attempt ?? 0,
    dailyPractice: isDailyPractice(world.dailyRecord),
    dailyRankedCommitted: world.dailyRecord.rankedCommitted,
    dailyCompleted: isDailyComplete(world.dailyRecord),
  }
}

/** World-space position of the runner. */
export function playerWorldPos(world: FwdWorld): {
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

export function ghostWorldPos(world: FwdWorld): {
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
