import { CaptureAudioEngine } from '../../shared/audio/capture'
import { noiseBurst, playTone } from '../../shared/audio/kit'
import { profileIndex } from '../../shared/profiles'
import type { AgentId, GrabEvent } from './types'

const COIN_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77]

export type FinishAudioOptions = {
  jackpot?: boolean
  byElimination?: boolean
}

export class AudioEngine extends CaptureAudioEngine {
  resetRound() {}

  playCountdownBeep(step: number) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    if (step <= 0) {
      noiseBurst(kit, now, 0.12, 0.1, 2200, 'highpass')
      playTone(kit, 523.25, 0.22, 0.18, 'triangle', now)
      playTone(kit, 659.25, 0.26, 0.14, 'sine', now + 0.03)
      playTone(kit, 783.99, 0.3, 0.1, 'sine', now + 0.06)
      return
    }
    playTone(kit, 392.0, 0.1, 0.11, 'sine', now)
    noiseBurst(kit, now, 0.04, 0.03, 1800, 'bandpass')
  }

  playEvent(event: GrabEvent) {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const playerIndex = profileIndex(event.agentId)
    const detune = (playerIndex - 2.5) * 6

    if (event.kind === 'coin') {
      // Pitch climbs with mass — greed gets louder/higher
      const massT = Math.min(1, (event.mass - 1) / 14)
      const note = COIN_NOTES[Math.min(COIN_NOTES.length - 1, Math.floor(massT * COIN_NOTES.length))]
      const pitch = note * (1 + massT * 0.55)
      playTone(kit, pitch, 0.07 + massT * 0.04, 0.09 + massT * 0.06, 'triangle', now, detune)
      playTone(kit, pitch * 1.5, 0.05, 0.05 + massT * 0.04, 'sine', now + 0.01, detune)
      noiseBurst(kit, now, 0.03, 0.025 + massT * 0.03, 2400 + massT * 800, 'highpass')
      return
    }

    if (event.kind === 'bank') {
      const root = COIN_NOTES[playerIndex % COIN_NOTES.length]
      playTone(kit, root, 0.12, 0.1, 'sine', now, detune)
      playTone(kit, root * 1.25, 0.14, 0.09, 'triangle', now + 0.05, detune)
      playTone(kit, root * 1.5, 0.16, 0.07, 'sine', now + 0.1, detune)
      return
    }

    if (event.kind === 'fall') {
      // Whoosh into the void
      noiseBurst(kit, now, 0.28, 0.14, 500, 'lowpass')
      noiseBurst(kit, now + 0.05, 0.22, 0.1, 1600, 'highpass')
      const root = COIN_NOTES[playerIndex % 5]
      playTone(kit, root, 0.2, 0.1, 'triangle', now, -12)
      playTone(kit, root * 0.75, 0.24, 0.09, 'sine', now + 0.08)
      playTone(kit, root * 0.5, 0.32, 0.08, 'triangle', now + 0.18, -20)
      playTone(kit, root * 0.35, 0.35, 0.06, 'sine', now + 0.28)
      return
    }

    if (event.kind === 'jump') {
      const massT = Math.min(1, (event.mass - 1) / 12)
      playTone(kit, 220 * (1 - massT * 0.3), 0.08, 0.05, 'triangle', now, detune)
      noiseBurst(kit, now, 0.04, 0.03, 900, 'bandpass')
    }
  }

  playFinish(winner: AgentId, options: FinishAudioOptions = {}) {
    const kit = this.getKit()
    if (!kit) return
    const playerIndex = profileIndex(winner)
    const root = COIN_NOTES[playerIndex % COIN_NOTES.length]
    const now = kit.ctx.currentTime

    if (options.jackpot) {
      // Jackpot cascade — rising coin shower
      noiseBurst(kit, now, 0.2, 0.1, 1400, 'bandpass')
      const notes = [root, root * 1.25, root * 1.5, root * 2, root * 2.5, root * 3]
      notes.forEach((freq, i) => {
        playTone(kit, freq, 0.28, 0.13 - i * 0.01, 'triangle', now + i * 0.07)
        playTone(kit, freq * 1.5, 0.12, 0.05, 'sine', now + i * 0.07 + 0.03)
      })
      noiseBurst(kit, now + 0.45, 0.18, 0.08, 2200, 'highpass')
      return
    }

    if (options.byElimination) {
      noiseBurst(kit, now, 0.16, 0.08, 1100, 'bandpass')
      const notes = [root, root * 1.25, root * 1.5, root * 2]
      notes.forEach((freq, i) => {
        playTone(kit, freq, 0.36, 0.13 - i * 0.015, 'triangle', now + i * 0.1)
      })
      return
    }

    noiseBurst(kit, now, 0.15, 0.07, 1200, 'bandpass')
    const notes = [root, root * 1.25, root * 1.5, root * 2]
    notes.forEach((freq, i) => {
      playTone(kit, freq, 0.34, 0.14, 'sine', now + i * 0.1)
    })
    playTone(kit, root * 3, 0.4, 0.07, 'sine', now + 0.38)
  }

  playEventStinger(kind: 'rain' | 'magnet' | 'floor' | 'surge' | 'jackpot') {
    const kit = this.getKit()
    if (!kit) return
    const now = kit.ctx.currentTime
    const map = {
      rain: [523.25, 659.25, 783.99],
      magnet: [329.63, 392.0, 493.88],
      floor: [220.0, 277.18, 329.63],
      surge: [440.0, 554.37, 659.25],
      jackpot: [523.25, 659.25, 783.99, 1046.5],
    } as const
    noiseBurst(kit, now, 0.09, 0.05, kind === 'floor' ? 700 : 1600, 'bandpass')
    map[kind].forEach((freq, i) => {
      playTone(kit, freq, 0.14, 0.09, 'sine', now + i * 0.06)
    })
  }
}

export const audioEngine = new AudioEngine()
