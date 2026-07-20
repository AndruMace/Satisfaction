import type { CourseData } from '../types'

const TAU = Math.PI * 2

/** Mulberry32 — deterministic 0–1 from seed. */
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

export function generateProceduralCourse(seed: number): CourseData {
  const rnd = mulberry32(seed || 1)
  const beamCount = 2 + Math.floor(rnd() * 3) // 2–4
  const baseSpeed = 0.55 + rnd() * 0.55
  const beams: CourseData['beams'] = []

  for (let i = 0; i < beamCount; i++) {
    const sign = rnd() < 0.5 ? -1 : 1
    beams.push({
      angle: (TAU * i) / beamCount + rnd() * 0.4,
      angularSpeed: sign * (baseSpeed + rnd() * 0.45 + i * 0.08),
      halfWidth: 0.038 + rnd() * 0.022,
      length: 0.88 + rnd() * 0.12,
    })
  }

  return {
    name: `Proc ${seed.toString(16).slice(0, 4)}`,
    beams,
    hubClear: 0.2 + rnd() * 0.09,
    escalateAt: 3.2 + rnd() * 4,
    mistakeBias: 0.1 + rnd() * 0.16,
    surviveSeconds: 16 + Math.floor(rnd() * 14),
  }
}
