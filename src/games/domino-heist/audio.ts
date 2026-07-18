import { CaptureAudioEngine } from '../../shared/audio/capture'
import { impactIntensity, noiseBurst, playTone } from '../../shared/audio/kit'
import { profileIndex } from '../../shared/profiles'
import { BASE_TIP_SPEED, type ChainId, type ImpactEvent } from './types'

const CLACK = [196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0]

export type FinishAudioOptions = {
  upset?: boolean
  byElimination?: boolean
}

export class AudioEngine extends CaptureAudioEngine {
  resetRace() {}

  playCountdownBeep(step: number) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    if (step <= 0) {
      noiseBurst(kit, now, 0.1, 0.09, 2000, 'highpass')
      playTone(kit, 523.25, 0.2, 0.16, 'triangle', now)
      playTone(kit, 659.25, 0.24, 0.12, 'sine', now + 0.03)
      return
    }
    playTone(kit, 349.23, 0.09, 0.1, 'sine', now)
    noiseBurst(kit, now, 0.035, 0.025, 1600, 'bandpass')
  }

  playImpact(event: ImpactEvent) {
    const kit = this.getKit()
    if (!kit) return
    const playerIndex = profileIndex(event.chainId)
    const baseIndex = Math.abs(event.noteIndex) % CLACK.length
    const intensity = impactIntensity(event.speed, BASE_TIP_SPEED)
    const now = kit.ctx.currentTime
    const detune = (playerIndex - 2.5) * 4

    if (event.kind === 'eliminated') {
      this.playElimination(baseIndex, intensity, now)
      return
    }

    if (event.kind === 'vault') {
      noiseBurst(kit, now, 0.16, 0.1, 900, 'bandpass')
      playTone(kit, 174.61, 0.35, 0.14, 'triangle', now, detune)
      playTone(kit, 261.63, 0.4, 0.12, 'sine', now + 0.05, detune)
      playTone(kit, 392.0, 0.45, 0.1, 'sine', now + 0.12, detune)
      playTone(kit, 523.25, 0.5, 0.08, 'sine', now + 0.2, detune)
      return
    }

    if (event.kind === 'shatter' || event.kind === 'blocker' || event.kind === 'collide') {
      noiseBurst(kit, now, 0.09 + intensity * 0.05, 0.08 + intensity * 0.06, 1100, 'bandpass')
      noiseBurst(kit, now + 0.02, 0.07, 0.05, 2400, 'highpass')
      playTone(kit, CLACK[baseIndex] * 0.5, 0.14, 0.09, 'triangle', now, detune - 10)
      return
    }

    // tip click-clack
    const freq = CLACK[baseIndex]
    noiseBurst(kit, now, 0.03, 0.03 + intensity * 0.04, 800 + intensity * 600, 'bandpass')
    playTone(
      kit,
      freq,
      0.06 + intensity * 0.03,
      0.07 + intensity * 0.05,
      'triangle',
      now,
      detune,
      1400 + intensity * 800,
    )
    playTone(kit, freq * 1.5, 0.04, 0.035, 'sine', now + 0.012, detune)
  }

  playFinish(winner: ChainId, options: FinishAudioOptions = {}) {
    const kit = this.getKit()
    if (!kit) return
    const playerIndex = profileIndex(winner)
    const root = CLACK[playerIndex % CLACK.length]
    const now = kit.ctx.currentTime

    noiseBurst(kit, now, 0.2, 0.09, 1000, 'bandpass')

    if (options.byElimination) {
      ;[root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
        playTone(kit, freq, 0.36, 0.13 - i * 0.015, 'triangle', now + i * 0.1)
      })
      return
    }

    if (options.upset) {
      ;[root * 0.75, root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
        playTone(kit, freq, 0.3, 0.11, 'sine', now + i * 0.085)
      })
      noiseBurst(kit, now + 0.32, 0.14, 0.06, 1800, 'highpass')
      return
    }

    // Vault crack sting
    ;[root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
      playTone(kit, freq, 0.34, 0.14, 'sine', now + i * 0.1)
    })
    playTone(kit, root * 2.5, 0.42, 0.08, 'sine', now + 0.38)
    noiseBurst(kit, now + 0.15, 0.12, 0.05, 1600, 'highpass')
  }

  playEventStinger(kind: 'wind' | 'alarm' | 'traffic' | 'chaos' | 'stretch') {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const map = {
      wind: [293.66, 349.23],
      alarm: [440.0, 523.25, 659.25],
      traffic: [246.94, 311.13],
      chaos: [277.18, 369.99, 415.3],
      stretch: [392.0, 493.88, 587.33],
    } as const
    noiseBurst(kit, now, 0.09, 0.05, kind === 'alarm' ? 1400 : 1100, 'bandpass')
    map[kind].forEach((freq, i) => {
      playTone(kit, freq, 0.14, 0.09, 'sine', now + i * 0.065)
    })
  }

  private playElimination(baseIndex: number, intensity: number, now: number) {
    const kit = this.getKit()
    if (!kit) return
    const root = CLACK[baseIndex]
    noiseBurst(kit, now, 0.2, 0.11 + intensity * 0.04, 550, 'lowpass')
    noiseBurst(kit, now + 0.04, 0.16, 0.07, 1900, 'highpass')
    playTone(kit, root * 0.5, 0.3, 0.12, 'triangle', now, -16)
    playTone(kit, root * 0.75, 0.24, 0.09, 'sine', now + 0.06)
    playTone(kit, root * 0.4, 0.32, 0.07, 'triangle', now + 0.14, -22)
  }
}

export const audioEngine = new AudioEngine()
