import {
  type Coin,
  type Deposit,
  type LevelData,
  type MagnetWell,
  type Pit,
  type Platform,
  VIEW_WIDTH,
} from '../types'

const W = VIEW_WIDTH
const H = 1400

function platform(
  id: number,
  x: number,
  y: number,
  w: number,
  h = 18,
  sinkMass = 0,
): Platform {
  return { id, x, y, w, h, sinkMass }
}

function pit(id: number, x: number, y: number, w: number, h: number): Pit {
  return { id, x, y, w, h }
}

function deposit(id: number, x: number, y: number, w: number, h: number): Deposit {
  return { id, x, y, w, h }
}

function magnet(
  id: number,
  x: number,
  y: number,
  radius: number,
  strength: number,
): MagnetWell {
  return { id, x, y, radius, strength }
}

function coinCluster(
  startId: number,
  cx: number,
  cy: number,
  count: number,
  spread = 40,
): Coin[] {
  const coins: Coin[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const r = spread * (0.35 + (i % 3) * 0.2)
    coins.push({
      id: startId + i,
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.55,
      value: 1 + (i % 3 === 0 ? 1 : 0),
      alive: true,
      vx: 0,
      vy: 0,
      spark: 0,
    })
  }
  return coins
}

function spawnRow(y: number, count: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    points.push({ x: 70 + (i * (W - 140)) / Math.max(1, count - 1), y })
  }
  return points
}

/** Safe banking — deposits matter, lighter pits. */
export const vaultLevel: LevelData = {
  name: 'Vault',
  bounds: { width: W, height: H },
  platforms: [
    platform(1, 40, 180, W - 80, 18, 0),
    platform(2, 30, 340, 200, 18, 8),
    platform(3, W - 230, 340, 200, 18, 8),
    platform(4, 120, 500, 300, 18, 10),
    platform(5, 40, 660, 180, 18, 6),
    platform(6, W - 220, 660, 180, 18, 6),
    platform(7, 90, 820, 360, 18, 12),
    platform(8, 50, 980, 160, 18, 5),
    platform(9, W - 210, 980, 160, 18, 5),
    platform(10, 100, 1140, 340, 18, 14),
  ],
  pits: [
    pit(1, 0, H - 80, W, 80),
    pit(2, 220, 700, 100, 40),
  ],
  deposits: [
    deposit(1, 40, 150, 90, 30),
    deposit(2, W - 130, 150, 90, 30),
    deposit(3, W / 2 - 50, 470, 100, 30),
    deposit(4, W / 2 - 50, 1110, 100, 30),
  ],
  magnets: [],
  coins: [
    ...coinCluster(1, 140, 300, 7),
    ...coinCluster(20, W - 140, 300, 7),
    ...coinCluster(40, W / 2, 460, 9, 55),
    ...coinCluster(60, 130, 620, 6),
    ...coinCluster(80, W - 130, 620, 6),
    ...coinCluster(100, W / 2, 780, 10, 60),
    ...coinCluster(120, 140, 940, 5),
    ...coinCluster(140, W - 140, 940, 5),
    ...coinCluster(160, W / 2, 1100, 8, 50),
  ],
  spawnPoints: spawnRow(164, 6),
  bankTarget: 12,
  floorStartY: H - 40,
  floorSpeed: 18,
}

/** Pure greed — dense coins, deadly gaps, weak deposits. */
export const feverLevel: LevelData = {
  name: 'Fever',
  bounds: { width: W, height: H },
  platforms: [
    platform(1, 60, 200, W - 120, 16, 0),
    platform(2, 20, 360, 150, 16, 5),
    platform(3, W / 2 - 70, 380, 140, 16, 4),
    platform(4, W - 170, 360, 150, 16, 5),
    platform(5, 80, 540, 120, 16, 3),
    platform(6, W - 200, 540, 120, 16, 3),
    platform(7, 40, 700, 200, 16, 6),
    platform(8, W - 240, 720, 200, 16, 6),
    platform(9, 160, 880, 220, 16, 4),
    platform(10, 30, 1040, 140, 16, 3),
    platform(11, W - 170, 1040, 140, 16, 3),
    platform(12, 100, 1180, 340, 16, 8),
  ],
  pits: [
    pit(1, 0, H - 70, W, 70),
    pit(2, 180, 400, 80, 50),
    pit(3, W - 260, 580, 90, 50),
    pit(4, 220, 760, 100, 40),
  ],
  deposits: [deposit(1, W / 2 - 40, 170, 80, 28)],
  magnets: [],
  coins: [
    ...coinCluster(1, 100, 320, 8, 35),
    ...coinCluster(20, W / 2, 340, 10, 45),
    ...coinCluster(40, W - 100, 320, 8, 35),
    ...coinCluster(60, 140, 500, 7),
    ...coinCluster(80, W - 140, 500, 7),
    ...coinCluster(100, W / 2, 660, 12, 70),
    ...coinCluster(120, 140, 840, 8),
    ...coinCluster(140, W - 140, 840, 8),
    ...coinCluster(160, W / 2, 1000, 11, 55),
    ...coinCluster(180, W / 2, 1140, 9, 50),
  ],
  spawnPoints: spawnRow(184, 6),
  bankTarget: 0,
  floorStartY: H - 30,
  floorSpeed: 28,
}

/** Magnet wells yank coins and heavy agents. */
export const magnetsLevel: LevelData = {
  name: 'Magnets',
  bounds: { width: W, height: H },
  platforms: [
    platform(1, 40, 190, W - 80, 18, 0),
    platform(2, 40, 370, 180, 18, 7),
    platform(3, W - 220, 370, 180, 18, 7),
    platform(4, 140, 560, 260, 18, 9),
    platform(5, 30, 750, 200, 18, 6),
    platform(6, W - 230, 750, 200, 18, 6),
    platform(7, 80, 940, 380, 18, 11),
    platform(8, 60, 1120, 180, 18, 5),
    platform(9, W - 240, 1120, 180, 18, 5),
  ],
  pits: [pit(1, 0, H - 75, W, 75), pit(2, W / 2 - 45, 620, 90, 45)],
  deposits: [
    deposit(1, 50, 160, 80, 28),
    deposit(2, W - 130, 160, 80, 28),
    deposit(3, W / 2 - 40, 530, 80, 28),
    deposit(4, 80, 910, 80, 28),
    deposit(5, W - 160, 910, 80, 28),
  ],
  magnets: [
    magnet(1, W / 2, 480, 110, 180),
    magnet(2, 160, 850, 90, 160),
    magnet(3, W - 160, 850, 90, 160),
    magnet(4, W / 2, 1050, 100, 200),
  ],
  coins: [
    ...coinCluster(1, 120, 330, 6),
    ...coinCluster(20, W - 120, 330, 6),
    ...coinCluster(40, W / 2, 520, 10, 55),
    ...coinCluster(60, 140, 710, 7),
    ...coinCluster(80, W - 140, 710, 7),
    ...coinCluster(100, W / 2, 900, 9, 50),
    ...coinCluster(120, 150, 1080, 6),
    ...coinCluster(140, W - 150, 1080, 6),
  ],
  spawnPoints: spawnRow(174, 6),
  bankTarget: 10,
  floorStartY: H - 35,
  floorSpeed: 20,
}

/** Floor rises fast — bank or get crushed into the void. */
export const squeezeLevel: LevelData = {
  name: 'Squeeze',
  bounds: { width: W, height: 1200 },
  platforms: [
    platform(1, 50, 160, W - 100, 16, 0),
    platform(2, 40, 300, 160, 16, 5),
    platform(3, W - 200, 300, 160, 16, 5),
    platform(4, 120, 440, 300, 16, 7),
    platform(5, 30, 580, 170, 16, 4),
    platform(6, W - 200, 580, 170, 16, 4),
    platform(7, 90, 720, 360, 16, 9),
    platform(8, 50, 860, 150, 16, 3),
    platform(9, W - 200, 860, 150, 16, 3),
    platform(10, 100, 1000, 340, 16, 10),
  ],
  pits: [pit(1, 0, 1120, W, 80)],
  deposits: [
    deposit(1, W / 2 - 45, 130, 90, 28),
    deposit(2, 40, 970, 80, 28),
    deposit(3, W - 120, 970, 80, 28),
  ],
  magnets: [magnet(1, W / 2, 650, 80, 140)],
  coins: [
    ...coinCluster(1, 120, 260, 6),
    ...coinCluster(20, W - 120, 260, 6),
    ...coinCluster(40, W / 2, 400, 8, 45),
    ...coinCluster(60, 120, 540, 5),
    ...coinCluster(80, W - 120, 540, 5),
    ...coinCluster(100, W / 2, 680, 9, 50),
    ...coinCluster(120, 130, 820, 5),
    ...coinCluster(140, W - 130, 820, 5),
    ...coinCluster(160, W / 2, 960, 8, 45),
  ],
  spawnPoints: spawnRow(144, 6),
  bankTarget: 8,
  floorStartY: 1100,
  floorSpeed: 42,
}

export type PresetId = 'vault' | 'fever' | 'magnets' | 'squeeze'

const PRESETS: Record<PresetId, LevelData> = {
  vault: vaultLevel,
  fever: feverLevel,
  magnets: magnetsLevel,
  squeeze: squeezeLevel,
}

export const presetLevels = Object.values(PRESETS)

export function getPreset(id: PresetId): LevelData {
  return structuredClone(PRESETS[id])
}
