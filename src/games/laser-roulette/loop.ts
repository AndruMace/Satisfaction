import { PLAYER_PROFILES } from '../../shared/profiles'
import { audioEngine } from './audio'
import {
  createBeams,
  createDodgers,
  detectHits,
  narrowBeams,
  resolveRacerCollisions,
  reverseBeams,
  shrinkHub,
  spawnExtraBeam,
  spikeBeamSpeed,
  stepAi,
  stepBeams,
  updateParticles,
} from './physics'
import { renderFrame } from './render'
import {
  DEFAULT_RUN_SETTINGS,
  type MatchMetrics,
  pickLaserHookLine,
  type RunSettings,
  scoreMatch,
} from './settings'
import {
  type CourseData,
  type Dodger,
  type DodgerId,
  type GamePhase,
  type ImpactFlash,
  type LaserBeam,
  type OverlayState,
  type Particle,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onWinner?: (winner: Winner) => void
  onMatchMetrics?: (metrics: MatchMetrics) => void
  onReelProgress?: (current: number, total: number) => void
  onReelComplete?: (highlights: MatchMetrics[]) => void
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

  course: CourseData | null = null
  phase: GamePhase = 'idle'
  winner: Winner = null
  dodgers: Dodger[] = []
  beams: LaserBeam[] = []
  particles: Particle[] = []
  flashes: ImpactFlash[] = []

  playerCount = 4
  beamCount = 0
  beamSpeedScale = 1
  aiAggression = 0.7
  settings: RunSettings = { ...DEFAULT_RUN_SETTINGS }

  private matchTime = 0
  private countdownTimer = 0
  private countdownStep = 3
  private timeScale = 1
  private slowMoTimer = 0
  private photoFinishTimer = 0
  private eliminations = 0
  private nearMisses = 0
  private matchSeed = 0
  private underdogId: DodgerId | null = null
  private overlay: OverlayState = this.createOverlay()

  private speedSpikeDone = false
  private extraBeamDone = false
  private narrowDone = false
  private hubShrinkDone = false
  private reverseDone = false
  private finalTwoBanner = false
  private surviveRemaining = 0

  private reelMode = false
  private reelTotal = 0
  private reelIndex = 0
  private reelResults: MatchMetrics[] = []
  private reelReplayQueue: MatchMetrics[] = []
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

  loadCourse(course: CourseData) {
    this.course = course
    this.reset()
  }

  setSettings(settings: RunSettings) {
    this.settings = { ...settings }
    audioEngine.setHumEnabled(settings.humBed)
  }

  setPlayerCount(count: number) {
    const next = Math.max(2, Math.min(6, count))
    if (next === this.playerCount) return
    this.playerCount = next
    if (this.course && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setBeamCount(count: number) {
    // 0 = follow course preset beam count
    const next = count <= 0 ? 0 : Math.max(1, Math.min(6, Math.round(count)))
    if (next === this.beamCount) return
    this.beamCount = next
    if (this.course && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setBeamSpeed(scale: number) {
    this.beamSpeedScale = Math.max(0.4, Math.min(2.2, scale))
  }

  setAiAggression(value: number) {
    this.aiAggression = Math.max(0.2, Math.min(1.5, value))
  }

  reset() {
    if (!this.course) return
    this.phase = 'idle'
    this.winner = null
    const count = this.beamCount > 0 ? this.beamCount : this.course.beams.length
    this.beams = createBeams(this.course, count)
    this.dodgers = createDodgers(this.playerCount, this.aiAggression, this.beams)
    this.particles = []
    this.flashes = []
    this.matchTime = 0
    this.countdownTimer = 0
    this.countdownStep = 3
    this.timeScale = 1
    this.slowMoTimer = 0
    this.photoFinishTimer = 0
    this.eliminations = 0
    this.nearMisses = 0
    this.matchSeed = (Math.random() * 0xffffffff) >>> 0
    this.underdogId = this.dodgers[this.dodgers.length - 1]?.id ?? null
    this.speedSpikeDone = false
    this.extraBeamDone = false
    this.narrowDone = false
    this.hubShrinkDone = false
    this.reverseDone = false
    this.finalTwoBanner = false
    this.surviveRemaining = this.course.surviveSeconds
    this.overlay = this.createOverlay()
    audioEngine.resetMatch()
    audioEngine.setHumEnabled(this.settings.humBed)
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(null)
    this.draw()
  }

  launch() {
    if (!this.course) return
    if (this.phase === 'racing' || this.phase === 'countdown') return
    audioEngine.unlock()
    this.reset()
    this.overlay.hookLine = pickLaserHookLine()
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
    if (!this.course || this.phase === 'racing' || this.phase === 'countdown') return
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
    audioEngine.resetMatch()
  }

  private createOverlay(): OverlayState {
    return {
      countdownValue: null,
      launchFlash: 0,
      slowMo: 0,
      photoFinish: 0,
      nameTags: this.settings.nameTags,
      eventBanner: null,
      eventBannerLife: 0,
      hookLine: null,
      hookLineLife: 0,
      winMessage: null,
      tension: 0,
      surviveTimer: null,
    }
  }

  private beginRacing() {
    this.phase = 'racing'
    this.overlay.countdownValue = null
    if (this.overlay.hookLine) this.overlay.hookLineLife = 2
    if (this.settings.launchFlash) this.overlay.launchFlash = 0.35
    if (this.settings.nameTags) this.overlay.nameTags = true
    if (this.settings.surviveTimer) {
      this.overlay.surviveTimer = this.surviveRemaining
    }
    if (this.settings.humBed) audioEngine.setHumEnabled(true)
    this.callbacks.onPhaseChange?.(this.phase)
  }

  private tick = (now: number) => {
    this.rafId = requestAnimationFrame(this.tick)
    const frameDt = Math.min(MAX_FRAME_DT, (now - this.lastTime) / 1000)
    this.lastTime = now

    if (this.phase === 'countdown') {
      this.updateCountdown(frameDt)
    } else if (this.phase === 'racing' && this.course) {
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
    this.updateFlashes(dt)
  }

  private tickHookLine(dt: number) {
    if (this.overlay.hookLineLife <= 0) return
    this.overlay.hookLineLife -= dt
    if (this.overlay.hookLineLife <= 0) this.overlay.hookLine = null
  }

  private aliveDodgers() {
    return this.dodgers.filter((d) => d.alive)
  }

  private rivalryIds(): DodgerId[] {
    if (!this.settings.rivalryGlow) return []
    const alive = this.aliveDodgers()
    if (alive.length !== 2) return []
    return alive.map((d) => d.id)
  }

  private simulate(dt: number) {
    if (!this.course) return

    this.matchTime += dt
    this.overlay.nameTags = this.settings.nameTags && this.matchTime < 4.5

    const alive = this.aliveDodgers()
    const pressure = Math.min(
      1,
      this.matchTime / 18 + (this.beams.length - 1) * 0.12 + (1 - alive.length / this.playerCount) * 0.35,
    )
    this.overlay.tension = pressure
    audioEngine.setTension(pressure)

    this.updateEscalation(pressure)

    stepBeams(this.beams, dt, this.beamSpeedScale)

    for (const dodger of this.dodgers) {
      stepAi(
        dodger,
        this.beams,
        dt,
        this.aiAggression,
        this.course.mistakeBias,
        pressure,
        this.beamSpeedScale,
        this.dodgers,
      )
    }

    resolveRacerCollisions(this.dodgers)

    const events = detectHits(this.dodgers, this.beams, dt, this.particles)
    for (const event of events) {
      if (event.kind === 'zap') {
        audioEngine.playZap(event.dodgerId)
        this.flashes.push({
          x: event.x,
          y: event.y,
          life: 0.18,
          color: '#ffffff',
          radius: 36,
        })
      }
      if (event.kind === 'nearMiss') {
        this.nearMisses += 1
        audioEngine.playNearMiss(event.dodgerId)
        if (this.settings.nearMissFlash) {
          this.flashes.push({
            x: event.x,
            y: event.y,
            life: 0.1,
            color: '#ffe066',
            radius: 22,
          })
        }
      }
      if (event.kind === 'elim') {
        this.eliminations += 1
        const profile = PLAYER_PROFILES.find((p) => p.id === event.dodgerId)
        this.overlay.eventBanner = `${profile?.label ?? 'Player'} eliminated`
        this.overlay.eventBannerLife = 1.6
        audioEngine.playElimination(event.dodgerId)
        this.flashes.push({
          x: event.x,
          y: event.y,
          life: 0.22,
          color: profile?.color ?? '#fff',
          radius: 42,
        })
        if (this.settings.elimSlowMo) {
          this.timeScale = 0.28
          this.slowMoTimer = 0.5
        }
      }
    }

    updateParticles(this.particles, dt)
    this.updateFlashes(dt)

    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt

    const stillAlive = this.aliveDodgers()

    if (stillAlive.length === 2 && !this.finalTwoBanner && this.settings.photoFinish) {
      this.finalTwoBanner = true
      this.banner('FINAL TWO', 'final')
    }

    if (this.settings.surviveTimer) {
      this.surviveRemaining -= dt
      this.overlay.surviveTimer = this.surviveRemaining
      if (this.surviveRemaining <= 0) {
        this.handleSurviveEnd(stillAlive)
        return
      }
    } else {
      this.overlay.surviveTimer = null
    }

    if (stillAlive.length === 1) {
      this.handleFinish(stillAlive[0].id, { byElimination: true })
    } else if (stillAlive.length === 0) {
      this.handleFinish(null)
    }
  }

  private updateEscalation(pressure: number) {
    if (!this.course) return
    const t = this.matchTime
    const escalateAt = this.course.escalateAt

    if (this.settings.speedSpike && !this.speedSpikeDone && t >= escalateAt) {
      this.speedSpikeDone = true
      spikeBeamSpeed(this.beams, 1.45)
      this.banner('SPEED SPIKE', 'spike')
    }

    if (
      this.settings.extraBeam &&
      !this.extraBeamDone &&
      t >= escalateAt + 3.2
    ) {
      this.extraBeamDone = true
      if (spawnExtraBeam(this.beams)) this.banner('EXTRA BEAM', 'extra')
    }

    if (
      this.settings.narrowWedges &&
      !this.narrowDone &&
      t >= escalateAt + 5.5
    ) {
      this.narrowDone = true
      narrowBeams(this.beams, 0.78)
      this.banner('NARROW WEDGES', 'narrow')
    }

    if (!this.hubShrinkDone && t >= escalateAt + 4.2) {
      this.hubShrinkDone = true
      shrinkHub(this.beams, 0.78)
      this.banner('HUB CLOSING', 'narrow')
    }

    if (
      this.settings.suddenReverse &&
      !this.reverseDone &&
      (t >= escalateAt + 7.5 || pressure > 0.82)
    ) {
      this.reverseDone = true
      reverseBeams(this.beams)
      this.banner('REVERSE', 'reverse')
    }
  }

  private banner(
    text: string,
    stinger: 'spike' | 'extra' | 'narrow' | 'reverse' | 'final',
  ) {
    this.overlay.eventBanner = text
    this.overlay.eventBannerLife = 1.35
    audioEngine.playEventStinger(stinger)
  }

  private handleSurviveEnd(alive: Dodger[]) {
    if (alive.length === 0) {
      this.handleFinish(null)
      return
    }
    if (alive.length === 1) {
      const profile = PLAYER_PROFILES.find((p) => p.id === alive[0].id)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} survives`
      this.finishMatch(alive[0].id, { survive: true })
      return
    }
    // Multiple survivors — pick by least near-miss exposure / random among alive
    const pick = alive[Math.floor(Math.random() * alive.length)]
    const profile = PLAYER_PROFILES.find((p) => p.id === pick.id)
    this.overlay.winMessage = `${profile?.label ?? 'Player'} outlasts the clock`
    if (this.settings.photoFinish && alive.length === 2) {
      this.winner = pick.id
      this.photoFinishTimer = 1.1
      this.overlay.photoFinish = this.photoFinishTimer
      this.timeScale = 0.22
      return
    }
    this.finishMatch(pick.id, { survive: true })
  }

  private handleFinish(winner: Winner, options?: { byElimination?: boolean }) {
    this.winner = winner
    if (options?.byElimination && winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} last standing`
      this.finishMatch(winner, { byElimination: true })
      return
    }

    this.overlay.winMessage = null
    const alive = this.aliveDodgers()
    if (winner && this.settings.photoFinish && alive.length === 2) {
      this.photoFinishTimer = 1.05
      this.overlay.photoFinish = this.photoFinishTimer
      this.timeScale = 0.22
      return
    }

    this.finishMatch(winner)
  }

  private finishMatch(
    winner: Winner,
    options?: { byElimination?: boolean; survive?: boolean },
  ) {
    this.phase = 'finished'
    this.winner = winner
    this.timeScale = 1
    this.overlay.surviveTimer = this.settings.surviveTimer ? 0 : null
    const upset = !!winner && this.underdogId === winner
    const alive = this.aliveDodgers()
    const finishMargin = alive.length >= 2 ? 0.4 : alive.length === 1 ? 1.2 : 0

    if (winner) {
      audioEngine.playFinish(winner, {
        upset,
        byElimination: options?.byElimination,
        survive: options?.survive,
      })
    }
    audioEngine.setHumEnabled(false)

    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(winner)

    const metrics: MatchMetrics = {
      eliminations: this.eliminations,
      nearMisses: this.nearMisses,
      duration: this.matchTime,
      finishMargin,
      upset,
      seed: this.matchSeed,
      winner: winner
        ? PLAYER_PROFILES.find((p) => p.id === winner)?.label ?? winner
        : null,
    }
    this.callbacks.onMatchMetrics?.(metrics)

    if (this.reelMode) this.advanceReel(metrics)
  }

  private advanceReel(metrics: MatchMetrics) {
    if (this.reelReplaying) {
      this.reelReplayQueue.shift()
      if (this.reelReplayQueue.length > 0) {
        this.callbacks.onReelProgress?.(
          3 - this.reelReplayQueue.length,
          3,
        )
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

  private updateFlashes(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1)
    }
  }

  private draw() {
    if (!this.course) return
    this.syncCanvasResolution()
    renderFrame(
      this.ctx,
      this.beams,
      this.dodgers,
      this.particles,
      this.flashes,
      this.winner,
      this.overlay,
      this.rivalryIds(),
    )
    this.callbacks.onAfterDraw?.()
  }
}
