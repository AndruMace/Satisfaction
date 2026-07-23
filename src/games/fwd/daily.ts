import { RING_DEPTH, type FaceIndex, type Ring, type TileKind } from './types'
import { cloneRings, ring, solidRing } from './tunnel'

export const DAILY_MAX_CLEARS = 1
/**
 * Local-calendar migration intentionally starts fresh. UTC records can share a
 * date key with the following local day, so they cannot be migrated safely.
 */
export const DAILY_STORAGE_KEY = 'fwd-daily-v3'
export const DAILY_LAUNCH_EPOCH = '2026-07-22'

const DAY_MS = 86_400_000
const MIN_BOOST_DENSITY = 0.035
const MAX_BOOST_DENSITY = 0.18
const MAX_GENERATION_ATTEMPTS = 12

export type DailyClear = {
  elapsed: number
}

export type DailyRecord = {
  date: string
  puzzleNumber: number
  /** Player opted into the single ranked attempt for this day. */
  rankedCommitted: boolean
  clears: DailyClear[]
  deaths: number
  streak: number
}

type DailyHistory = {
  version: 3
  days: Record<string, DailyRecord>
}

export type DailyCourse = {
  date: string
  puzzleNumber: number
  seed: number
  rings: Ring[]
}

export type DailyValidation = {
  ok: boolean
  boostDensity: number
  hasRoute: boolean
  hasSafeStart: boolean
  hasSafeFinish: boolean
  singleSafeRings: number
  routeChanges: number
  hazardVariety: number
  difficultyScore: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function isDailyLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Calendar date where the player is, so their daily resets at local midnight. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseUtcDate(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`)
}

export function isValidUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = parseUtcDate(value)
  return Number.isFinite(parsed) && utcDateKey(new Date(parsed)) === value
}

export function previousUtcDate(dateKey: string): string {
  return utcDateKey(new Date(parseUtcDate(dateKey) - DAY_MS))
}

export function shiftUtcDate(dateKey: string, days: number): string {
  return utcDateKey(new Date(parseUtcDate(dateKey) + days * DAY_MS))
}

export function dailyPuzzleNumber(dateKey: string): number {
  const days = Math.floor(
    (parseUtcDate(dateKey) - parseUtcDate(DAILY_LAUNCH_EPOCH)) / DAY_MS,
  )
  return Math.max(1, days + 1)
}

export function hashDailySeed(label: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 1
}

function validClear(value: unknown): value is DailyClear {
  if (!value || typeof value !== 'object') return false
  const elapsed = (value as Partial<DailyClear>).elapsed
  return typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed > 0
}

function validRecord(value: unknown, date: string): value is DailyRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DailyRecord>
  return (
    record.date === date &&
    record.puzzleNumber === dailyPuzzleNumber(date) &&
    typeof record.rankedCommitted === 'boolean' &&
    Array.isArray(record.clears) &&
    record.clears.length <= DAILY_MAX_CLEARS &&
    record.clears.every(validClear) &&
    typeof record.deaths === 'number' &&
    Number.isInteger(record.deaths) &&
    record.deaths >= 0 &&
    typeof record.streak === 'number' &&
    Number.isInteger(record.streak) &&
    record.streak >= 0
  )
}

function emptyHistory(): DailyHistory {
  return { version: 3, days: {} }
}

function readHistory(storage: StorageLike | null = getStorage()): DailyHistory {
  if (!storage) return emptyHistory()
  try {
    const parsed = JSON.parse(storage.getItem(DAILY_STORAGE_KEY) ?? '')
    if (!parsed || parsed.version !== 3 || typeof parsed.days !== 'object') {
      return emptyHistory()
    }
    const days: Record<string, DailyRecord> = {}
    for (const [date, value] of Object.entries(parsed.days as Record<string, unknown>)) {
      if (validRecord(value, date)) days[date] = value
    }
    return { version: 3, days }
  } catch {
    return emptyHistory()
  }
}

function writeHistory(history: DailyHistory, storage: StorageLike | null = getStorage()) {
  if (!storage) return
  try {
    storage.setItem(DAILY_STORAGE_KEY, JSON.stringify(history))
  } catch {
    /* Local progress is best-effort. */
  }
}

export function emptyDailyRecord(date: string): DailyRecord {
  return {
    date,
    puzzleNumber: dailyPuzzleNumber(date),
    rankedCommitted: false,
    clears: [],
    deaths: 0,
    streak: 0,
  }
}

export function loadDailyRecord(
  date = localDateKey(),
  storage: StorageLike | null = getStorage(),
): DailyRecord {
  const record = readHistory(storage).days[date]
  return record ? structuredClone(record) : emptyDailyRecord(date)
}

/** Ranked run is active after opt-in and before the single successful clear. */
export function isDailyRankedActive(record: DailyRecord): boolean {
  return record.rankedCommitted && record.clears.length === 0
}

export function isDailyComplete(record: DailyRecord): boolean {
  return record.clears.length > 0
}

/** True when the current day is in practice (before ranked or after the clear). */
export function isDailyPractice(record: DailyRecord): boolean {
  return !isDailyRankedActive(record)
}

export function commitDailyRanked(
  date: string,
  storage: StorageLike | null = getStorage(),
): DailyRecord {
  const history = readHistory(storage)
  const record = history.days[date] ?? emptyDailyRecord(date)
  if (!isDailyComplete(record)) record.rankedCommitted = true
  history.days[date] = record
  writeHistory(history, storage)
  return structuredClone(record)
}

export function clearDailyDay(
  date: string,
  storage: StorageLike | null = getStorage(),
): DailyRecord {
  const history = readHistory(storage)
  delete history.days[date]
  writeHistory(history, storage)
  return emptyDailyRecord(date)
}

export function recordDailyDeath(
  date: string,
  storage: StorageLike | null = getStorage(),
): DailyRecord {
  const history = readHistory(storage)
  const record = history.days[date] ?? emptyDailyRecord(date)
  if (isDailyRankedActive(record)) record.deaths += 1
  history.days[date] = record
  writeHistory(history, storage)
  return structuredClone(record)
}

export function recordDailyClear(
  date: string,
  elapsed: number,
  storage: StorageLike | null = getStorage(),
): DailyRecord {
  const history = readHistory(storage)
  const record = history.days[date] ?? emptyDailyRecord(date)
  if (
    !isDailyRankedActive(record) ||
    !Number.isFinite(elapsed) ||
    elapsed <= 0 ||
    record.clears.length >= DAILY_MAX_CLEARS
  ) {
    return structuredClone(record)
  }

  const previous = history.days[previousUtcDate(date)]
  record.streak = previous && previous.clears.length > 0 ? previous.streak + 1 : 1
  record.clears = [{ elapsed }]
  history.days[date] = record

  const dates = Object.keys(history.days).sort().reverse()
  for (const oldDate of dates.slice(400)) delete history.days[oldDate]
  writeHistory(history, storage)
  return structuredClone(record)
}

export function dailyBest(record: DailyRecord): {
  elapsed: number
  attempt: number
} | null {
  const clear = record.clears[0]
  if (!clear) return null
  return { elapsed: clear.elapsed, attempt: 1 }
}

export function formatDailyTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const wholeSeconds = Math.floor(safe % 60)
  const millis = Math.floor((safe - Math.floor(safe)) * 1000)
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

export function formatDailyShare(record: DailyRecord, siteUrl: string): string {
  const best = dailyBest(record)
  if (!best) return ''
  const streakLabel = record.streak === 1 ? 'day' : 'days'
  return [
    `🚀 Fwd Daily #${record.puzzleNumber}`,
    `⏱ ${formatDailyTime(best.elapsed)}`,
    `💥 ${record.deaths} ${record.deaths === 1 ? 'death' : 'deaths'}`,
    `🔥 ${record.streak} ${streakLabel} streak`,
    '',
    siteUrl,
    '#Fwd',
  ].join('\n')
}

type SeedState = { value: number }

function random(state: SeedState): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0
  return state.value / 0x1_0000_0000
}

function choose<T>(state: SeedState, values: readonly T[]): T {
  return values[Math.floor(random(state) * values.length)]!
}

function repeated(source: Ring, count: number): Ring[] {
  return Array.from({ length: count }, () =>
    ring(source[0].kind, source[1].kind, source[2].kind, source[3].kind),
  )
}

function boostRing(face: FaceIndex): Ring {
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  kinds[face] = 'boost'
  return ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!)
}

function specialRing(face: FaceIndex, kind: TileKind): Ring {
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  kinds[face] = kind
  return ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!)
}

function routeRing(
  safeFaces: readonly FaceIndex[],
  boostFace?: FaceIndex,
): Ring {
  const kinds: TileKind[] = ['gap', 'gap', 'gap', 'gap']
  for (const face of safeFaces) kinds[face] = face === boostFace ? 'boost' : 'solid'
  return ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!)
}

function recovery(state: SeedState, previousFace: FaceIndex): Ring[] {
  const length = 2 + Math.floor(random(state) * 3)
  const boostFace = random(state) < 0.82 ? choose(state, [0, 1, 2, 3] as const) : -1
  return Array.from({ length }, (_, index) =>
    index === 1 && boostFace >= 0
      ? boostRing(boostFace as FaceIndex)
      : index === 2 && random(state) < 0.25
        ? boostRing(previousFace)
        : solidRing(),
  )
}

function jumpMotif(state: SeedState, difficulty: number): Ring[] {
  const face = choose(state, [0, 1, 2, 3] as const)
  const maxExtra = difficulty >= 2 ? 2 : 1
  const length = 2 + Math.floor(random(state) * (maxExtra + 1))
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  kinds[face] = 'gap'
  return repeated(ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!), length)
}

function wallTransferMotif(state: SeedState, difficulty: number): Ring[] {
  const missing = choose(state, [0, 1, 2, 3] as const)
  const length = 6 + Math.floor(random(state) * Math.min(4, 2 + difficulty))
  const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
  kinds[missing] = 'gap'
  const lane = ((missing + (random(state) < 0.5 ? 1 : 3)) % 4) as FaceIndex
  if (random(state) < 0.65) kinds[lane] = 'boost'
  return repeated(ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!), length)
}

function rotatingMotif(state: SeedState, difficulty: number): Ring[] {
  const direction = random(state) < 0.5 ? 1 : 3
  let face = choose(state, [0, 1, 2, 3] as const)
  const sections = 4 + Math.min(2, difficulty)
  const rings: Ring[] = []
  for (let section = 0; section < sections; section++) {
    const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
    kinds[face] = 'gap'
    if (difficulty >= 2 && section % 2 === 1) {
      kinds[((face + 2) % 4) as FaceIndex] = 'ice'
    }
    rings.push(...repeated(ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!), 2))
    face = ((face + direction) % 4) as FaceIndex
  }
  return rings
}

function textureMotif(state: SeedState, difficulty: number): Ring[] {
  const length = 6 + difficulty
  const safeFace = choose(state, [0, 1, 2, 3] as const)
  return Array.from({ length }, (_, index) => {
    const kinds: TileKind[] = ['solid', 'solid', 'solid', 'solid']
    const hazardFace = ((safeFace + 2) % 4) as FaceIndex
    kinds[hazardFace] = index % 3 === 0 ? 'gap' : 'crumble'
    kinds[((safeFace + 1) % 4) as FaceIndex] = index % 2 === 0 ? 'ice' : 'solid'
    if (index === 1 && random(state) < 0.8) kinds[safeFace] = 'boost'
    return ring(kinds[0]!, kinds[1]!, kinds[2]!, kinds[3]!)
  })
}

/**
 * A readable but committed route: an adjacent two-face handoff window is
 * followed by a one-face corridor. The overlap makes every required flip
 * possible without allowing the player to remain on an arbitrary safe face.
 */
function corridorMotif(state: SeedState, difficulty: number): Ring[] {
  const direction = random(state) < 0.5 ? 1 : 3
  let face = choose(state, [0, 1, 2, 3] as const)
  const stages = 2 + Math.min(2, Math.floor(difficulty / 2))
  const rings: Ring[] = []

  for (let stage = 0; stage < stages; stage++) {
    const next = ((face + direction) % 4) as FaceIndex
    rings.push(
      routeRing([face, next], next),
      routeRing([face, next]),
    )
    const committedLength = 3 + Math.min(2, difficulty)
    rings.push(...repeated(routeRing([next]), committedLength))
    face = next
  }
  return rings
}

/** Two-face lanes rotate with one shared face, creating quick readable flips. */
function slalomMotif(state: SeedState, difficulty: number): Ring[] {
  const direction = random(state) < 0.5 ? 1 : 3
  let face = choose(state, [0, 1, 2, 3] as const)
  const stages = 4 + Math.min(2, difficulty)
  const rings: Ring[] = []

  for (let stage = 0; stage < stages; stage++) {
    const next = ((face + direction) % 4) as FaceIndex
    const boostFace = stage % 3 === 1 ? next : undefined
    rings.push(
      routeRing([face, next], boostFace),
      routeRing([face, next]),
      routeRing([face, next]),
    )
    face = next
  }
  return rings
}

function buildCandidate(seed: number): Ring[] {
  const state = { value: seed }
  const rings: Ring[] = Array.from({ length: 8 }, () => solidRing())
  let previousFace: FaceIndex = 0
  let previousBuilder = -1
  const builders = [
    jumpMotif,
    wallTransferMotif,
    rotatingMotif,
    textureMotif,
    corridorMotif,
    slalomMotif,
  ] as const

  for (let section = 0; section < 15; section++) {
    const difficulty = Math.min(4, Math.floor((section + 1) / 3))
    rings.push(...recovery(state, previousFace))
    let builderIndex =
      section % 4 === 2
        ? 4
        : section % 5 === 4
          ? 3
          : Math.floor(random(state) * builders.length)
    if (builderIndex === previousBuilder) builderIndex = (builderIndex + 1) % builders.length
    rings.push(...builders[builderIndex]!(state, difficulty))
    previousBuilder = builderIndex
    previousFace = choose(state, [0, 1, 2, 3] as const)
  }
  rings.push(...Array.from({ length: 7 }, () => solidRing()))
  return rings
}

function isRouteReachable(rings: Ring[]): boolean {
  if (rings.length === 0 || rings[0]![0].kind === 'gap') return false
  const reachable = Array.from({ length: rings.length }, () => new Set<FaceIndex>())
  reachable[0]!.add(0)

  for (let index = 0; index < rings.length; index++) {
    for (const face of reachable[index]!) {
      for (const destination of [face, ((face + 1) % 4) as FaceIndex, ((face + 3) % 4) as FaceIndex]) {
        const nextRing = rings[index + 1]
        const destinationIsAvailableNow = rings[index]![destination].kind !== 'gap'
        if (
          nextRing &&
          destinationIsAvailableNow &&
          nextRing[destination].kind !== 'gap'
        ) {
          reachable[index + 1]!.add(destination)
        }
      }
      for (let jump = 2; jump <= 4; jump++) {
        const landing = rings[index + jump]
        if (landing && landing[face].kind !== 'gap') reachable[index + jump]!.add(face)
      }
    }
  }
  return reachable.at(-1)!.size > 0
}

export function validateDailyCourse(rings: Ring[]): DailyValidation {
  const tiles = rings.flat()
  const boosts = tiles.filter((tile) => tile.kind === 'boost').length
  const boostDensity = tiles.length > 0 ? boosts / tiles.length : 0
  const hasSafeStart = rings.slice(0, 6).every((item) => item.every((tile) => tile.kind !== 'gap'))
  const hasSafeFinish = rings.slice(-5).every((item) => item.every((tile) => tile.kind !== 'gap'))
  const hasRoute = isRouteReachable(rings)
  const safeMasks = rings.map((item) =>
    item.reduce(
      (mask, tile, face) => mask | (tile.kind === 'gap' ? 0 : 1 << face),
      0,
    ),
  )
  const singleSafeRings = safeMasks.filter(
    (mask) => mask !== 0 && (mask & (mask - 1)) === 0,
  ).length
  const routeChanges = safeMasks.reduce(
    (count, mask, index) => count + (index > 0 && mask !== safeMasks[index - 1] ? 1 : 0),
    0,
  )
  const hazardVariety = new Set(
    tiles.filter((tile) => tile.kind !== 'solid').map((tile) => tile.kind),
  ).size
  const difficultyScore =
    singleSafeRings * 2 +
    routeChanges * 3 +
    hazardVariety * 8 +
    Math.round(rings.length / 8)
  return {
    ok:
      rings.length >= 115 &&
      hasSafeStart &&
      hasSafeFinish &&
      hasRoute &&
      singleSafeRings >= 18 &&
      routeChanges >= 10 &&
      hazardVariety >= 3 &&
      difficultyScore >= 115 &&
      boostDensity >= MIN_BOOST_DENSITY &&
      boostDensity <= MAX_BOOST_DENSITY,
    boostDensity,
    hasRoute,
    hasSafeStart,
    hasSafeFinish,
    singleSafeRings,
    routeChanges,
    hazardVariety,
    difficultyScore,
  }
}

function fallbackCourse(): Ring[] {
  const rings: Ring[] = Array.from({ length: 8 }, () => solidRing())
  let face: FaceIndex = 0
  for (let section = 0; section < 18; section++) {
    rings.push(
      specialRing((section % 4) as FaceIndex, section % 2 === 0 ? 'ice' : 'crumble'),
      boostRing((section % 4) as FaceIndex),
      solidRing(),
    )
    const next = ((face + 1) % 4) as FaceIndex
    rings.push(routeRing([face, next], next), routeRing([face, next]))
    rings.push(...repeated(routeRing([next]), 3))
    face = next
  }
  rings.push(...Array.from({ length: 7 }, () => solidRing()))
  return rings
}

export function buildDailyCourse(date = localDateKey()): DailyCourse {
  const initialSeed = hashDailySeed(`fwd-daily:${date}`)
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const seed = (initialSeed + Math.imul(attempt, 0x9e3779b1)) >>> 0 || 1
    const rings = buildCandidate(seed)
    if (validateDailyCourse(rings).ok) {
      return {
        date,
        puzzleNumber: dailyPuzzleNumber(date),
        seed,
        rings: cloneRings(rings),
      }
    }
  }
  return {
    date,
    puzzleNumber: dailyPuzzleNumber(date),
    seed: initialSeed,
    rings: cloneRings(fallbackCourse()),
  }
}

export function dailyCourseDistance(course: DailyCourse): number {
  return course.rings.length * RING_DEPTH
}
