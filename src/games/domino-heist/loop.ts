import { audioEngine } from './audio'
import { createCamera, updateCamera } from './camera'
import {
  checkVaultWinner,
  createBlockers,
  createChains,
  kickstartChains,
  leadingProgress,
  stepPhysics,
  tipFrontMargin,
  updateParticles,
} from './physics'
import { renderFrame } from './render'
import {
  DEFAULT_RUN_SETTINGS,
  type HeistMetrics,
  pickHeistHookLine,
  type RunSettings,
  scoreHeist,
} from './settings'
import {
  type Blocker,
  type Chain,
  type ChainId,
  type GamePhase,
  type ImpactFlash,
  type LevelData,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  type Winner,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onWinner?: (winner: Winner) => void
  onRaceMetrics?: (metrics: HeistMetrics) => void
  onReelProgress?: (current: number, total: number) => void
  onReelComplete?: (highlights: HeistMetrics[]) => void
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
  chains: Chain[] = []
  blockers: Blocker[] = []
  particles: Particle[] = []
  flashes: ImpactFlash[] = []
  camera = createCamera()
  cameraPunch = 0
  playerCount = 4
  private tipForce = 1
  private chaos = 0.35
  settings: RunSettings = { ...DEFAULT_RUN_SETTINGS }

  private raceTime = 0
  private countdownTimer = 0
  private countdownStep = 3
  private timeScale = 1
  private slowMoTimer = 0
  private photoFinishTimer = 0
  private heistAlarmActive = false
  private windActive = false
  private windValue = 0
  private windGustAt = 0
  private alarmAt = 0
  private windDone = false
  private alarmDone = false
  private tips = 0
  private shatters = 0
  private eliminations = 0
  private raceSeed = 0
  private underdogId: ChainId | null = null
  private tippedStarted = false
  private overlay: OverlayState = this.createOverlay()
  private finalApproachBannered = false

  private reelMode = false
  private reelTotal = 0
  private reelIndex = 0
  private reelResults: HeistMetrics[] = []
  private reelReplayQueue: HeistMetrics[] = []
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
    const nextCount = Math.max(2, Math.min(6, playerCount))
    const changed = this.playerCount !== nextCount
    this.playerCount = nextCount
    if (changed && this.level && this.phase !== 'racing' && this.phase !== 'countdown') {
      this.reset()
    }
  }

  setTipForce(value: number) {
    this.tipForce = Math.max(0.5, Math.min(2, value))
  }

  setChaos(value: number) {
    this.chaos = Math.max(0, Math.min(1.5, value))
  }

  reset() {
    if (!this.level) return
    this.phase = 'idle'
    this.winner = null
    this.chains = createChains(this.level, this.playerCount, this.settings.missingTeeth)
    this.blockers = createBlockers(this.level, this.settings)
    this.particles = []
    this.flashes = []
    this.cameraPunch = 0
    this.raceTime = 0
    this.countdownTimer = 0
    this.countdownStep = 3
    this.timeScale = 1
    this.slowMoTimer = 0
    this.photoFinishTimer = 0
    this.heistAlarmActive = false
    this.windActive = false
    this.windValue = 0
    this.windDone = false
    this.alarmDone = false
    this.tips = 0
    this.shatters = 0
    this.eliminations = 0
    this.tippedStarted = false
    this.raceSeed = (Math.random() * 0xffffffff) >>> 0
    this.underdogId = this.pickUnderdog()
    this.windGustAt = 3.5 + Math.random() * 4
    this.alarmAt = 8 + Math.random() * 5
    this.finalApproachBannered = false
    this.overlay = this.createOverlay()
    audioEngine.resetRace()
    updateCamera(
      this.camera,
      this.chains,
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
    this.overlay.hookLine = pickHeistHookLine()
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
      heistAlarm: false,
      rivalryIds: [],
      nameTags: this.settings.nameTags,
      eventBanner: null,
      eventBannerLife: 0,
      hookLine: null,
      hookLineLife: 0,
      winMessage: null,
    }
  }

  private pickUnderdog(): ChainId | null {
    if (this.chains.length < 2) return null
    return this.chains[this.chains.length - 1]?.id ?? null
  }

  private beginRacing() {
    this.phase = 'racing'
    this.overlay.countdownValue = null
    if (this.overlay.hookLine) this.overlay.hookLineLife = 2
    if (this.settings.launchFlash) this.overlay.launchFlash = 0.35
    if (this.settings.nameTags) this.overlay.nameTags = true
    kickstartChains(this.chains, this.tipForce, this.chaos)
    this.tippedStarted = true
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
          this.chains,
          this.level.bounds.width,
          this.level.bounds.height,
          this.cameraPunch,
          this.heistAlarmActive,
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

  private aliveChains() {
    return this.chains.filter((chain) => chain.alive)
  }

  private rivalryIds(): ChainId[] {
    if (!this.settings.rivalryMode) return []
    return [...this.aliveChains()]
      .sort((a, b) => {
        const ay = a.dominos[Math.max(0, a.tipFront)]?.y ?? 0
        const by = b.dominos[Math.max(0, b.tipFront)]?.y ?? 0
        return by - ay
      })
      .slice(0, 2)
      .map((chain) => chain.id)
  }

  private simulate(dt: number) {
    if (!this.level) return

    this.raceTime += dt
    this.overlay.nameTags = this.settings.nameTags && this.raceTime < 4.5
    this.updateEscalation()
    this.overlay.rivalryIds = this.rivalryIds()
    this.overlay.heistAlarm = this.heistAlarmActive

    if (this.windActive) {
      this.windValue *= 0.985
      if (Math.abs(this.windValue) < 0.15) {
        this.windActive = false
        this.windValue = 0
      }
    }

    const impacts = stepPhysics(
      this.chains,
      this.blockers,
      this.level,
      {
        tipForce: this.tipForce,
        chaos: this.chaos,
        wind: this.windValue,
        settings: this.settings,
        heistAlarm: this.heistAlarmActive,
      },
      dt,
      this.particles,
    )

    for (const impact of impacts) {
      if (impact.kind === 'tip') this.tips += 1
      if (impact.kind === 'shatter' || impact.kind === 'blocker' || impact.kind === 'collide') {
        this.shatters += 1
        this.cameraPunch = -Math.max(5, Math.abs(this.cameraPunch))
        if (this.settings.shatterSlowMo) {
          this.timeScale = 0.32
          this.slowMoTimer = 0.4
        }
      }
      if (impact.kind === 'eliminated') {
        this.eliminations += 1
        const profile = PLAYER_PROFILES.find((p) => p.id === impact.chainId)
        const label = profile?.label ?? 'Chain'
        this.overlay.eventBanner =
          impact.reason === 'stalled'
            ? `${label} stalled — out`
            : `${label} wiped — out`
        this.overlay.eventBannerLife = 1.8
        if (this.settings.shatterSlowMo) {
          this.timeScale = 0.28
          this.slowMoTimer = 0.55
        }
      }
      if (impact.kind === 'vault') {
        this.cameraPunch = -14
      }

      audioEngine.playImpact(impact)
      const chain = this.chains.find((c) => c.id === impact.chainId)
      this.flashes.push({
        x: impact.x,
        y: impact.y,
        life: impact.kind === 'vault' ? 0.2 : 0.08,
        color: chain?.color ?? '#ffffff',
        radius:
          impact.kind === 'vault'
            ? 36
            : impact.kind === 'eliminated'
              ? 28
              : impact.kind === 'shatter' || impact.kind === 'blocker'
                ? 20
                : 12,
      })
    }

    updateParticles(this.particles, dt)
    this.updateFlashes(dt)
    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt

    updateCamera(
      this.camera,
      this.chains,
      this.level.bounds.width,
      this.level.bounds.height,
      this.cameraPunch,
      this.heistAlarmActive,
    )
    this.cameraPunch *= 0.88

    const vaultWinner = checkVaultWinner(this.chains)
    if (vaultWinner) {
      this.handleFinish(vaultWinner)
    } else {
      const alive = this.aliveChains()
      if (alive.length === 0) {
        this.handleFinish(null)
      } else if (alive.length === 1 && this.tippedStarted) {
        // Prefer vault tip: only crown the last chain once its cascade is done/stalled.
        const last = alive[0]
        const stillTipping = last.dominos.some((d) => d.state === 'tipping')
        if (!stillTipping && last.stallTimer >= 0.35) {
          this.handleFinish(last.id, { byElimination: true })
        }
      }
    }
  }

  private updateEscalation() {
    if (!this.level) return
    const progress = leadingProgress(this.chains, this.level.vaultY, this.level.startY)

    if (
      this.settings.windGusts &&
      !this.windDone &&
      this.raceTime >= this.windGustAt
    ) {
      this.windDone = true
      this.windActive = true
      this.windValue = (Math.random() > 0.5 ? 1 : -1) * (2.2 + this.chaos)
      this.banner('WIND GUST', 'wind')
    }

    if (
      this.settings.heistAlarm &&
      !this.alarmDone &&
      (this.raceTime >= this.alarmAt || progress >= 0.62)
    ) {
      this.alarmDone = true
      this.heistAlarmActive = true
      this.banner('HEIST ALARM', 'alarm')
    }

    if (this.heistAlarmActive && progress >= 0.8) {
      this.bannerOnce('FINAL APPROACH', 'stretch')
    }
  }

  private bannerOnce(
    text: string,
    stinger: 'wind' | 'alarm' | 'traffic' | 'chaos' | 'stretch',
  ) {
    if (this.finalApproachBannered) return
    this.finalApproachBannered = true
    this.banner(text, stinger)
  }

  private banner(
    text: string,
    stinger: 'wind' | 'alarm' | 'traffic' | 'chaos' | 'stretch',
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

    if (winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} cracks the vault`
    } else {
      this.overlay.winMessage = 'No one cracks the vault'
    }

    const margin = tipFrontMargin(this.chains)
    if (winner && this.settings.photoFinish && margin < 48) {
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
    const margin = tipFrontMargin(this.chains)
    const upset = !!winner && this.underdogId === winner

    if (winner) {
      audioEngine.playFinish(winner, {
        upset,
        byElimination: options?.byElimination,
      })
    }
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(winner)

    const metrics: HeistMetrics = {
      tips: this.tips,
      shatters: this.shatters,
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

  private advanceReel(metrics: HeistMetrics) {
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
      .sort((a, b) => scoreHeist(b) - scoreHeist(a))
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
    if (!this.level) {
      this.ctx.fillStyle = '#0e1014'
      this.ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
      this.callbacks.onAfterDraw?.()
      return
    }
    renderFrame(
      this.ctx,
      this.camera,
      this.level,
      this.chains,
      this.blockers,
      this.particles,
      this.flashes,
      this.winner,
      this.overlay,
    )
    this.callbacks.onAfterDraw?.()
  }
}
