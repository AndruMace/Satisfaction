import { CaptureAudioEngine } from '../../shared/audio/capture'
import { noiseBurst, playTone, type AudioKit } from '../../shared/audio/kit'
import type { AudioCue, WinKind } from './types'

export type { CaptureAudioPacket } from '../../shared/audio/capture'

const PENT = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]

function winFanfare(kit: AudioKit, now: number, style: WinKind) {
  if (style === 'barely') {
    playTone(kit, 392, 0.16, 0.1, 'triangle', now)
    playTone(kit, 523.25, 0.22, 0.11, 'sine', now + 0.08)
    playTone(kit, 659.25, 0.35, 0.12, 'sine', now + 0.18)
    noiseBurst(kit, now + 0.05, 0.1, 0.06, 1800, 'highpass')
    return
  }
  if (style === 'overkill') {
    for (let i = 0; i < PENT.length; i++) {
      playTone(kit, PENT[i] * 1.01, 0.28, 0.12, 'sine', now + i * 0.04)
    }
    playTone(kit, 1046.5, 0.4, 0.1, 'triangle', now + 0.22)
    noiseBurst(kit, now, 0.22, 0.12, 2800, 'highpass')
    noiseBurst(kit, now + 0.1, 0.15, 0.1, 600, 'lowpass')
    return
  }
  for (let i = 0; i < PENT.length; i++) {
    playTone(kit, PENT[i], 0.22, 0.1, 'sine', now + i * 0.055)
  }
  noiseBurst(kit, now, 0.2, 0.09, 2200, 'highpass')
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
      case 'gate': {
        if (cue.good) {
          const base = cue.big ? 523.25 : 392
          playTone(kit, base, 0.1, 0.12, 'triangle', now)
          playTone(kit, base * 1.5, 0.14, 0.1, 'sine', now + 0.04)
          if (cue.big) {
            playTone(kit, base * 2, 0.2, 0.09, 'sine', now + 0.08)
            noiseBurst(kit, now, 0.08, 0.06, 2400, 'highpass')
          }
        } else {
          playTone(kit, 220, 0.14, 0.1, 'sawtooth', now)
          playTone(kit, 165, 0.18, 0.08, 'triangle', now + 0.05)
          noiseBurst(kit, now, 0.06, 0.05, 600, 'lowpass')
        }
        break
      }
      case 'hazard': {
        noiseBurst(kit, now, 0.1, 0.1, 900, 'bandpass')
        playTone(kit, 180, 0.12, 0.1, 'square', now)
        break
      }
      case 'nearMiss': {
        playTone(kit, 880, 0.06, 0.09, 'sine', now)
        playTone(kit, 1320, 0.08, 0.07, 'triangle', now + 0.04)
        noiseBurst(kit, now, 0.05, 0.05, 3200, 'highpass')
        break
      }
      case 'streak': {
        const base = 392 + Math.min(8, cue.n) * 40
        playTone(kit, base, 0.1, 0.1, 'triangle', now)
        playTone(kit, base * 1.5, 0.14, 0.09, 'sine', now + 0.05)
        playTone(kit, base * 2, 0.16, 0.07, 'sine', now + 0.1)
        break
      }
      case 'banner': {
        playTone(kit, 523.25, 0.12, 0.11, 'sawtooth', now)
        playTone(kit, 659.25, 0.16, 0.1, 'triangle', now + 0.06)
        noiseBurst(kit, now, 0.08, 0.06, 1400, 'bandpass')
        break
      }
      case 'tension': {
        const f = 110 + cue.ratio * 220
        playTone(kit, f, 0.18, 0.045, 'sawtooth', now)
        playTone(kit, f * 1.5, 0.22, 0.03, 'triangle', now + 0.02)
        break
      }
      case 'boss': {
        playTone(kit, 130.81, 0.25, 0.14, 'sawtooth', now)
        playTone(kit, 164.81, 0.3, 0.1, 'triangle', now + 0.08)
        noiseBurst(kit, now, 0.15, 0.07, 400, 'lowpass')
        break
      }
      case 'impact': {
        noiseBurst(kit, now, 0.18, 0.16, 500, 'lowpass')
        noiseBurst(kit, now, 0.12, 0.12, 1800, 'highpass')
        if (cue.won) {
          playTone(kit, 98, 0.2, 0.14, 'sawtooth', now)
          playTone(kit, 196, 0.25, 0.12, 'triangle', now + 0.04)
          playTone(kit, 392, 0.3, 0.1, 'sine', now + 0.1)
          if (cue.style === 'barely') {
            playTone(kit, 740, 0.12, 0.08, 'sine', now + 0.14)
          } else if (cue.style === 'overkill') {
            playTone(kit, 1046, 0.2, 0.1, 'triangle', now + 0.12)
          }
        } else {
          playTone(kit, 110, 0.28, 0.14, 'sawtooth', now)
          playTone(kit, 82, 0.4, 0.12, 'triangle', now + 0.08)
        }
        break
      }
      case 'win': {
        winFanfare(kit, now, cue.style)
        break
      }
      case 'lose': {
        playTone(kit, 196, 0.2, 0.12, 'triangle', now)
        playTone(kit, 146.83, 0.28, 0.1, 'sawtooth', now + 0.1)
        playTone(kit, 98, 0.4, 0.1, 'triangle', now + 0.2)
        break
      }
      case 'tick': {
        const idx = Math.min(PENT.length - 1, Math.floor(Math.log10(Math.max(1, cue.count))))
        playTone(kit, PENT[idx], 0.06, 0.05, 'sine', now)
        break
      }
    }
  }
}
