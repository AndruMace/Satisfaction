import { audioEngine } from './audio'
import {
  cloneSpikes,
  createBubbles,
  rivalryIds,
  settingsToPhysics,
  stepPhysics,
  updateBursts,
  updateHazards,
  updateParticles,
} from './physics'
import { renderFrame } from './render'
import {
  DEFAULT_RUN_SETTINGS,
  pickBubbleHookLine,
  type BubbleMetrics,
  type RunSettings,
  scoreMatch,
} from './settings'
import {
  type Bubble,
  type GamePhase,
  type LevelData,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  type PopBurst,
  type Spike,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onWinner?: (winner: Winner) => void
  onMatchMetrics?: (metrics: BubbleMetrics) => void
  onReelProgress?: (current: number, total: number) => void
  onReelComplete?: (highlights: BubbleMetrics[]) => void
  onAfterDraw?: () => void
}

const FIXED_DT = 1 / 120
const MAX_FRAME_DT = 0.05

export class GameLoop {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private callbacks: GameLoopCallbacks

  level: LevelData | null = null
  phase: GamePhase = 'idle'
  winner: Winner = null
  bubbles: Bubble[] = []
  spikes: Spike[] = []
  particles: Particle[] = []
  bursts: PopBurst[] = []
  playerCount = 4
  growthRate = 6.5
  hazardDensity = 0.55
  settings: RunSettings = { ...DEFAULT_RUN_SETTINGS }

  private matchTime = 0
  private countdownTimer = 0
  private countdownStep = 3
  private timeScale = 1
  private slowMoTimer = 0
  private photoFinishTimer = 0
  private pops = 0
  private shoves = 0
  private matchSeed = 0
  private underdogId: Bubble['id'] | null = null
  private growthSurgeActive = false
  private growthSurgeDone = false
  private growthSurgeEndsAt = 0
  private hazardDescendActive = false
  private duelBannerDone = false
  private mergeWarnDone = false
  private overlay: OverlayState = this.createOverlay()
  /** Radii of the last two alive, for photo-finish margin. */
  private lastDuelRadii: [number, number] | null = null

  private reelMode = false
  private reelTotal = 0
  private reelIndex = 0
  private reelResults: BubbleMetrics[] = []
  private reelReplayQueue: BubbleMetrics[] = []
  private reelReplaying = false

  constructor(canvas: HTMLCanvasElement, callbacks: GameLoopCallbacks = {}) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D unavailable')
    this.ctx = ctx
    this.callbacks = callbacks
    this.syncCanvasResolution()
  }

  syncCanvasResolution() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
    const width = Math.round(VIEW_WIDTH * dpr)
    const height = Math.round(VIEW_HEIGHT * dpr)
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  loadLevel(level: LevelData) {
    this.level = level
    this.reset()
  }

  setSettings(settings: RunSettings) {
    this.settings = { ...settings }
  }

  setPlayerCount(playerCount: number) {
    const next = Math.max(2, Math.min(6, playerCount))
    if (next === this.playerCount) return
    this.playerCount = next
    if (this.level && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setGrowthRate(rate: number) {
    this.growthRate = Math.max(2, Math.min(16, rate))
  }

  setHazardDensity(density: number) {
    this.hazardDensity = Math.max(0.1, Math.min(1, density))
  }

  reset() {
    if (!this.level) return
    this.phase = 'idle'
    this.winner = null
    this.bubbles = createBubbles(this.level, this.playerCount)
    this.spikes = cloneSpikes(this.level.spikes)
    this.particles = []
    this.bursts = []
    this.matchTime = 0
    this.countdownTimer = 0
    this.countdownStep = 3
    this.timeScale = 1
    this.slowMoTimer = 0
    this.photoFinishTimer = 0
    this.pops = 0
    this.shoves = 0
    this.matchSeed = (Math.random() * 0xffffffff) >>> 0
    this.underdogId = this.bubbles.length
      ? this.bubbles[this.bubbles.length - 1].id
      : null
    this.growthSurgeActive = false
    this.growthSurgeDone = false
    this.growthSurgeEndsAt = 0
    this.hazardDescendActive = false
    this.duelBannerDone = false
    this.mergeWarnDone = false
    this.lastDuelRadii = null
    this.overlay = this.createOverlay()
    audioEngine.resetMatch()
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(null)
    this.draw()
  }

  launch() {
    if (!this.level) return
    if (this.phase === 'racing' || this.phase === 'countdown') return
    audioEngine.unlock()
    this.reset()
    this.overlay.hookLine = pickBubbleHookLine()
    this.overlay.hookLineLife = this.settings.countdown ? 99 : 2
    if (this.settings.countdown) {
      this.phase = 'countdown'
      this.countdownTimer = 0
      this.countdownStep = 3
      this.overlay.countdownValue = 3
      audioEngine.playCountdownBeep(3)
      this.callbacks.onPhaseChange?.(this.phase)
    } else {
      this.beginRacing()
    }
    if (!this.rafId) {
      this.lastTime = performance.now()
      this.accumulator = 0
      this.tick(this.lastTime)
    }
  }

  startBestOfReel(runs = 8) {
    if (!this.level || this.phase === 'racing' || this.phase === 'countdown') return
    audioEngine.unlock()
    this.reelMode = true
    this.reelReplaying = false
    this.reelTotal = runs
    this.reelIndex = 0
    this.reelResults = []
    this.reelReplayQueue = []
    this.callbacks.onReelProgress?.(0, runs)
    this.launch()
  }

  start() {
    if (!this.rafId) {
      this.lastTime = performance.now()
      this.tick(this.lastTime)
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  destroy() {
    this.stop()
  }

  private createOverlay(): OverlayState {
    return {
      countdownValue: null,
      launchFlash: 0,
      slowMo: 0,
      photoFinish: 0,
      rivalryIds: [],
      nameTags: this.settings.nameTags,
      eventBanner: null,
      eventBannerLife: 0,
      hookLine: null,
      hookLineLife: 0,
      winMessage: null,
      growthSurge: false,
    }
  }

  private beginRacing() {
    this.phase = 'racing'
    this.overlay.countdownValue = null
    if (this.overlay.hookLine) this.overlay.hookLineLife = 2
    if (this.settings.launchFlash) this.overlay.launchFlash = 0.35
    if (this.settings.nameTags) this.overlay.nameTags = true
    this.callbacks.onPhaseChange?.(this.phase)
  }

  private tick = (now: number) => {
    this.rafId = requestAnimationFrame(this.tick)
    const frameDt = Math.min(MAX_FRAME_DT, (now - this.lastTime) / 1000)
    this.lastTime = now

    if (this.phase === 'countdown') {
      this.updateCountdown(frameDt)
    } else if (this.phase === 'racing' && this.level) {
      if (this.slowMoTimer > 0) {
        this.slowMoTimer -= frameDt
        this.overlay.slowMo = this.slowMoTimer
        if (this.slowMoTimer <= 0) {
          this.timeScale = 1
          this.overlay.slowMo = 0
        }
      }
      if (this.photoFinishTimer > 0) {
        this.photoFinishTimer -= frameDt
        this.overlay.photoFinish = this.photoFinishTimer
        if (this.photoFinishTimer <= 0) {
          this.overlay.photoFinish = 0
          this.timeScale = 1
          this.finishMatch(this.winner)
        }
      } else {
        const scaled = frameDt * this.timeScale
        this.accumulator += scaled
        while (this.accumulator >= FIXED_DT) {
          this.simulate(FIXED_DT)
          this.accumulator -= FIXED_DT
        }
      }
    } else {
      this.updatePresentation(frameDt)
      updateParticles(this.particles, frameDt)
      updateBursts(this.bursts, frameDt)
    }

    this.draw()
  }

  private updateCountdown(dt: number) {
    this.countdownTimer += dt
    if (this.countdownTimer >= 0.85) {
      this.countdownTimer = 0
      this.countdownStep -= 1
      if (this.countdownStep <= 0) {
        this.overlay.countdownValue = 0
        audioEngine.playCountdownBeep(0)
        this.beginRacing()
      } else {
        this.overlay.countdownValue = this.countdownStep
        audioEngine.playCountdownBeep(this.countdownStep)
      }
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt
    this.tickHookLine(dt)
  }

  private updatePresentation(dt: number) {
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt
    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    this.tickHookLine(dt)
  }

  private tickHookLine(dt: number) {
    if (this.overlay.hookLineLife <= 0) return
    this.overlay.hookLineLife -= dt
    if (this.overlay.hookLineLife <= 0) this.overlay.hookLine = null
  }

  private aliveBubbles() {
    return this.bubbles.filter((b) => b.alive)
  }

  private simulate(dt: number) {
    if (!this.level) return

    this.matchTime += dt
    this.overlay.nameTags = this.settings.nameTags && this.matchTime < 4.5
    this.updateEscalation()
    this.overlay.rivalryIds = rivalryIds(this.bubbles, this.settings.rivalryMode)
    this.overlay.growthSurge = this.growthSurgeActive

    const descendSpeed =
      this.hazardDescendActive && this.settings.hazardDescend
        ? 22 + this.hazardDensity * 32
        : 0
    updateHazards(this.spikes, dt, descendSpeed)

    const growthMult = this.growthSurgeActive ? 2.1 : 1
    const events = stepPhysics(
      this.bubbles,
      this.level.walls,
      this.spikes,
      this.level,
      dt,
      this.particles,
      this.bursts,
      settingsToPhysics(this.settings, this.growthRate, growthMult),
    )

    const seenShove = new Set<string>()
    let shoveAudioBudget = 2
    for (const event of events) {
      if (event.kind === 'shove') {
        const key = [event.bubbleId, event.otherId].sort().join(':')
        if (seenShove.has(key)) continue
        seenShove.add(key)
        this.shoves += 1
        if (shoveAudioBudget > 0 && event.intensity > 0.35) {
          shoveAudioBudget -= 1
          audioEngine.playImpact(event)
        }
        continue
      }

      if (
        event.kind === 'spike' ||
        event.kind === 'overinflate' ||
        event.kind === 'crush' ||
        event.kind === 'merge'
      ) {
        this.pops += 1
        const profile = PLAYER_PROFILES.find((p) => p.id === event.bubbleId)
        const verb =
          event.kind === 'merge'
            ? 'merged away'
            : event.kind === 'overinflate'
              ? 'burst'
              : 'popped'
        this.overlay.eventBanner = `${profile?.label ?? 'Bubble'} ${verb}`
        this.overlay.eventBannerLife = 1.55
        if (this.settings.popSlowMo) {
          this.timeScale = 0.28
          this.slowMoTimer = 0.5
        }
        audioEngine.playImpact(event)
        continue
      }

      audioEngine.playImpact(event)
    }

    updateParticles(this.particles, dt)
    updateBursts(this.bursts, dt)

    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt

    const alive = this.aliveBubbles()
    if (alive.length === 2) {
      this.lastDuelRadii = [alive[0].radius, alive[1].radius]
      if (!this.duelBannerDone) {
        this.duelBannerDone = true
        this.banner('FINAL DUEL', 'duel')
      }
    }
    if (alive.length === 1) {
      this.handleFinish(alive[0].id)
    } else if (alive.length === 0) {
      this.handleFinish(null)
    }
  }

  private updateEscalation() {
    if (!this.level) return

    if (this.growthSurgeActive && this.matchTime >= this.growthSurgeEndsAt) {
      this.growthSurgeActive = false
      this.overlay.growthSurge = false
    }

    if (
      this.settings.growthSurge &&
      !this.growthSurgeDone &&
      this.matchTime >= 6.2
    ) {
      this.growthSurgeDone = true
      this.growthSurgeActive = true
      this.growthSurgeEndsAt = this.matchTime + 3.2
      this.banner('GROWTH SURGE', 'surge')
    }

    if (
      this.settings.hazardDescend &&
      !this.hazardDescendActive &&
      this.matchTime >= 5.0
    ) {
      this.hazardDescendActive = true
      this.banner('SPIKES DESCEND', 'hazards')
    }

    if (this.settings.mergeTemptation && !this.mergeWarnDone && this.matchTime >= 8) {
      this.mergeWarnDone = true
      this.banner('MERGE RISK', 'temptation')
    }
  }

  private banner(text: string, stinger: 'surge' | 'hazards' | 'duel' | 'temptation') {
    this.overlay.eventBanner = text
    this.overlay.eventBannerLife = 1.35
    audioEngine.playEventStinger(stinger)
  }

  private handleFinish(winner: Winner) {
    if (this.phase === 'finished' || this.photoFinishTimer > 0) return
    this.winner = winner
    if (winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Bubble'} is the last bubble standing`
    } else {
      this.overlay.winMessage = 'Everyone popped'
    }

    const duelMargin = this.lastDuelRadii
      ? Math.abs(this.lastDuelRadii[0] - this.lastDuelRadii[1])
      : 99

    if (winner && this.settings.photoFinish && this.pops >= 1 && duelMargin < 14) {
      const lastPopRecent = this.overlay.eventBannerLife > 0
      if (lastPopRecent) {
        this.photoFinishTimer = 1.05
        this.overlay.photoFinish = this.photoFinishTimer
        this.timeScale = 0.22
        return
      }
    }

    this.finishMatch(winner)
  }

  private finishMatch(winner: Winner) {
    this.phase = 'finished'
    this.winner = winner
    this.timeScale = 1
    const upset = !!winner && this.underdogId === winner
    const alive = this.aliveBubbles()
    const margin =
      alive.length === 1 ? alive[0].radius : alive.length >= 2 ? Math.abs(alive[0].radius - alive[1].radius) : 0

    if (winner) {
      audioEngine.playFinish(winner, { upset })
    }
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(winner)

    const metrics: BubbleMetrics = {
      pops: this.pops,
      shoves: this.shoves,
      finishMargin: margin,
      upset,
      seed: this.matchSeed,
      winner: winner
        ? PLAYER_PROFILES.find((p) => p.id === winner)?.label ?? winner
        : null,
    }
    this.callbacks.onMatchMetrics?.(metrics)

    if (this.reelMode) this.advanceReel(metrics)
  }

  private advanceReel(metrics: BubbleMetrics) {
    if (this.reelReplaying) {
      this.reelReplayQueue.shift()
      if (this.reelReplayQueue.length > 0) {
        this.callbacks.onReelProgress?.(3 - this.reelReplayQueue.length, 3)
        window.setTimeout(() => this.launch(), 700)
      } else {
        this.reelMode = false
        this.reelReplaying = false
        this.callbacks.onReelComplete?.(this.reelResults)
      }
      return
    }

    this.reelResults.push(metrics)
    this.reelIndex += 1
    this.callbacks.onReelProgress?.(this.reelIndex, this.reelTotal)

    if (this.reelIndex < this.reelTotal) {
      window.setTimeout(() => this.launch(), 450)
      return
    }

    const highlights = [...this.reelResults]
      .sort((a, b) => scoreMatch(b) - scoreMatch(a))
      .slice(0, 3)
    this.reelResults = highlights
    this.reelReplayQueue = [...highlights]
    this.reelReplaying = true
    this.callbacks.onReelComplete?.(highlights)
    window.setTimeout(() => this.launch(), 900)
  }

  private draw() {
    if (!this.level) return
    this.syncCanvasResolution()
    renderFrame(
      this.ctx,
      this.level,
      this.level.walls,
      this.spikes,
      this.bubbles,
      this.particles,
      this.bursts,
      this.winner,
      this.overlay,
    )
    this.callbacks.onAfterDraw?.()
  }
}
