import {
  BRICK_SIZE,
  type Brick,
  type HealthBarrier,
  type LevelData,
  type Wall,
} from '../types'

const LEVEL_WIDTH = 540
const LEVEL_HEIGHT = 3400
const MAZE_HEIGHT = 1900
const MARGIN = 72

function brickGrid(
  startId: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
): Brick[] {
  const bricks: Brick[] = []
  let id = startId
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      bricks.push({
        id: id++,
        x: x + col * (BRICK_SIZE + 4),
        y: y + row * (BRICK_SIZE + 4),
        w: BRICK_SIZE,
        h: BRICK_SIZE,
        alive: true,
      })
    }
  }
  return bricks
}

function wall(id: number, x: number, y: number, w: number, h: number): Wall {
  return { id, x, y, w, h }
}

function healthBarrier(
  id: number,
  y: number,
  health = 10,
): HealthBarrier {
  return {
    id,
    x: 16,
    y,
    w: LEVEL_WIDTH - 32,
    h: 34,
    health,
    maxHealth: health,
    hitPulse: 0,
  }
}

export const corridorLevel: LevelData = {
  name: 'Corridor',
  bounds: { width: LEVEL_WIDTH, height: LEVEL_HEIGHT },
  racers: {
    red: { start: { x: 180, y: 120 }, velocity: { x: 80, y: 280 } },
    blue: { start: { x: 360, y: 120 }, velocity: { x: -80, y: 280 } },
  },
  walls: [
    wall(1, MARGIN, 280, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(2, MARGIN, 520, 220, 20),
    wall(3, LEVEL_WIDTH - MARGIN - 220, 760, 220, 20),
    wall(4, MARGIN, 1000, 260, 20),
    wall(5, LEVEL_WIDTH - MARGIN - 260, 1240, 260, 20),
    wall(6, MARGIN, 1480, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(7, MARGIN, 1720, 200, 20),
    wall(8, LEVEL_WIDTH - MARGIN - 200, 1960, 200, 20),
    wall(9, MARGIN, 2200, 240, 20),
    wall(10, LEVEL_WIDTH - MARGIN - 240, 2440, 240, 20),
    wall(11, MARGIN, 2680, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(12, MARGIN, 2920, 180, 20),
    wall(13, LEVEL_WIDTH - MARGIN - 180, 2920, 180, 20),
  ],
  bricks: [
    ...brickGrid(100, 280, 620, 4, 2),
    ...brickGrid(120, 300, 1120, 5, 2),
    ...brickGrid(140, 320, 1620, 4, 3),
    ...brickGrid(160, 280, 2060, 6, 2),
    ...brickGrid(180, 300, 2520, 5, 2),
  ],
  barriers: [
    healthBarrier(1000, 400),
    healthBarrier(1001, 1360),
    healthBarrier(1002, 2560),
  ],
  finishY: LEVEL_HEIGHT - 120,
}

export const gauntletLevel: LevelData = {
  name: 'Brick Gauntlet',
  bounds: { width: LEVEL_WIDTH, height: LEVEL_HEIGHT },
  racers: {
    red: { start: { x: 160, y: 120 }, velocity: { x: 110, y: 260 } },
    blue: { start: { x: 380, y: 120 }, velocity: { x: -110, y: 260 } },
  },
  walls: [
    wall(1, MARGIN, 400, 120, 20),
    wall(2, LEVEL_WIDTH - MARGIN - 120, 400, 120, 20),
    wall(3, MARGIN, 900, 120, 20),
    wall(4, LEVEL_WIDTH - MARGIN - 120, 900, 120, 20),
    wall(5, MARGIN, 1400, 120, 20),
    wall(6, LEVEL_WIDTH - MARGIN - 120, 1400, 120, 20),
    wall(7, MARGIN, 1900, 120, 20),
    wall(8, LEVEL_WIDTH - MARGIN - 120, 1900, 120, 20),
    wall(9, MARGIN, 2400, 120, 20),
    wall(10, LEVEL_WIDTH - MARGIN - 120, 2400, 120, 20),
    wall(11, MARGIN, 2900, LEVEL_WIDTH - MARGIN * 2, 20),
  ],
  bricks: [
    ...brickGrid(200, 100, 520, 8, 4),
    ...brickGrid(240, 100, 1020, 8, 5),
    ...brickGrid(280, 100, 1520, 8, 5),
    ...brickGrid(320, 100, 2020, 8, 5),
    ...brickGrid(360, 100, 2520, 8, 4),
  ],
  barriers: [
    healthBarrier(1100, 700),
    healthBarrier(1101, 1720),
    healthBarrier(1102, 2700),
  ],
  finishY: LEVEL_HEIGHT - 120,
}

export const splitLevel: LevelData = {
  name: 'Split Paths',
  bounds: { width: LEVEL_WIDTH, height: LEVEL_HEIGHT },
  racers: {
    red: { start: { x: 140, y: 120 }, velocity: { x: 60, y: 290 } },
    blue: { start: { x: 400, y: 120 }, velocity: { x: -60, y: 290 } },
  },
  walls: [
    wall(1, LEVEL_WIDTH / 2 - 10, 320, 20, 480),
    wall(2, MARGIN, 820, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(3, MARGIN, 1100, 160, 20),
    wall(4, LEVEL_WIDTH - MARGIN - 160, 1100, 160, 20),
    wall(5, MARGIN, 1380, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(6, MARGIN, 1660, 200, 20),
    wall(7, LEVEL_WIDTH - MARGIN - 200, 1660, 200, 20),
    wall(8, MARGIN, 1940, 240, 20),
    wall(9, LEVEL_WIDTH - MARGIN - 240, 1940, 240, 20),
    wall(10, MARGIN, 2220, LEVEL_WIDTH - MARGIN * 2, 20),
    wall(11, MARGIN, 2500, 180, 20),
    wall(12, LEVEL_WIDTH - MARGIN - 180, 2500, 180, 20),
    wall(13, MARGIN, 2780, LEVEL_WIDTH - MARGIN * 2, 20),
  ],
  bricks: [
    ...brickGrid(400, 80, 520, 3, 3),
    ...brickGrid(420, LEVEL_WIDTH - 180, 520, 3, 3),
    ...brickGrid(440, 120, 920, 4, 2),
    ...brickGrid(460, LEVEL_WIDTH - 220, 920, 4, 2),
    ...brickGrid(480, 160, 1480, 5, 3),
    ...brickGrid(500, 160, 2060, 5, 3),
    ...brickGrid(520, 200, 2620, 4, 2),
  ],
  barriers: [
    healthBarrier(1200, 1010),
    healthBarrier(1201, 1820),
    healthBarrier(1202, 2700),
  ],
  finishY: LEVEL_HEIGHT - 120,
}

export const twistingMazeLevel: LevelData = {
  name: 'Twisting Maze',
  bounds: { width: LEVEL_WIDTH, height: MAZE_HEIGHT },
  racers: {
    red: { start: { x: 150, y: 110 }, velocity: { x: 130, y: 260 } },
    blue: { start: { x: 390, y: 110 }, velocity: { x: -130, y: 260 } },
  },
  walls: [
    // Alternating L-shaped chambers create a compact serpentine maze.
    wall(600, MARGIN, 260, 330, 18),
    wall(601, 382, 260, 18, 210),
    wall(602, 138, 470, 330, 18),
    wall(603, 138, 470, 18, 210),
    wall(604, MARGIN, 680, 330, 18),
    wall(605, 382, 680, 18, 210),
    wall(606, 138, 890, 330, 18),
    wall(607, 138, 890, 18, 210),
    wall(608, MARGIN, 1100, 330, 18),
    wall(609, 382, 1100, 18, 210),
    wall(610, 138, 1310, 330, 18),
    wall(611, 138, 1310, 18, 210),
    wall(612, MARGIN, 1520, 330, 18),
    wall(613, 382, 1520, 18, 170),

    // Short interior fins add secondary turns without sealing the route.
    wall(620, 250, 330, 18, 80),
    wall(621, 272, 540, 18, 80),
    wall(622, 250, 750, 18, 80),
    wall(623, 272, 960, 18, 80),
    wall(624, 250, 1170, 18, 80),
    wall(625, 272, 1380, 18, 80),
  ],
  bricks: [
    ...brickGrid(600, 418, 340, 2, 3),
    ...brickGrid(620, 58, 550, 2, 3),
    ...brickGrid(640, 418, 760, 2, 3),
    ...brickGrid(660, 58, 970, 2, 3),
    ...brickGrid(680, 418, 1180, 2, 3),
    ...brickGrid(700, 58, 1390, 2, 3),
    ...brickGrid(720, 418, 1590, 2, 2),
  ],
  barriers: [
    healthBarrier(1300, 180),
    healthBarrier(1301, 1710),
  ],
  finishY: MAZE_HEIGHT - 100,
}

export const presetLevels = [
  corridorLevel,
  gauntletLevel,
  splitLevel,
  twistingMazeLevel,
]

export type PresetId = 'corridor' | 'gauntlet' | 'split' | 'maze'

export function getPreset(id: PresetId): LevelData {
  switch (id) {
    case 'corridor':
      return corridorLevel
    case 'gauntlet':
      return gauntletLevel
    case 'split':
      return splitLevel
    case 'maze':
      return twistingMazeLevel
  }
}
