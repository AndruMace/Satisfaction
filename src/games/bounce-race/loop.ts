import { audioEngine } from './audio'
import { createCamera, updateCamera } from './camera'
import {
  cascadeBreakBricks,
  checkFinish,
  cloneBarriers,
  cloneBricks,
  createRacers,
  stepPhysics,
  updateParticles,
} from './physics'
import { renderFrame } from './render'
import {
  DEFAULT_RUN_SETTINGS,
  pickRaceHookLine,
  type RaceMetrics,
  type RunSettings,
  scoreRace,
} from './settings'
import {
  type GamePhase,
  type HealthBarrier,
  type ImpactFlash,
  type LevelData,
  type OverlayState,
  type Particle,
  type PlayerShape,
  type PressureWall,
  PLAYER_PROFILES,
  type Racer,
  type RacerId,
  RACER_SPEED,
  type Winner,
  PRESSURE_WALL_CHEVRON_ANGLE,
  PRESSURE_WALL_CHEVRON_DEPTH,
  PRESSURE_WALL_TIP_START_Y,
  chevronDepthFromAngle,
  pressureWallYForTip,
  pressureTipY,
  PRESSURE_WALL_HEIGHT,
  PRESSURE_WALL_SPEED,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onWinner?: (winner: Winner) => void
  onRaceMetrics?: (metrics: RaceMetrics) => void
  onReelProgress?: (current: number, total: number) => void
  onReelComplete?: (highlights: RaceMetrics[]) => void
  /** Fired after each canvas paint — used for timestamped WebCodecs capture. */
  onAfterDraw?: () => void
}

const FIXED_DT = 1 / 120
const MAX_FRAME_DT = 0.05
const DEFAULT_WALL_SPEED = PRESSURE_WALL_SPEED

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
  racers: Racer[] = []
  bricks: ReturnType<typeof cloneBricks> = []
  barriers: HealthBarrier[] = []
  particles: Particle[] = []
  flashes: ImpactFlash[] = []
  camera = createCamera()
  cameraPunch = 0
  randomizeBounces = false
  playerCount = 4
  playerShape: PlayerShape = 'ball'
  private barrierHealth = 25
  private wallSpeed = DEFAULT_WALL_SPEED
  private chevronAngle = PRESSURE_WALL_CHEVRON_ANGLE
  private crushMargin = 6
  settings: RunSettings = { ...DEFAULT_RUN_SETTINGS }
  pressureWall: PressureWall = {
    y: pressureWallYForTip(
      PRESSURE_WALL_TIP_START_Y,
      PRESSURE_WALL_HEIGHT,
      PRESSURE_WALL_CHEVRON_DEPTH,
    ),
    height: PRESSURE_WALL_HEIGHT,
    speed: DEFAULT_WALL_SPEED,
    chevronDepth: PRESSURE_WALL_CHEVRON_DEPTH,
  }

  private raceTime = 0
  private countdownTimer = 0
  private countdownStep = 3
  private timeScale = 1
  private slowMoTimer = 0
  private photoFinishTimer = 0
  private finalStretchActive = false
  private suddenDeathActive = false
  private gravityPulseAt = 0
  private speedSurgeAt = 0
  private gravityPulseDone = false
  private speedSurgeDone = false
  private comebackUsed = false
  private brickBreaks = 0
  private eliminations = 0
  private raceSeed = 0
  private underdogId: RacerId | null = null
  private overlay: OverlayState = this.createOverlay()

  private reelMode = false
  private reelTotal = 0
  private reelIndex = 0
  private reelResults: RaceMetrics[] = []
  private reelReplayQueue: RaceMetrics[] = []
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

  setBounceRandomization(enabled: boolean) {
    this.randomizeBounces = enabled
  }

  setSettings(settings: RunSettings) {
    this.settings = { ...settings }
  }

  setRaceConfig(playerCount: number, playerShape: PlayerShape) {
    const nextCount = Math.max(2, Math.min(6, playerCount))
    const changed =
      this.playerCount !== nextCount || this.playerShape !== playerShape
    this.playerCount = nextCount
    this.playerShape = playerShape
    if (changed && this.level && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setBarrierHealth(health: number) {
    const next = Math.max(1, Math.min(50, Math.round(health)))
    if (next === this.barrierHealth) return
    this.barrierHealth = next
    if (this.level && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setWallSpeed(speed: number) {
    const next = Math.max(10, Math.min(120, Math.round(speed)))
    if (next === this.wallSpeed) return
    this.wallSpeed = next
    if (this.level && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setChevronAngle(angle: number) {
    const next = Math.max(0, Math.min(40, Math.round(angle)))
    if (next === this.chevronAngle) return
    this.chevronAngle = next
    if (this.level) {
      const tipY = pressureTipY(this.pressureWall)
      const nextDepth = chevronDepthFromAngle(next, this.level.bounds.width)
      this.pressureWall.chevronDepth = nextDepth
      this.pressureWall.y = pressureWallYForTip(
        tipY,
        this.pressureWall.height,
        nextDepth,
      )
    }
    this.draw()
  }

  setCrushMargin(margin: number) {
    const next = Math.max(0, Math.min(16, Math.round(margin)))
    if (next === this.crushMargin) return
    this.crushMargin = next
  }

  reset() {
    if (!this.level) return
    this.phase = 'idle'
    this.winner = null
    this.racers = createRacers(this.level, this.playerCount, this.playerShape)
    this.bricks = cloneBricks(this.level.bricks)
    this.barriers = cloneBarriers(this.level.barriers, this.barrierHealth)
    this.particles = []
    this.flashes = []
    this.cameraPunch = 0
    this.raceTime = 0
    this.countdownTimer = 0
    this.countdownStep = 3
    this.timeScale = 1
    this.slowMoTimer = 0
    this.photoFinishTimer = 0
    this.finalStretchActive = false
    this.suddenDeathActive = false
    this.gravityPulseDone = false
    this.speedSurgeDone = false
    this.comebackUsed = false
    this.brickBreaks = 0
    this.eliminations = 0
    this.underdogId = this.pickUnderdog()
    this.gravityPulseAt = 4 + Math.random() * 5
    this.speedSurgeAt = 7 + Math.random() * 6
    const chevronDepth = chevronDepthFromAngle(
      this.chevronAngle,
      this.level.bounds.width,
    )
    this.pressureWall = {
      y: pressureWallYForTip(
        PRESSURE_WALL_TIP_START_Y,
        PRESSURE_WALL_HEIGHT,
        chevronDepth,
      ),
      height: PRESSURE_WALL_HEIGHT,
      speed: this.wallSpeed,
      chevronDepth,
    }
    this.overlay = this.createOverlay()
    audioEngine.resetRace()
    updateCamera(
      this.camera,
      this.racers.filter((racer) => racer.alive),
      this.level.bounds.width,
      this.level.bounds.height,
    )
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(null)
    this.draw()
  }

  launch() {
    if (!this.level) return
    if (this.phase === 'racing' || this.phase === 'countdown') return
    audioEngine.unlock()
    this.reset()
    this.overlay.hookLine = pickRaceHookLine()
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
      finalStretch: false,
      rivalryIds: [],
      nameTags: this.settings.nameTags,
      eventBanner: null,
      eventBannerLife: 0,
      hookLine: null,
      hookLineLife: 0,
      winMessage: null,
    }
  }

  private pickUnderdog(): RacerId | null {
    if (this.racers.length < 2) return null
    return this.racers[this.racers.length - 1]?.id ?? null
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
          this.finishRace(this.winner)
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
      if (this.level) {
        updateCamera(
          this.camera,
          this.aliveRacers(),
          this.level.bounds.width,
          this.level.bounds.height,
          this.cameraPunch,
          this.finalStretchActive,
        )
      }
      this.cameraPunch *= 0.88
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

  private aliveRacers() {
    return this.racers.filter((racer) => racer.alive)
  }

  private rivalryIds(): RacerId[] {
    if (!this.settings.rivalryMode) return []
    return [...this.aliveRacers()]
      .sort((a, b) => b.y - a.y)
      .slice(0, 2)
      .map((racer) => racer.id)
  }

  private simulate(dt: number) {
    if (!this.level) return

    this.raceTime += dt
    this.overlay.nameTags = this.settings.nameTags && this.raceTime < 4.5

    this.updateEscalation()
    this.overlay.rivalryIds = this.rivalryIds()
    this.overlay.finalStretch = this.finalStretchActive

    const progress = this.leaderProgress()
    audioEngine.setCrowdTension(progress)
    audioEngine.setFinalStretch(this.finalStretchActive)

    this.pressureWall.y = Math.min(
      this.level.finishY - this.pressureWall.height - this.pressureWall.chevronDepth,
      this.pressureWall.y + this.pressureWall.speed * dt,
    )

    const impacts = stepPhysics(
      this.racers,
      this.level.walls,
      this.bricks,
      this.barriers,
      this.level,
      this.pressureWall,
      this.randomizeBounces,
      dt,
      this.particles,
      { perfectBounce: this.settings.perfectBounce, crushMargin: this.crushMargin },
    )

    for (const impact of impacts) {
      if (impact.kind === 'brick' && this.settings.brickCascades) {
        const origin = this.bricks.find((brick) => brick.id === impact.brickId)
        if (origin) {
          const extra = cascadeBreakBricks(
            this.bricks,
            origin,
            this.particles,
            this.racers.find((r) => r.id === impact.racerId)?.color ?? '#fff',
          )
          impact.cascade = extra
          this.brickBreaks += 1 + extra
        } else {
          this.brickBreaks += 1
        }
      } else if (impact.kind === 'brick') {
        this.brickBreaks += 1
      }

      if (impact.kind === 'destroyed') {
        this.eliminations += 1
        const profile = PLAYER_PROFILES.find((p) => p.id === impact.racerId)
        this.overlay.eventBanner = `${profile?.label ?? 'Racer'} eliminated`
        this.overlay.eventBannerLife = 1.6
        if (this.settings.crushSlowMo) {
          this.timeScale = 0.28
          this.slowMoTimer = 0.55
        }
      }

      if (impact.kind === 'perfect') {
        this.cameraPunch = -10
      }

      if (impact.kind === 'barrier') {
        this.cameraPunch = Math.min(this.cameraPunch, -4)
        if (impact.barrierHealth === 0) {
          this.overlay.eventBanner = 'BARRIER BROKEN'
          this.overlay.eventBannerLife = 1
          this.cameraPunch = -12
        }
      }

      audioEngine.playImpact(impact)
      const racer = this.racers.find((candidate) => candidate.id === impact.racerId)
      this.flashes.push({
        x: impact.x,
        y: impact.y,
        life: impact.kind === 'perfect' ? 0.14 : 0.08,
        color: racer?.color ?? '#ffffff',
        radius:
          impact.kind === 'destroyed'
            ? 28
            : impact.kind === 'perfect'
              ? 22
              : impact.kind === 'brick'
                ? 18 + (impact.cascade ?? 0) * 3
                : impact.kind === 'barrier'
                  ? 16
                : impact.kind === 'racer'
                  ? 16
                  : 10,
      })
      if (
        impact.kind === 'brick' ||
        impact.kind === 'destroyed' ||
        impact.kind === 'perfect'
      ) {
        this.cameraPunch = Math.min(this.cameraPunch, -6)
      }
    }

    updateParticles(this.particles, dt)
    this.updateFlashes(dt)
    for (const barrier of this.barriers) {
      if (barrier.hitPulse > 0) {
        barrier.hitPulse = Math.max(0, barrier.hitPulse - dt * 5)
      }
    }
    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt

    updateCamera(
      this.camera,
      this.aliveRacers(),
      this.level.bounds.width,
      this.level.bounds.height,
      this.cameraPunch,
      this.finalStretchActive,
    )
    this.cameraPunch *= 0.88

    const finishWinner = checkFinish(this.racers, this.level.finishY)
    if (finishWinner) {
      this.handleFinish(finishWinner)
    } else {
      const alive = this.aliveRacers()
      if (alive.length === 1) {
        this.handleFinish(alive[0].id, { byElimination: true })
      } else if (alive.length === 0) {
        this.handleFinish(null)
      }
    }
  }

  private leaderProgress() {
    if (!this.level) return 0
    const leader = this.aliveRacers().sort((a, b) => b.y - a.y)[0]
    if (!leader) return 0
    return Math.max(0, Math.min(1, leader.y / this.level.finishY))
  }

  private updateEscalation() {
    if (!this.level) return
    const alive = this.aliveRacers()
    const progress = this.leaderProgress()

    if (
      this.settings.wallLateBoost &&
      progress >= 0.66 &&
      this.pressureWall.speed <= this.wallSpeed * 1.05
    ) {
      this.pressureWall.speed = this.wallSpeed * 2
      this.banner('WALL SURGE', 'stretch')
    }

    if (
      this.settings.finalStretch &&
      progress >= 0.8 &&
      !this.finalStretchActive
    ) {
      this.finalStretchActive = true
      this.banner('FINAL STRETCH', 'stretch')
    }

    if (
      this.settings.suddenDeath &&
      !this.suddenDeathActive &&
      alive.length >= 2
    ) {
      const sorted = [...alive].sort((a, b) => b.y - a.y)
      const lead = sorted[0].y - sorted[1].y
      if (lead > 420 && progress > 0.45) {
        this.suddenDeathActive = true
        for (const racer of sorted.slice(1)) {
          const boost = RACER_SPEED * 0.35
          const len = Math.hypot(racer.vx, racer.vy) || 1
          racer.vx = (racer.vx / len) * (RACER_SPEED + boost * 0.25)
          racer.vy = Math.abs(racer.vy / len) * (RACER_SPEED + boost)
        }
        this.pressureWall.speed = Math.max(this.pressureWall.speed, this.wallSpeed * 1.6)
        this.banner('SUDDEN DEATH', 'sudden')
      }
    }

    if (
      this.settings.gravityPulse &&
      !this.gravityPulseDone &&
      this.raceTime >= this.gravityPulseAt
    ) {
      this.gravityPulseDone = true
      for (const racer of alive) {
        racer.vy = Math.max(racer.vy, 0) + RACER_SPEED * 0.55
        const speed = Math.hypot(racer.vx, racer.vy)
        if (speed > RACER_SPEED * 1.4) {
          racer.vx = (racer.vx / speed) * RACER_SPEED * 1.4
          racer.vy = (racer.vy / speed) * RACER_SPEED * 1.4
        }
      }
      this.banner('GRAVITY PULSE', 'pulse')
    }

    if (
      this.settings.speedSurge &&
      !this.speedSurgeDone &&
      this.raceTime >= this.speedSurgeAt
    ) {
      this.speedSurgeDone = true
      for (const racer of alive) {
        const speed = Math.hypot(racer.vx, racer.vy) || 1
        racer.vx = (racer.vx / speed) * RACER_SPEED * 1.35
        racer.vy = (racer.vy / speed) * RACER_SPEED * 1.35
      }
      this.banner('SPEED SURGE', 'boost')
    }

    if (this.settings.comebackBait && !this.comebackUsed && alive.length >= 2) {
      const sorted = [...alive].sort((a, b) => b.y - a.y)
      const leader = sorted[0]
      const trailer = sorted[sorted.length - 1]
      if (leader.y - trailer.y > 380 && progress > 0.35 && progress < 0.85) {
        this.comebackUsed = true
        const dx = leader.x - trailer.x
        const dy = Math.max(120, leader.y - trailer.y)
        const len = Math.hypot(dx, dy) || 1
        trailer.vx = (dx / len) * RACER_SPEED * 1.25
        trailer.vy = (dy / len) * RACER_SPEED * 1.25
        this.banner('COMEBACK', 'comeback')
      }
    }
  }

  private banner(
    text: string,
    stinger: 'boost' | 'pulse' | 'sudden' | 'stretch' | 'comeback',
  ) {
    this.overlay.eventBanner = text
    this.overlay.eventBannerLife = 1.4
    audioEngine.playEventStinger(stinger)
  }

  private handleFinish(winner: Winner, options?: { byElimination?: boolean }) {
    this.winner = winner
    if (options?.byElimination && winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} wins by elimination`
      this.finishRace(winner, { byElimination: true })
      return
    }

    this.overlay.winMessage = null
    const alive = this.aliveRacers()
    const margin =
      alive.length >= 2
        ? Math.abs(
            [...alive].sort((a, b) => b.y - a.y)[0].y -
              [...alive].sort((a, b) => b.y - a.y)[1].y,
          )
        : 0

    if (winner && this.settings.photoFinish && margin < 55) {
      this.photoFinishTimer = 1.1
      this.overlay.photoFinish = this.photoFinishTimer
      this.timeScale = 0.2
      return
    }

    this.finishRace(winner)
  }

  private finishRace(winner: Winner, options?: { byElimination?: boolean }) {
    this.phase = 'finished'
    this.winner = winner
    this.timeScale = 1
    const alive = this.aliveRacers()
    const sorted = [...alive].sort((a, b) => b.y - a.y)
    const margin =
      sorted.length >= 2 ? Math.abs(sorted[0].y - sorted[1].y) : 120
    const upset = !!winner && this.underdogId === winner

    if (winner) {
      audioEngine.playFinish(winner, {
        upset,
        byElimination: options?.byElimination,
      })
    }
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(winner)

    const metrics: RaceMetrics = {
      brickBreaks: this.brickBreaks,
      eliminations: this.eliminations,
      finishMargin: margin,
      upset,
      seed: this.raceSeed,
      winner: winner
        ? PLAYER_PROFILES.find((p) => p.id === winner)?.label ?? winner
        : null,
    }
    this.callbacks.onRaceMetrics?.(metrics)

    if (this.reelMode) this.advanceReel(metrics)
  }

  private advanceReel(metrics: RaceMetrics) {
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
      .sort((a, b) => scoreRace(b) - scoreRace(a))
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
    if (!this.level) return
    this.syncCanvasResolution()
    renderFrame(
      this.ctx,
      this.camera,
      this.level,
      this.level.walls,
      this.bricks,
      this.barriers,
      this.racers,
      this.particles,
      this.flashes,
      this.winner,
      this.pressureWall,
      this.overlay,
    )
    this.callbacks.onAfterDraw?.()
  }
}
