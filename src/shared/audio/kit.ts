/** Shared Web Audio primitives for spectator game SFX. */

export type AudioKit = {
  ctx: AudioContext
  master: GainNode
  noiseBuffer: AudioBuffer
}

export function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

/** Map impact speed to 0–1 loudness / brightness scale. */
export function impactIntensity(speed: number | undefined, baselineSpeed: number): number {
  const s = speed ?? baselineSpeed
  return Math.max(0, Math.min(1, (s - baselineSpeed * 0.55) / (baselineSpeed * 0.9)))
}

export function noiseBurst(
  kit: AudioKit,
  when: number,
  duration: number,
  volume: number,
  filterFreq: number,
  filterType: BiquadFilterType,
) {
  const { ctx, master, noiseBuffer } = kit
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  filter.Q.value = filterType === 'bandpass' ? 1.2 : 0.7
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(when)
  src.stop(when + duration + 0.02)
}

export function playTone(
  kit: AudioKit,
  freq: number,
  duration: number,
  volume: number,
  type: OscillatorType,
  when: number,
  detune = 0,
  filterFreq = 1800,
) {
  const { ctx, master } = kit
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune

  filter.type = 'lowpass'
  filter.frequency.value = filterFreq

  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), when + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)

  osc.start(when)
  osc.stop(when + duration + 0.03)
}
