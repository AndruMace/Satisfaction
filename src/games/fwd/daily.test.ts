import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DAILY_STORAGE_KEY,
  buildDailyCourse,
  clearDailyDay,
  commitDailyRanked,
  dailyBest,
  dailyPuzzleNumber,
  formatDailyShare,
  hashDailySeed,
  loadDailyRecord,
  previousUtcDate,
  recordDailyClear,
  recordDailyDeath,
  utcDateKey,
  validateDailyCourse,
} from './daily'
import {
  clearDailyProgress,
  commitDailyRankedAttempt,
  createWorld,
  resetRun,
  startRun,
  stepWorld,
} from './sim'
import { RING_DEPTH } from './types'
import { ring, solidRing } from './tunnel'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function kinds(course: ReturnType<typeof buildDailyCourse>): string {
  return course.rings.map((item) => item.map((tile) => tile.kind).join(',')).join('|')
}

describe('daily identity and generation', () => {
  it('uses stable UTC dates, puzzle numbers, and seeds', () => {
    expect(utcDateKey(new Date('2026-07-22T23:59:59-05:00'))).toBe('2026-07-23')
    expect(dailyPuzzleNumber('2026-07-22')).toBe(1)
    expect(dailyPuzzleNumber('2026-07-23')).toBe(2)
    expect(previousUtcDate('2026-08-01')).toBe('2026-07-31')
    expect(hashDailySeed('fwd-daily:2026-07-22')).toBe(
      hashDailySeed('fwd-daily:2026-07-22'),
    )
  })

  it('builds the same valid finite course for everyone on a date', () => {
    const first = buildDailyCourse('2026-07-22')
    const second = buildDailyCourse('2026-07-22')
    const nextDay = buildDailyCourse('2026-07-23')

    expect(first.rings.length).toBeGreaterThanOrEqual(115)
    expect(kinds(first)).toBe(kinds(second))
    expect(kinds(first)).not.toBe(kinds(nextDay))
    expect(validateDailyCourse(first.rings)).toMatchObject({
      ok: true,
      hasRoute: true,
      hasSafeStart: true,
      hasSafeFinish: true,
    })
  })

  it('keeps a range of generated dates valid and rejects impossible geometry', () => {
    const fingerprints = new Set<string>()
    for (let day = 22; day <= 31; day++) {
      const course = buildDailyCourse(`2026-07-${day}`)
      const validation = validateDailyCourse(course.rings)
      expect(validation).toMatchObject({
        ok: true,
        hasRoute: true,
      })
      expect(validation.singleSafeRings).toBeGreaterThanOrEqual(18)
      expect(validation.routeChanges).toBeGreaterThanOrEqual(10)
      fingerprints.add(kinds(course))
    }
    expect(fingerprints.size).toBeGreaterThanOrEqual(8)
    const impossible = Array.from({ length: 100 }, () =>
      ring('gap', 'gap', 'gap', 'gap'),
    )
    expect(validateDailyCourse(impossible)).toMatchObject({
      ok: false,
      hasRoute: false,
    })
  })
})

describe('daily ranked results', () => {
  it('ignores practice deaths and locks a single ranked clear', () => {
    const storage = new MemoryStorage()
    const date = '2026-07-22'

    expect(recordDailyDeath(date, storage).deaths).toBe(0)
    expect(recordDailyClear(date, 40, storage).clears).toEqual([])

    commitDailyRanked(date, storage)
    recordDailyDeath(date, storage)
    recordDailyDeath(date, storage)
    const ranked = recordDailyClear(date, 39.25, storage)

    expect(ranked.deaths).toBe(2)
    expect(ranked.clears).toEqual([{ elapsed: 39.25 }])
    expect(dailyBest(ranked)).toEqual({ elapsed: 39.25, attempt: 1 })

    recordDailyDeath(date, storage)
    recordDailyClear(date, 30, storage)
    expect(loadDailyRecord(date, storage)).toEqual(ranked)
  })

  it('increments consecutive streaks and resets after a missed day', () => {
    const storage = new MemoryStorage()
    commitDailyRanked('2026-07-22', storage)
    expect(recordDailyClear('2026-07-22', 40, storage).streak).toBe(1)
    commitDailyRanked('2026-07-23', storage)
    expect(recordDailyClear('2026-07-23', 39, storage).streak).toBe(2)
    commitDailyRanked('2026-07-25', storage)
    expect(recordDailyClear('2026-07-25', 38, storage).streak).toBe(1)
  })

  it('clears a day for localhost testing', () => {
    const storage = new MemoryStorage()
    commitDailyRanked('2026-07-22', storage)
    recordDailyClear('2026-07-22', 40, storage)
    expect(clearDailyDay('2026-07-22', storage)).toMatchObject({
      rankedCommitted: false,
      clears: [],
      deaths: 0,
    })
  })

  it('ignores malformed persisted data', () => {
    const storage = new MemoryStorage()
    storage.setItem(DAILY_STORAGE_KEY, '{"version":2,"days":{"2026-07-22":{"bad":true}}}')
    expect(loadDailyRecord('2026-07-22', storage)).toMatchObject({
      rankedCommitted: false,
      clears: [],
      deaths: 0,
      streak: 0,
    })
  })

  it('formats the exact share result with time, deaths, and streak', () => {
    const storage = new MemoryStorage()
    const date = '2026-07-22'
    commitDailyRanked(date, storage)
    recordDailyDeath(date, storage)
    recordDailyDeath(date, storage)
    const record = recordDailyClear(date, 39.25, storage)

    expect(formatDailyShare(record, 'https://example.com/fwd')).toBe(
      [
        '🚀 Fwd Daily #1',
        '⏱ 00:39.250',
        '💥 2 deaths',
        '🔥 1 day streak',
        '',
        'https://example.com/fwd',
        '#Fwd',
      ].join('\n'),
    )
  })
})

describe('daily simulation integration', () => {
  it('keeps practice free until ranked commit, then records one clear', () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const world = createWorld('daily', 0, 'fast')

    expect(world.speedPreset).toBe('normal')
    startRun(world)
    for (let ringIndex = 0; ringIndex <= 2; ringIndex++) {
      world.rings[ringIndex]![0].kind = 'gap'
    }
    world.falling = true
    world.height = -2
    stepWorld(world, 0.01, { left: false, right: false, jump: false })
    expect(world.phase).toBe('failed')
    expect(world.dailyRecord.deaths).toBe(0)

    commitDailyRankedAttempt(world)
    resetRun(world, 'daily')
    startRun(world)
    for (let ringIndex = 0; ringIndex <= 2; ringIndex++) {
      world.rings[ringIndex]![0].kind = 'gap'
    }
    world.falling = true
    world.height = -2
    stepWorld(world, 0.01, { left: false, right: false, jump: false })
    expect(world.dailyRecord.deaths).toBe(1)

    resetRun(world, 'daily')
    world.z = world.rings.length * RING_DEPTH
    stepWorld(world, 0.001, { left: false, right: false, jump: false })
    expect(world.phase).toBe('cleared')
    expect(world.dailyRecord.clears).toHaveLength(1)

    clearDailyProgress(world)
    expect(world.dailyRecord.clears).toEqual([])
    expect(world.dailyRecord.rankedCommitted).toBe(false)
    expect(world.phase).toBe('idle')
  })
})

describe('landing forgiveness', () => {
  it('does not let the runner cross a one-ring gap without jumping', () => {
    const world = createWorld('explore')
    world.rings = [
      solidRing(),
      solidRing(),
      ring('gap', 'solid', 'solid', 'solid'),
      solidRing(),
      solidRing(),
    ]
    startRun(world)

    for (let frame = 0; frame < 90 && world.phase === 'racing'; frame++) {
      stepWorld(world, 1 / 60, { left: false, right: false, jump: false })
    }

    expect(world.phase).toBe('failed')
  })

  it('uses the visible runner footprint for an edge landing', () => {
    const world = createWorld('explore')
    world.rings = [
      solidRing(),
      solidRing(),
      ring('gap', 'solid', 'solid', 'solid'),
      ring('gap', 'solid', 'solid', 'solid'),
      solidRing(),
    ]
    startRun(world)
    world.z = RING_DEPTH * 2 + 0.11
    world.height = 0.06
    world.vHeight = -1
    world.falling = false

    stepWorld(world, 0.001, { left: false, right: false, jump: false })

    expect(world.falling).toBe(false)
    expect(world.height).toBe(0)
    expect(world.supportRing).toBe(1)
  })

  it('allows a shallow wall catch just after support is lost', () => {
    const world = createWorld('explore')
    startRun(world)
    world.rings = [
      solidRing(),
      ring('gap', 'solid', 'solid', 'solid'),
      solidRing(),
    ]
    world.lateral = 0.41
    world.height = -0.2
    world.vHeight = -2
    world.falling = true
    world.fallingT = 0.02
    world.wasGrounded = false

    stepWorld(world, 0.001, { left: true, right: false, jump: false })

    expect(world.face).toBe(1)
    expect(world.falling).toBe(false)
    expect(world.height).toBe(0)
  })

  it('does not allow a wall catch after the save window expires', () => {
    const world = createWorld('explore')
    startRun(world)
    world.rings = [
      solidRing(),
      ring('gap', 'solid', 'solid', 'solid'),
      solidRing(),
    ]
    world.lateral = 0.41
    world.height = -0.2
    world.vHeight = -2
    world.falling = true
    world.fallingT = 0.1
    world.wasGrounded = false

    stepWorld(world, 0.001, { left: true, right: false, jump: false })

    expect(world.face).toBe(0)
    expect(world.falling).toBe(true)
  })
})
