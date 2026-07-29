import { CaptureAudioEngine } from '../../shared/audio/capture'
import { noiseBurst, playTone, type AudioKit } from '../../shared/audio/kit'
import type { AudioCue } from './types'

export type { CaptureAudioPacket } from '../../shared/audio/capture'

const PENT = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]

function winFanfare(kit: AudioKit, now: number) {
  for (let i = 0; i < PENT.length; i++) {
    playTone(kit, PENT[i], 0.22, 0.1, 'sine', now + i * 0.055)
  }
  playTone(kit, 1046.5, 0.35, 0.09, 'triangle', now + 0.28)
  noiseBurst(kit, now, 0.2, 0.09, 2200, 'highpass')
  noiseBurst(kit, now + 0.12, 0.14, 0.08, 600, 'lowpass')
}

export class AudioEngine extends CaptureAudioEngine {
  playCue(cue: AudioCue) {
    this.unlock()
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime

    switch (cue.kind) {
      case 'start': {
        noiseBurst(kit, now, 0.1, 0.08, 1800, 'highpass')
        playTone(kit, 392, 0.12, 0.12, 'triangle', now)
        playTone(kit, 523.25, 0.18, 0.14, 'sine', now + 0.05)
        playTone(kit, 783.99, 0.22, 0.1, 'sine', now + 0.1)
        break
      }
      case 'peg': {
        playTone(kit, 660 + Math.random() * 80, 0.035, 0.04, 'triangle', now)
        break
      }
      case 'bumper': {
        noiseBurst(kit, now, 0.06, 0.07, 900, 'bandpass')
        playTone(kit, 220, 0.08, 0.1, 'square', now)
        playTone(kit, 440, 0.1, 0.07, 'triangle', now + 0.03)
        break
      }
      case 'upgrade': {
        playTone(kit, 523.25, 0.1, 0.1, 'triangle', now)
        playTone(kit, 659.25, 0.14, 0.09, 'sine', now + 0.05)
        playTone(kit, 783.99, 0.18, 0.08, 'sine', now + 0.1)
        break
      }
      case 'jackpot': {
        noiseBurst(kit, now, 0.16, 0.12, 2400, 'highpass')
        playTone(kit, 523.25, 0.14, 0.12, 'triangle', now)
        playTone(kit, 783.99, 0.2, 0.11, 'sine', now + 0.06)
        playTone(kit, 1046.5, 0.28, 0.1, 'sine', now + 0.12)
        playTone(kit, 1318.5, 0.22, 0.08, 'triangle', now + 0.18)
        break
      }
      case 'nearMiss': {
        playTone(kit, 880, 0.06, 0.09, 'sine', now)
        playTone(kit, 1320, 0.08, 0.07, 'triangle', now + 0.04)
        noiseBurst(kit, now, 0.05, 0.05, 3200, 'highpass')
        break
      }
      case 'combo': {
        const base = 392 + Math.min(8, cue.n) * 40
        playTone(kit, base, 0.1, 0.1, 'triangle', now)
        playTone(kit, base * 1.5, 0.14, 0.09, 'sine', now + 0.05)
        playTone(kit, base * 2, 0.16, 0.07, 'sine', now + 0.1)
        break
      }
      case 'win': {
        winFanfare(kit, now)
        break
      }
    }
  }
}
