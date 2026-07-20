import { CaptureAudioEngine } from '../../shared/audio/capture'
import { impactIntensity, noiseBurst, playTone } from '../../shared/audio/kit'
import type { TipImpact } from './types'

const CLACK = [196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0]

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

  playImpact(event: TipImpact) {
    const kit = this.getKit()
    if (!kit) return
    const baseIndex = Math.abs(event.index) % CLACK.length
    const intensity = impactIntensity(event.speed, 3.6)
    const now = kit.ctx.currentTime
    const freq = CLACK[baseIndex]

    if (event.kind === 'finale') {
      noiseBurst(kit, now, 0.18, 0.1, 900, 'bandpass')
      ;[174.61, 261.63, 392.0, 523.25].forEach((f, i) => {
        playTone(kit, f, 0.4, 0.12 - i * 0.015, 'sine', now + i * 0.08)
      })
      return
    }

    if (event.kind === 'gap') {
      noiseBurst(kit, now, 0.06, 0.05, 700, 'bandpass')
      playTone(kit, freq * 0.75, 0.12, 0.1, 'triangle', now)
      playTone(kit, freq * 1.25, 0.1, 0.07, 'sine', now + 0.05)
      return
    }

    noiseBurst(kit, now, 0.028, 0.03 + intensity * 0.04, 800 + intensity * 500, 'bandpass')
    playTone(kit, freq, 0.06 + intensity * 0.03, 0.07 + intensity * 0.04, 'triangle', now, 0, 1400)
    playTone(kit, freq * 1.5, 0.04, 0.03, 'sine', now + 0.01)
  }

  playSuccess() {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    noiseBurst(kit, now, 0.2, 0.09, 1000, 'bandpass')
    ;[261.63, 329.63, 392.0, 523.25, 659.25].forEach((freq, i) => {
      playTone(kit, freq, 0.36, 0.12, 'sine', now + i * 0.09)
    })
  }
}

export const audioEngine = new AudioEngine()
