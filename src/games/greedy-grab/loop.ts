import { audioEngine } from './audio'
import {
  aliveCoins,
  checkBankWin,
  cloneCoins,
  createAgents,
  createClosingFloor,
  pickRichest,
  spawnCoinRain,
  stepPhysics,
  updateParticles,
  wealth,
} from './physics'
import { createCamera, renderFrame, updateCamera } from './render'
import {
  DEFAULT_RUN_SETTINGS,
  type GrabMetrics,
  pickGrabHookLine,
  type RunSettings,
  scoreGrab,
} from './settings'
import {
  type Agent,
  type AgentId,
  type ClosingFloor,
  type Coin,
  type GamePhase,
  type ImpactFlash,
  type LevelData,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onWinner?: (winner: Winner) => void
  onGrabMetrics?: (metrics: GrabMetrics) => void
  onReelProgress?: (current: number, total: number) => void
  onReelComplete?: (highlights: GrabMetrics[]) => void
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
  agents: Agent[] = []
  coins: Coin[] = []
  floor: ClosingFloor = { y: 0, speed: 0, active: false }
  particles: Particle[] = []
  flashes: ImpactFlash[] = []
  camera = createCamera()
  cameraPunch = 0
  playerCount = 4
  greedWeight = 1
  roundLength = 45
  depositRequired = true
  bankOnElim = false
  settings: RunSettings = { ...DEFAULT_RUN_SETTINGS }

  private roundTime = 0
  private countdownTimer = 0
  private countdownStep = 3
  private timeScale = 1
  private slowMoTimer = 0
  private photoFinishTimer = 0
  private coinsCollected = 0
  private eliminations = 0
  private banks = 0
  private raceSeed = 0
  private underdogId: AgentId | null = null
  private overlay: OverlayState = this.createOverlay()
  private nextCoinId = { current: 1000 }
  private coinRainAt = 0
  private magnetPulseAt = 0
  private floorAt = 0
  private greedSurgeAt = 0
  private coinRainDone = false
  private magnetPulseDone = false
  private floorDone = false
  private greedSurgeDone = false
  private coinRainActive = false
  private rainTimer = 0

  private reelMode = false
  private reelTotal = 0
  private reelIndex = 0
  private reelResults: GrabMetrics[] = []
  private reelReplayQueue: GrabMetrics[] = []
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

  setGreedWeight(value: number) {
    this.greedWeight = Math.max(0.4, Math.min(2.5, value))
  }

  setRoundLength(seconds: number) {
    this.roundLength = Math.max(20, Math.min(90, Math.round(seconds)))
  }

  setDepositRequired(enabled: boolean) {
    this.depositRequired = enabled
  }

  setBankOnElim(enabled: boolean) {
    this.bankOnElim = enabled
  }

  reset() {
    if (!this.level) return
    this.phase = 'idle'
    this.winner = null
    this.agents = createAgents(this.level, this.playerCount)
    this.coins = cloneCoins(this.level.coins)
    this.floor = createClosingFloor(this.level)
    this.particles = []
    this.flashes = []
    this.cameraPunch = 0
    this.roundTime = 0
    this.countdownTimer = 0
    this.countdownStep = 3
    this.timeScale = 1
    this.slowMoTimer = 0
    this.photoFinishTimer = 0
    this.coinsCollected = 0
    this.eliminations = 0
    this.banks = 0
    this.underdogId = this.pickUnderdog()
    this.nextCoinId.current =
      Math.max(0, ...this.coins.map((c) => c.id)) + 1
    this.coinRainAt = 6 + Math.random() * 5
    this.magnetPulseAt = 10 + Math.random() * 6
    this.floorAt = 14 + Math.random() * 8
    this.greedSurgeAt = 8 + Math.random() * 7
    this.coinRainDone = false
    this.magnetPulseDone = false
    this.floorDone = false
    this.greedSurgeDone = false
    this.coinRainActive = false
    this.rainTimer = 0
    this.overlay = this.createOverlay()
    audioEngine.resetRound()
    updateCamera(this.camera, this.agents, this.level)
    this.callbacks.onPhaseChange?.(this.phase)
    this.callbacks.onWinner?.(null)
    this.draw()
  }

  launch() {
    if (!this.level) return
    if (this.phase === 'racing' || this.phase === 'countdown') return
    audioEngine.unlock()
    this.reset()
    this.overlay.hookLine = pickGrabHookLine()
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
      nameTags: this.settings.nameTags,
      eventBanner: null,
      eventBannerLife: 0,
      hookLine: null,
      hookLineLife: 0,
      winMessage: null,
      rivalryIds: [],
      closingFloor: false,
      coinRain: false,
      magnetPulse: false,
      scoreHud: this.settings.scoreHud,
      timerLabel: null,
    }
  }

  private pickUnderdog(): AgentId | null {
    if (this.agents.length < 2) return null
    return this.agents[this.agents.length - 1]?.id ?? null
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
          this.finishRound(this.winner)
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
        updateCamera(this.camera, this.agents, this.level, this.cameraPunch)
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

  private updateFlashes(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1)
    }
  }

  private aliveAgents() {
    return this.agents.filter((a) => a.alive)
  }

  private rivalryIds(): AgentId[] {
    if (!this.settings.rivalryMode) return []
    return [...this.aliveAgents()]
      .sort(
        (a, b) =>
          wealth(b, this.depositRequired) - wealth(a, this.depositRequired),
      )
      .slice(0, 2)
      .map((a) => a.id)
  }

  private simulate(dt: number) {
    if (!this.level) return

    this.roundTime += dt
    this.overlay.nameTags = this.settings.nameTags && this.roundTime < 4.5
    this.overlay.scoreHud = this.settings.scoreHud
    this.overlay.rivalryIds = this.rivalryIds()

    const remaining = Math.max(0, this.roundLength - this.roundTime)
    this.overlay.timerLabel = `${Math.ceil(remaining)}s`

    this.updateEscalation(dt)

    if (this.floor.active) {
      this.floor.y = Math.max(
        120,
        this.floor.y - this.floor.speed * dt,
      )
      this.overlay.closingFloor = true
    }

    if (this.coinRainActive) {
      this.rainTimer -= dt
      if (this.rainTimer <= 0) {
        spawnCoinRain(this.coins, this.level, this.nextCoinId, 3 + Math.floor(Math.random() * 3))
        this.rainTimer = 0.55
      }
    }

    const events = stepPhysics(
      this.agents,
      this.coins,
      this.level,
      this.floor,
      {
        greedWeight: this.greedWeight,
        depositRequired: this.depositRequired,
        magnetBoost: this.overlay.magnetPulse ? 1.8 : 1,
      },
      dt,
      this.particles,
      this.bankOnElim,
    )

    for (const event of events) {
      audioEngine.playEvent(event)
      if (event.kind === 'coin') {
        this.coinsCollected += event.value
        this.flashes.push({
          x: event.x,
          y: event.y,
          life: 0.1,
          color: '#ffd43b',
          radius: 14,
        })
      }
      if (event.kind === 'bank') {
        this.banks += 1
        this.overlay.eventBanner = `BANKED +${event.amount}`
        this.overlay.eventBannerLife = 1.1
        this.flashes.push({
          x: event.x,
          y: event.y,
          life: 0.14,
          color: '#2a9d8f',
          radius: 22,
        })
      }
      if (event.kind === 'fall') {
        this.eliminations += 1
        const profile = PLAYER_PROFILES.find((p) => p.id === event.agentId)
        this.overlay.eventBanner = `${profile?.label ?? 'Agent'} eliminated`
        this.overlay.eventBannerLife = 1.6
        this.cameraPunch = -10
        if (this.settings.fallSlowMo) {
          this.timeScale = 0.28
          this.slowMoTimer = 0.55
        }
        this.flashes.push({
          x: event.x,
          y: event.y,
          life: 0.18,
          color: profile?.color ?? '#fff',
          radius: 32,
        })
      }
    }

    updateParticles(this.particles, dt)
    this.updateFlashes(dt)
    if (this.overlay.eventBannerLife > 0) {
      this.overlay.eventBannerLife -= dt
      if (this.overlay.eventBannerLife <= 0) this.overlay.eventBanner = null
    }
    if (this.overlay.launchFlash > 0) this.overlay.launchFlash -= dt
    this.tickHookLine(dt)

    updateCamera(this.camera, this.agents, this.level, this.cameraPunch)
    this.cameraPunch *= 0.88

    // Win conditions
    const bankWinner = checkBankWin(
      this.agents,
      this.depositRequired ? this.level.bankTarget : 0,
    )
    if (bankWinner) {
      this.handleFinish(bankWinner, { jackpot: true })
      return
    }

    const alive = this.aliveAgents()
    if (alive.length === 1) {
      this.handleFinish(alive[0].id, { byElimination: true })
      return
    }
    if (alive.length === 0) {
      this.handleFinish(null)
      return
    }

    const timeUp = this.roundTime >= this.roundLength
    const coinsGone = aliveCoins(this.coins) === 0 && !this.coinRainActive
    if (timeUp || coinsGone) {
      const richest = pickRichest(this.agents, this.depositRequired)
      this.handleFinish(richest, { jackpot: true })
    }
  }

  private updateEscalation(dt: number) {
    void dt
    if (
      this.settings.coinRain &&
      !this.coinRainDone &&
      this.roundTime >= this.coinRainAt
    ) {
      this.coinRainDone = true
      this.coinRainActive = true
      this.rainTimer = 0
      this.overlay.coinRain = true
      this.banner('COIN RAIN', 'rain')
    }

    if (
      this.settings.magnetPulse &&
      !this.magnetPulseDone &&
      this.roundTime >= this.magnetPulseAt &&
      this.level &&
      this.level.magnets.length > 0
    ) {
      this.magnetPulseDone = true
      this.overlay.magnetPulse = true
      this.banner('MAGNET PULSE', 'magnet')
    }

    if (
      this.settings.closingFloor &&
      !this.floorDone &&
      this.roundTime >= this.floorAt
    ) {
      this.floorDone = true
      this.floor.active = true
      this.banner('FLOOR RISING', 'floor')
    }

    if (
      this.settings.greedSurge &&
      !this.greedSurgeDone &&
      this.roundTime >= this.greedSurgeAt
    ) {
      this.greedSurgeDone = true
      // Tempt everyone: spawn a rich cluster near mid-field
      if (this.level) {
        spawnCoinRain(this.coins, this.level, this.nextCoinId, 12)
      }
      this.banner('GREED SURGE', 'surge')
    }

    // Stop rain after a burst window
    if (this.coinRainActive && this.roundTime > this.coinRainAt + 8) {
      this.coinRainActive = false
      this.overlay.coinRain = false
    }
    if (this.overlay.magnetPulse && this.roundTime > this.magnetPulseAt + 6) {
      this.overlay.magnetPulse = false
    }
  }

  private banner(text: string, stinger: 'rain' | 'magnet' | 'floor' | 'surge' | 'jackpot') {
    this.overlay.eventBanner = text
    this.overlay.eventBannerLife = 1.4
    audioEngine.playEventStinger(stinger)
  }

  private handleFinish(
    winner: Winner,
    options?: { byElimination?: boolean; jackpot?: boolean },
  ) {
    this.winner = winner
    if (options?.byElimination && winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} wins by elimination`
      this.finishRound(winner, options)
      return
    }

    if (options?.jackpot && winner) {
      const profile = PLAYER_PROFILES.find((p) => p.id === winner)
      this.overlay.winMessage = `${profile?.label ?? 'Player'} hits the jackpot`
    } else {
      this.overlay.winMessage = null
    }

    const alive = this.aliveAgents()
    const ranked = [...alive].sort(
      (a, b) =>
        wealth(b, this.depositRequired) - wealth(a, this.depositRequired),
    )
    const margin =
      ranked.length >= 2
        ? Math.abs(
            wealth(ranked[0], this.depositRequired) -
              wealth(ranked[1], this.depositRequired),
          )
        : 0

    if (winner && this.settings.photoFinish && margin <= 2 && ranked.length >= 2) {
      this.photoFinishTimer = 1.1
      this.overlay.photoFinish = this.photoFinishTimer
      this.timeScale = 0.2
      return
    }

    this.finishRound(winner, options)
  }

  private finishRound(
    winner: Winner,
    options?: { byElimination?: boolean; jackpot?: boolean },
  ) {
    this.phase = 'finished'
    this.winner = winner
    this.timeScale = 1
    this.coinRainActive = false

    const alive = this.aliveAgents()
    const ranked = [...alive].sort(
      (a, b) =>
        wealth(b, this.depositRequired) - wealth(a, this.depositRequired),
    )
    const margin =
      ranked.length >= 2
        ? Math.abs(
            wealth(ranked[0], this.depositRequired) -
              wealth(ranked[1], this.depositRequired),
          )
        : 40
    const upset = !!winner && this.underdogId === winner

    if (winner) {
      const jackpot = options?.jackpot || this.settings.jackpotFlash
      audioEngine.playFinish(winner, {
        jackpot: !!jackpot && !options?.byElimination,
        byElimination: options?.byElimination,
      })
      if (jackpot && this.settings.jackpotFlash && !options?.byElimination) {
        this.overlay.launchFlash = 0.45
        audioEngine.playEventStinger('jackpot')
      }
    }

    this.raceSeed = (this.raceSeed + 1) % 1_000_000
    const metrics: GrabMetrics = {
      coinsCollected: this.coinsCollected,
      eliminations: this.eliminations,
      banks: this.banks,
      finishMargin: margin,
      upset,
      seed: this.raceSeed,
      winner,
    }
    this.callbacks.onGrabMetrics?.(metrics)
    this.callbacks.onWinner?.(winner)
    this.callbacks.onPhaseChange?.(this.phase)

    if (this.reelMode) {
      this.handleReelFinish(metrics)
    }
  }

  private handleReelFinish(metrics: GrabMetrics) {
    if (this.reelReplaying) {
      this.reelReplayQueue.shift()
      if (this.reelReplayQueue.length > 0) {
        window.setTimeout(() => this.launch(), 400)
      } else {
        this.reelMode = false
        this.reelReplaying = false
        const top = [...this.reelResults]
          .sort((a, b) => scoreGrab(b) - scoreGrab(a))
          .slice(0, 3)
        this.callbacks.onReelComplete?.(top)
      }
      return
    }

    this.reelResults.push(metrics)
    this.reelIndex += 1
    this.callbacks.onReelProgress?.(this.reelIndex, this.reelTotal)

    if (this.reelIndex < this.reelTotal) {
      window.setTimeout(() => this.launch(), 350)
    } else {
      const top = [...this.reelResults]
        .sort((a, b) => scoreGrab(b) - scoreGrab(a))
        .slice(0, 3)
      this.reelReplayQueue = top
      this.reelReplaying = true
      this.callbacks.onReelComplete?.(top)
      if (top.length > 0) {
        window.setTimeout(() => this.launch(), 500)
      } else {
        this.reelMode = false
        this.reelReplaying = false
      }
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
      this.agents,
      this.coins,
      this.floor,
      this.particles,
      this.flashes,
      this.winner,
      this.overlay,
      this.depositRequired,
    )
    this.callbacks.onAfterDraw?.()
  }
}
