import { CaptureAudioEngine } from '../../shared/audio/capture'
import { impactIntensity, noiseBurst, playTone } from '../../shared/audio/kit'
import { profileIndex } from '../../shared/profiles'
import {
  type ImpactEvent,
  RACER_SPEED,
  type RacerId,
} from './types'

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]

export type { CaptureAudioPacket } from '../../shared/audio/capture'

export type FinishAudioOptions = {
  upset?: boolean
  byElimination?: boolean
}

export class AudioEngine extends CaptureAudioEngine {
  resetRace() {}

  setFinalStretch(_active: boolean) {}

  setCrowdTension(_value: number) {}

  playCountdownBeep(step: number) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    if (step <= 0) {
      // Distinct GO: bright chord + noise whoosh
      noiseBurst(kit, now, 0.12, 0.1, 2200, 'highpass')
      playTone(kit, 523.25, 0.22, 0.18, 'triangle', now)
      playTone(kit, 659.25, 0.26, 0.14, 'sine', now + 0.03)
      playTone(kit, 783.99, 0.3, 0.1, 'sine', now + 0.06)
      return
    }
    playTone(kit, 392.0, 0.1, 0.11, 'sine', now)
    noiseBurst(kit, now, 0.04, 0.03, 1800, 'bandpass')
  }

  playImpact(event: ImpactEvent) {
    const kit = this.getKit()
    if (!kit) return

    const playerIndex = profileIndex(event.racerId)
    const baseIndex = Math.abs(event.noteIndex) % PENTATONIC.length
    const cascade = event.cascade ?? 0
    const intensity = impactIntensity(event.speed, RACER_SPEED)
    const now = kit.ctx.currentTime
    const detune = (playerIndex - 2.5) * 5

    if (event.kind === 'destroyed') {
      this.playElimination(baseIndex, intensity, now)
      return
    }

    if (event.kind === 'barrier') {
      this.playBarrierHit(event, baseIndex, intensity, detune, now)
      return
    }

    if (event.kind === 'brick') {
      // Crunchy smash: noise body + bright ping
      const ping =
        PENTATONIC[(baseIndex + 2) % PENTATONIC.length] * (1.25 + cascade * 0.04)
      noiseBurst(kit, now, 0.07 + intensity * 0.04, 0.07 + intensity * 0.08, 900 + intensity * 700, 'bandpass')
      playTone(kit, ping * 0.45, 0.12, 0.1 + intensity * 0.06, 'triangle', now, detune - 8)
      playTone(kit, ping, 0.14 + intensity * 0.04, 0.12 + intensity * 0.08, 'sine', now + 0.008, detune)
      if (cascade > 0) {
        for (let i = 1; i <= Math.min(cascade, 3); i++) {
          const cascadeFreq = PENTATONIC[(baseIndex + 2 + i) % PENTATONIC.length] * 1.25
          playTone(
            kit,
            cascadeFreq,
            0.09,
            0.06 + intensity * 0.03,
            'sine',
            now + i * 0.04,
            detune,
          )
        }
      }
      return
    }

    if (event.kind === 'perfect') {
      const freq = PENTATONIC[(baseIndex + 3) % PENTATONIC.length] * 1.5
      noiseBurst(kit, now, 0.05, 0.05 + intensity * 0.04, 2400, 'highpass')
      playTone(kit, freq * 0.5, 0.16, 0.08, 'triangle', now, detune)
      playTone(kit, freq, 0.2, 0.14 + intensity * 0.06, 'sine', now + 0.01, detune)
      playTone(kit, freq * 1.5, 0.14, 0.07, 'sine', now + 0.05, detune)
      return
    }

    if (event.kind === 'racer') {
      noiseBurst(kit, now, 0.05, 0.05 + intensity * 0.05, 700, 'lowpass')
      playTone(kit, PENTATONIC[baseIndex] * 0.75, 0.1, 0.09 + intensity * 0.05, 'triangle', now, detune)
      playTone(kit, PENTATONIC[baseIndex] * 1.25, 0.08, 0.07, 'sine', now + 0.015, detune)
      return
    }

    // Wall / clean bounce: soft thud + ping
    const freq = PENTATONIC[baseIndex]
    const cutoff = 1400 + intensity * 1600
    noiseBurst(kit, now, 0.045, 0.035 + intensity * 0.05, 500 + intensity * 400, 'lowpass')
    playTone(kit, freq * 0.5, 0.1, 0.07 + intensity * 0.04, 'triangle', now, detune - 6)
    playTone(
      kit,
      freq,
      0.11 + intensity * 0.03,
      0.1 + intensity * 0.07,
      playerIndex % 2 === 0 ? 'triangle' : 'sine',
      now + 0.006,
      detune,
      cutoff,
    )
  }

  playFinish(winner: RacerId, options: FinishAudioOptions = {}) {
    const kit = this.getKit()
    if (!kit) return
    const playerIndex = profileIndex(winner)
    const root = PENTATONIC[playerIndex % 5]
    const now = kit.ctx.currentTime

    noiseBurst(kit, now, 0.18, 0.08, 1200, 'bandpass')

    if (options.byElimination) {
      const notes = [root, root * 1.25, root * 1.5, root * 2]
      notes.forEach((freq, i) => {
        playTone(kit, freq, 0.38, 0.14 - i * 0.015, 'triangle', now + i * 0.1)
      })
      playTone(kit, root * 2.5, 0.45, 0.08, 'sine', now + 0.42)
      return
    }

    if (options.upset) {
      const notes = [root * 0.75, root, root * 1.25, root * 1.5, root * 2]
      notes.forEach((freq, i) => {
        playTone(kit, freq, 0.32, 0.12, 'sine', now + i * 0.09)
      })
      noiseBurst(kit, now + 0.35, 0.15, 0.07, 2000, 'highpass')
      return
    }

    const notes = [root, root * 1.25, root * 1.5, root * 2]
    notes.forEach((freq, i) => {
      playTone(kit, freq, 0.36, 0.15, 'sine', now + i * 0.11)
    })
    playTone(kit, root * 3, 0.4, 0.07, 'sine', now + 0.4)
  }

  playEventStinger(kind: 'boost' | 'pulse' | 'sudden' | 'stretch' | 'comeback') {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const map = {
      boost: [392.0, 523.25],
      pulse: [329.63, 440.0],
      sudden: [293.66, 392.0, 523.25],
      stretch: [440.0, 554.37, 659.25],
      comeback: [349.23, 440.0, 523.25],
    } as const
    noiseBurst(kit, now, 0.08, 0.045, kind === 'sudden' ? 900 : 1600, 'bandpass')
    map[kind].forEach((freq, i) => {
      playTone(kit, freq, 0.15, 0.1, 'sine', now + i * 0.07)
    })
  }

  private playElimination(baseIndex: number, intensity: number, now: number) {
    const kit = this.getKit()
    if (!kit) return
    const root = PENTATONIC[baseIndex]
    noiseBurst(kit, now, 0.22, 0.12 + intensity * 0.05, 600, 'lowpass')
    noiseBurst(kit, now + 0.04, 0.18, 0.08, 1800, 'highpass')
    playTone(kit, root * 0.5, 0.32, 0.14, 'triangle', now, -18)
    playTone(kit, root * 0.75, 0.26, 0.1, 'sine', now + 0.05)
    playTone(kit, root * 0.4, 0.35, 0.08, 'triangle', now + 0.12, -24)
    // Descending sting
    playTone(kit, root, 0.18, 0.09, 'sine', now + 0.16)
    playTone(kit, root * 0.75, 0.2, 0.07, 'sine', now + 0.26)
    playTone(kit, root * 0.5, 0.28, 0.06, 'sine', now + 0.36)
  }

  private playBarrierHit(
    event: ImpactEvent,
    baseIndex: number,
    intensity: number,
    detune: number,
    now: number,
  ) {
    const kit = this.getKit()
    if (!kit) return
    const maxHealth = Math.max(1, event.barrierMaxHealth ?? 10)
    const health = Math.max(0, event.barrierHealth ?? maxHealth)
    // Lower remaining HP → lower / duller metal (progress feedback)
    const healthRatio = health / maxHealth
    const pitch = 0.85 + healthRatio * 0.55
    const brightness = 900 + healthRatio * 2200 + intensity * 400
    const base = PENTATONIC[(baseIndex + 1) % PENTATONIC.length] * pitch

    noiseBurst(kit, now, 0.055, 0.06 + intensity * 0.05, brightness, 'bandpass')
    playTone(kit, base * 0.5, 0.1, 0.08 + intensity * 0.04, 'square', now, detune, brightness * 0.6)
    playTone(kit, base, 0.12, 0.11 + intensity * 0.05, 'triangle', now + 0.008, detune, brightness)
    playTone(kit, base * 1.5, 0.08, 0.05 + healthRatio * 0.04, 'sine', now + 0.02, detune, brightness)

    if (health <= 0) {
      noiseBurst(kit, now + 0.05, 0.14, 0.09, 1400, 'highpass')
      playTone(kit, base * 0.35, 0.28, 0.1, 'triangle', now + 0.06)
    }
  }
}

export const audioEngine = new AudioEngine()
