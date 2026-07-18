import { CaptureAudioEngine } from '../../shared/audio/capture'
import { noiseBurst, playTone } from '../../shared/audio/kit'
import { profileIndex } from '../../shared/profiles'
import type { DodgerId } from './types'

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]

export type FinishAudioOptions = {
  upset?: boolean
  byElimination?: boolean
  survive?: boolean
}

/**
 * Laser Roulette SFX — no constant cheer bed.
 * Optional hum is gated by settings and off by default.
 */
export class AudioEngine extends CaptureAudioEngine {
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private humEnabled = false

  resetMatch() {
    this.stopHum()
  }

  setHumEnabled(enabled: boolean) {
    this.humEnabled = enabled
    if (!enabled) this.stopHum()
    else if (this.ctx) this.startHum()
  }

  setTension(value: number) {
    if (!this.humEnabled || !this.humGain || !this.humOsc) return
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const v = Math.max(0, Math.min(1, value))
    this.humGain.gain.cancelScheduledValues(now)
    this.humGain.gain.linearRampToValueAtTime(0.012 + v * 0.028, now + 0.08)
    this.humOsc.frequency.cancelScheduledValues(now)
    this.humOsc.frequency.linearRampToValueAtTime(55 + v * 40, now + 0.1)
  }

  playCountdownBeep(step: number) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    if (step <= 0) {
      noiseBurst(kit, now, 0.1, 0.08, 2400, 'highpass')
      playTone(kit, 523.25, 0.2, 0.16, 'triangle', now)
      playTone(kit, 784.0, 0.24, 0.1, 'sine', now + 0.04)
      return
    }
    playTone(kit, 370.0, 0.09, 0.1, 'sine', now)
    noiseBurst(kit, now, 0.03, 0.025, 1600, 'bandpass')
  }

  playZap(dodgerId: DodgerId) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const idx = profileIndex(dodgerId)
    const root = PENTATONIC[idx % PENTATONIC.length]

    // Sharp electric zap
    noiseBurst(kit, now, 0.09, 0.14, 2800, 'highpass')
    noiseBurst(kit, now, 0.06, 0.1, 900, 'bandpass')
    playTone(kit, root * 2.5, 0.08, 0.12, 'square', now, 0, 4200)
    playTone(kit, root * 1.5, 0.12, 0.1, 'sawtooth', now + 0.02, -12, 2400)
    playTone(kit, root * 0.5, 0.18, 0.08, 'triangle', now + 0.04)
  }

  playNearMiss(_dodgerId: DodgerId) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    noiseBurst(kit, now, 0.035, 0.045, 3200, 'highpass')
    playTone(kit, 880, 0.05, 0.07, 'triangle', now, 8, 4000)
    playTone(kit, 1320, 0.04, 0.045, 'sine', now + 0.02)
  }

  playElimination(dodgerId: DodgerId) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const root = PENTATONIC[profileIndex(dodgerId) % PENTATONIC.length]
    noiseBurst(kit, now, 0.2, 0.11, 700, 'lowpass')
    noiseBurst(kit, now + 0.03, 0.16, 0.07, 2000, 'highpass')
    playTone(kit, root * 0.5, 0.3, 0.12, 'triangle', now, -20)
    playTone(kit, root, 0.16, 0.08, 'sine', now + 0.14)
    playTone(kit, root * 0.75, 0.18, 0.06, 'sine', now + 0.26)
    playTone(kit, root * 0.5, 0.24, 0.05, 'sine', now + 0.36)
  }

  playFinish(winner: DodgerId, options: FinishAudioOptions = {}) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const root = PENTATONIC[profileIndex(winner) % 5]

    noiseBurst(kit, now, 0.16, 0.07, 1400, 'bandpass')

    if (options.survive) {
      ;[root, root * 1.25, root * 1.5].forEach((freq, i) => {
        playTone(kit, freq, 0.34, 0.13 - i * 0.02, 'sine', now + i * 0.1)
      })
      return
    }

    if (options.byElimination) {
      const notes = [root, root * 1.25, root * 1.5, root * 2]
      notes.forEach((freq, i) => {
        playTone(kit, freq, 0.36, 0.13 - i * 0.015, 'triangle', now + i * 0.1)
      })
      playTone(kit, root * 2.5, 0.4, 0.07, 'sine', now + 0.4)
      return
    }

    if (options.upset) {
      ;[root * 0.75, root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
        playTone(kit, freq, 0.3, 0.11, 'sine', now + i * 0.085)
      })
      noiseBurst(kit, now + 0.32, 0.12, 0.06, 2200, 'highpass')
      return
    }

    ;[root, root * 1.25, root * 1.5, root * 2].forEach((freq, i) => {
      playTone(kit, freq, 0.34, 0.14, 'sine', now + i * 0.1)
    })
    playTone(kit, root * 3, 0.38, 0.06, 'sine', now + 0.38)
  }

  playEventStinger(kind: 'spike' | 'extra' | 'narrow' | 'reverse' | 'final') {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const map = {
      spike: [392.0, 523.25],
      extra: [440.0, 554.37, 659.25],
      narrow: [349.23, 466.16],
      reverse: [293.66, 392.0, 493.88],
      final: [523.25, 659.25, 784.0],
    } as const
    noiseBurst(kit, now, 0.07, 0.04, kind === 'reverse' ? 800 : 1800, 'bandpass')
    map[kind].forEach((freq, i) => {
      playTone(kit, freq, 0.14, 0.09, 'sine', now + i * 0.06)
    })
  }

  private startHum() {
    const kit = this.getKit()
    if (!kit || this.humOsc) return
    const osc = kit.ctx.createOscillator()
    const gain = kit.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 60
    gain.gain.value = 0.018
    osc.connect(gain)
    gain.connect(kit.master)
    osc.start()
    this.humOsc = osc
    this.humGain = gain
  }

  private stopHum() {
    try {
      this.humOsc?.stop()
    } catch {
      // already stopped
    }
    this.humOsc?.disconnect()
    this.humGain?.disconnect()
    this.humOsc = null
    this.humGain = null
  }
}

export const audioEngine = new AudioEngine()
