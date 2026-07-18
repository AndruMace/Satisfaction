import {
  ARENA_PADDING,
  DEFAULT_MAX_RADIUS,
  type LevelData,
  MAX_SPIKES,
  type Spike,
  type WallSeg,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../types'

export type PresetId = 'arena' | 'gauntlet' | 'cage' | 'pit'

function wall(id: number, x: number, y: number, w: number, h: number): WallSeg {
  return { id, x, y, w, h }
}

function spike(
  id: number,
  x: number,
  y: number,
  angle: number,
  length = 22,
  descending = false,
): Spike {
  return { id, x, y, angle, length, descending }
}

function rimWalls(): WallSeg[] {
  const t = 18
  return [
    wall(1, 0, 0, VIEW_WIDTH, t),
    wall(2, 0, VIEW_HEIGHT - t, VIEW_WIDTH, t),
    wall(3, 0, 0, t, VIEW_HEIGHT),
    wall(4, VIEW_WIDTH - t, 0, t, VIEW_HEIGHT),
  ]
}

/** Evenly space spikes along a horizontal edge. */
function rowSpikes(
  startId: number,
  y: number,
  count: number,
  angle: number,
  descending = false,
): Spike[] {
  const spikes: Spike[] = []
  const inset = ARENA_PADDING + 36
  const span = VIEW_WIDTH - inset * 2
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    spikes.push(
      spike(startId + i, inset + span * t, y, angle, 20 + (i % 3) * 2, descending),
    )
  }
  return spikes
}

function sideSpikes(startId: number, count: number): Spike[] {
  const spikes: Spike[] = []
  const top = ARENA_PADDING + 80
  const bottom = VIEW_HEIGHT - ARENA_PADDING - 80
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const y = top + (bottom - top) * t
    spikes.push(spike(startId + i * 2, ARENA_PADDING + 8, y, 0, 18))
    spikes.push(
      spike(startId + i * 2 + 1, VIEW_WIDTH - ARENA_PADDING - 8, y, Math.PI, 18),
    )
  }
  return spikes
}

export const arenaLevel: LevelData = {
  name: 'Open Arena',
  bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
  walls: rimWalls(),
  spikes: [
    ...rowSpikes(10, ARENA_PADDING + 14, 5, Math.PI / 2, true),
    ...sideSpikes(30, 3),
  ].slice(0, MAX_SPIKES),
  margin: ARENA_PADDING,
  maxRadius: DEFAULT_MAX_RADIUS,
}

export const gauntletLevel: LevelData = {
  name: 'Spike Gauntlet',
  bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
  walls: [
    ...rimWalls(),
    wall(5, 120, 520, 80, 18),
    wall(6, VIEW_WIDTH - 200, 640, 80, 18),
    wall(7, 160, 760, 100, 18),
    wall(8, VIEW_WIDTH - 260, 860, 100, 18),
  ],
  spikes: [
    ...rowSpikes(10, ARENA_PADDING + 12, 7, Math.PI / 2, true),
    ...rowSpikes(20, 560, 4, Math.PI / 2),
    ...rowSpikes(28, 780, 4, -Math.PI / 2),
    ...sideSpikes(40, 4),
  ].slice(0, MAX_SPIKES),
  margin: ARENA_PADDING,
  maxRadius: 86,
}

export const cageLevel: LevelData = {
  name: 'Iron Cage',
  bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
  walls: [
    ...rimWalls(),
    wall(5, 90, 200, 18, 160),
    wall(6, VIEW_WIDTH - 108, 200, 18, 160),
    wall(7, 90, 580, 18, 200),
    wall(8, VIEW_WIDTH - 108, 580, 18, 200),
    wall(9, 180, 560, 180, 16),
  ],
  spikes: [
    ...rowSpikes(10, ARENA_PADDING + 10, 6, Math.PI / 2, true),
    spike(40, 99, 260, 0, 16),
    spike(41, VIEW_WIDTH - 99, 260, Math.PI, 16),
    spike(42, 99, 680, 0, 16),
    spike(43, VIEW_WIDTH - 99, 680, Math.PI, 16),
    ...sideSpikes(50, 2),
  ].slice(0, MAX_SPIKES),
  margin: ARENA_PADDING,
  maxRadius: 80,
}

export const pitLevel: LevelData = {
  name: 'The Pit',
  bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
  walls: [
    ...rimWalls(),
    wall(5, 40, VIEW_HEIGHT - 160, 140, 22),
    wall(6, VIEW_WIDTH - 180, VIEW_HEIGHT - 160, 140, 22),
    wall(7, VIEW_WIDTH / 2 - 70, 560, 140, 18),
  ],
  spikes: [
    ...rowSpikes(10, ARENA_PADDING + 10, 8, Math.PI / 2, true),
    ...rowSpikes(30, VIEW_HEIGHT - ARENA_PADDING - 12, 6, -Math.PI / 2),
    spike(50, VIEW_WIDTH / 2, 578, Math.PI / 2, 20),
    spike(51, VIEW_WIDTH / 2 - 50, 578, Math.PI / 2, 16),
    spike(52, VIEW_WIDTH / 2 + 50, 578, Math.PI / 2, 16),
    ...sideSpikes(60, 5),
  ].slice(0, MAX_SPIKES),
  margin: ARENA_PADDING,
  maxRadius: 88,
}

export const presetLevels: LevelData[] = [
  arenaLevel,
  gauntletLevel,
  cageLevel,
  pitLevel,
]

export function getPreset(id: PresetId): LevelData {
  switch (id) {
    case 'gauntlet':
      return gauntletLevel
    case 'cage':
      return cageLevel
    case 'pit':
      return pitLevel
    default:
      return arenaLevel
  }
}
