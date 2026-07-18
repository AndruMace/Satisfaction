import { CaptureAudioEngine } from '../../shared/audio/capture'
import { noiseBurst, playTone } from '../../shared/audio/kit'
import { profileIndex } from '../../shared/profiles'
import type { BubbleId, ImpactEvent } from './types'

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]

export type FinishAudioOptions = {
  upset?: boolean
}

export class AudioEngine extends CaptureAudioEngine {
  private lastShoveAt = 0

  resetMatch() {
    this.lastShoveAt = 0
  }

  playCountdownBeep(step: number) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    if (step <= 0) {
      noiseBurst(kit, now, 0.14, 0.09, 2400, 'highpass')
      playTone(kit, 523.25, 0.2, 0.16, 'sine', now)
      playTone(kit, 659.25, 0.24, 0.12, 'triangle', now + 0.03)
      playTone(kit, 784.0, 0.28, 0.09, 'sine', now + 0.06)
      return
    }
    playTone(kit, 349.23, 0.09, 0.1, 'sine', now)
    noiseBurst(kit, now, 0.035, 0.025, 1600, 'bandpass')
  }

  playImpact(event: ImpactEvent) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const playerIndex = profileIndex(event.bubbleId)
    const root = PENTATONIC[playerIndex % PENTATONIC.length]
    const detune = (playerIndex - 2.5) * 6
    const i = event.intensity

    if (event.kind === 'spike' || event.kind === 'overinflate' || event.kind === 'crush' || event.kind === 'merge') {
      this.playPop(root, i, now, event.kind)
      return
    }

    if (event.kind === 'shove') {
      if (now - this.lastShoveAt < 0.04) return
      this.lastShoveAt = now
      noiseBurst(kit, now, 0.05, 0.035 + i * 0.05, 500 + i * 600, 'lowpass')
      playTone(kit, root * 0.7, 0.08, 0.06 + i * 0.05, 'triangle', now, detune)
      playTone(kit, root * 1.15, 0.07, 0.05 + i * 0.04, 'sine', now + 0.012, detune)
      return
    }

    // wall
    noiseBurst(kit, now, 0.04, 0.03 + i * 0.04, 700, 'bandpass')
    playTone(kit, root * 0.55, 0.09, 0.07 + i * 0.04, 'triangle', now, detune)
  }

  playFinish(winner: BubbleId, options: FinishAudioOptions = {}) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const root = PENTATONIC[profileIndex(winner) % 5]
    noiseBurst(kit, now, 0.16, 0.07, 1400, 'bandpass')

    if (options.upset) {
      ;[root * 0.75, root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
        playTone(kit, freq, 0.3, 0.11, 'sine', now + i * 0.08)
      })
      noiseBurst(kit, now + 0.32, 0.12, 0.06, 2200, 'highpass')
      return
    }

    ;[root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
      playTone(kit, freq, 0.34, 0.13, 'triangle', now + i * 0.1)
    })
    playTone(kit, root * 2.5, 0.4, 0.07, 'sine', now + 0.38)
  }

  playEventStinger(kind: 'surge' | 'hazards' | 'duel' | 'temptation') {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const map = {
      surge: [392.0, 523.25, 659.25],
      hazards: [293.66, 349.23, 440.0],
      duel: [440.0, 554.37],
      temptation: [329.63, 415.3, 493.88],
    } as const
    noiseBurst(kit, now, 0.07, 0.04, kind === 'hazards' ? 900 : 1700, 'bandpass')
    map[kind].forEach((freq, i) => {
      playTone(kit, freq, 0.14, 0.09, 'sine', now + i * 0.065)
    })
  }

  private playPop(
    root: number,
    intensity: number,
    now: number,
    kind: ImpactEvent['kind'],
  ) {
    const kit = this.getKit()
    if (!kit) return
    const bright = kind === 'spike' ? 2200 : kind === 'merge' ? 1100 : 1600
    noiseBurst(kit, now, 0.16 + intensity * 0.08, 0.14 + intensity * 0.06, bright, 'bandpass')
    noiseBurst(kit, now + 0.02, 0.12, 0.08, 2800, 'highpass')
    playTone(kit, root * 1.5, 0.12, 0.12, 'sine', now)
    playTone(kit, root * 0.7, 0.22, 0.1, 'triangle', now + 0.04, -12)
    playTone(kit, root * 0.45, 0.28, 0.07, 'triangle', now + 0.1, -20)
    // Descending drip
    playTone(kit, root, 0.14, 0.06, 'sine', now + 0.14)
    playTone(kit, root * 0.75, 0.16, 0.05, 'sine', now + 0.22)
  }
}

export const audioEngine = new AudioEngine()
