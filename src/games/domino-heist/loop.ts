import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { audioEngine } from './audio'
import { createFollowCamera } from './camera3d'
import { generateCourse } from './course'
import { createDominoScene, type DominoScene } from './scene'
import {
  DEFAULT_RUN_SETTINGS,
  DEFAULT_TUNE,
  type CascadeRunSettings,
  type DominoTune,
} from './settings'
import { createDominoPhysics } from './sim'
import type {
  CascadeMetrics,
  CascadeOverlay,
  DominoCourse,
  GamePhase,
  MoodId,
} from './types'

export type GameLoopCallbacks = {
  onPhaseChange?: (phase: GamePhase) => void
  onMetrics?: (metrics: CascadeMetrics) => void
  onAfterDraw?: () => void
}

export class GameLoop {
  phase: GamePhase = 'idle'
  private canvas: HTMLCanvasElement
  private callbacks: GameLoopCallbacks
  private scene: DominoScene
  private sim = createDominoPhysics()
  private follow = createFollowCamera()
  private course: DominoCourse | null = null
  private mood: MoodId = 'spiral'
  private seed = 1
  private tune: DominoTune = { ...DEFAULT_TUNE }
  private settings: CascadeRunSettings = { ...DEFAULT_RUN_SETTINGS }
  private overlay: CascadeOverlay = this.createOverlay()
  private raf = 0
  private lastTs = 0
  private running = false
  private countdownTimer = 0
  private countdownStep = 3
  private raceTime = 0
  private barelyShown = false

  constructor(canvas: HTMLCanvasElement, callbacks: GameLoopCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.scene = createDominoScene(canvas)
    this.syncCanvasResolution()
  }

  private createOverlay(): CascadeOverlay {
    return {
      countdownValue: null,
      banner: null,
      bannerLife: 0,
      finaleHold: 0,
    }
  }

  setMood(mood: MoodId) {
    this.mood = mood
  }

  setSeed(seed: number) {
    this.seed = seed
  }

  setTune(tune: DominoTune) {
    this.tune = { ...tune }
    this.sim.setTune(this.tune)
  }

  setSettings(settings: CascadeRunSettings) {
    this.settings = settings
  }

  loadCourse(mood: MoodId, seed: number, tune: DominoTune = this.tune) {
    this.mood = mood
    this.seed = seed
    this.tune = { ...tune }
    this.sim.setTune(this.tune)
    this.course = generateCourse(mood, seed, {
      drama: tune.drama,
      spacing: tune.spacing,
      clutchSpacing: tune.clutchSpacing,
    })
    this.scene.setCourse(this.course)
    this.sim.reset(this.course)
    this.scene.syncPoses(this.sim.poses)
    this.follow.reset(this.course, this.scene.camera)
    this.phase = 'idle'
    this.overlay = this.createOverlay()
    this.callbacks.onPhaseChange?.(this.phase)
  }

  launch() {
    if (!this.course) {
      this.loadCourse(this.mood, this.seed, this.tune)
    } else {
      this.sim.setTune(this.tune)
      this.sim.reset(this.course)
      this.scene.setCourse(this.course)
      this.scene.syncPoses(this.sim.poses)
      this.follow.reset(this.course, this.scene.camera)
    }
    this.overlay = this.createOverlay()
    this.raceTime = 0
    this.barelyShown = false
    audioEngine.unlock()
    audioEngine.resetRace()

    if (this.settings.countdown) {
      this.phase = 'countdown'
      this.countdownStep = 3
      this.countdownTimer = 0.85
      this.overlay.countdownValue = 3
      audioEngine.playCountdownBeep(3)
    } else {
      this.beginCascade()
    }
    this.callbacks.onPhaseChange?.(this.phase)
  }

  private beginCascade() {
    this.phase = 'racing'
    this.overlay.countdownValue = null
    this.overlay.banner = null
    this.sim.kickstart()
    this.callbacks.onPhaseChange?.(this.phase)
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTs = performance.now()
    const tick = (ts: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000)
      this.lastTs = ts
      this.update(dt)
      this.draw()
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.sim.dispose()
    this.scene.dispose()
  }

  syncCanvasResolution() {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const parent = this.canvas.parentElement
    const cssW = parent?.clientWidth || VIEW_WIDTH
    const cssH = parent?.clientHeight || VIEW_HEIGHT
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.scene.setSize(cssW, cssH, dpr)
  }

  private update(dt: number) {
    if (this.overlay.bannerLife > 0) {
      this.overlay.bannerLife -= dt
      if (this.overlay.bannerLife <= 0) this.overlay.banner = null
    }

    if (this.phase === 'countdown') {
      this.countdownTimer -= dt
      this.follow.update(
        this.scene.camera,
        this.sim.activePosition(),
        dt,
        'wide',
      )
      if (this.countdownTimer <= 0) {
        this.countdownStep -= 1
        if (this.countdownStep < 0) {
          this.overlay.countdownValue = null
          this.beginCascade()
        } else {
          this.overlay.countdownValue = this.countdownStep
          this.countdownTimer = this.countdownStep === 0 ? 0.55 : 0.75
          audioEngine.playCountdownBeep(this.countdownStep)
        }
      }
      return
    }

    if (this.phase === 'racing') {
      this.raceTime += dt
      const impacts = this.sim.step(dt)
      this.scene.syncPoses(this.sim.poses)

      for (const impact of impacts) {
        if (!this.settings.nearMissSlowMo && impact.kind === 'gap') {
          this.sim.timeScale = 1
        }
        audioEngine.playImpact(impact)
        if (impact.kind === 'gap' && !this.barelyShown) {
          this.barelyShown = true
          this.follow.punch(0.45)
          this.overlay.banner = 'Barely…'
          this.overlay.bannerLife = 1.1
        }
      }

      if (this.sim.clutchHang) {
        this.follow.punch(0.06)
      }

      this.follow.update(
        this.scene.camera,
        this.sim.activePosition(),
        dt,
        'follow',
      )

      if (this.sim.done) {
        this.finishCascade(this.sim.failed)
      }
      return
    }

    if (this.phase === 'finished') {
      if (this.overlay.finaleHold > 0.4) {
        this.sim.step(dt)
        this.scene.syncPoses(this.sim.poses)
      }
      this.follow.update(this.scene.camera, this.sim.activePosition(), dt, 'wide')
      if (this.overlay.finaleHold > 0) this.overlay.finaleHold -= dt
    }

    if (this.phase === 'idle') {
      this.follow.update(this.scene.camera, null, dt, 'idle')
    }
  }

  private finishCascade(failed: boolean) {
    this.phase = 'finished'
    this.overlay.countdownValue = null
    if (failed) {
      this.overlay.banner = 'Cascade broken'
      audioEngine.playImpact({ kind: 'tip', index: 0, speed: 1 })
    } else {
      this.overlay.banner = 'Against all odds'
      this.follow.punch(0.5)
      audioEngine.playSuccess()
    }
    this.overlay.bannerLife = 3.5
    this.overlay.finaleHold = this.settings.finaleHold ? 2.2 : 0.5
    this.callbacks.onPhaseChange?.(this.phase)

    if (this.course) {
      const metrics: CascadeMetrics = {
        tips: this.sim.tips,
        nearMisses: this.sim.nearMissesCleared,
        durationSec: this.raceTime,
        seed: this.course.seed,
        mood: this.course.mood,
        name: this.course.name,
      }
      this.callbacks.onMetrics?.(metrics)
    }
  }

  private draw() {
    this.scene.drawHud(this.overlay)
    this.scene.render()
    this.callbacks.onAfterDraw?.()
  }
}
