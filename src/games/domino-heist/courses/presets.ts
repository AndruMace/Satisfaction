import type { BlockerSpec, LevelData, MissingTooth, Platform } from '../types'

const LEVEL_WIDTH = 540
const MARGIN = 40

function platform(id: number, x: number, y: number, w: number, h = 10): Platform {
  return { id, x, y, w, h }
}

function tooth(chainSlot: number, afterIndex: number, gapPx = 38): MissingTooth {
  return { chainSlot, afterIndex, gapPx }
}

function blocker(
  id: number,
  y: number,
  speed: number,
  width = 48,
  height = 18,
  phase = 0,
): BlockerSpec {
  return { id, y, speed, width, height, phase }
}

function baseLevel(
  name: string,
  height: number,
  chainLength: number,
  stepY: number,
  platforms: Platform[],
  missingTeeth: MissingTooth[],
  blockers: BlockerSpec[],
): LevelData {
  const startY = 110
  return {
    name,
    bounds: { width: LEVEL_WIDTH, height },
    platforms,
    missingTeeth,
    blockers,
    stepY,
    chainLength,
    vaultY: height - 90,
    startY,
  }
}

/** Straight lanes with a few platform shelves. */
export const vaultRunLevel: LevelData = baseLevel(
  'Vault Run',
  2200,
  28,
  58,
  [
    platform(1, MARGIN, 280, LEVEL_WIDTH - MARGIN * 2),
    platform(2, MARGIN, 620, 200),
    platform(3, LEVEL_WIDTH - MARGIN - 200, 620, 200),
    platform(4, MARGIN, 980, LEVEL_WIDTH - MARGIN * 2),
    platform(5, MARGIN + 60, 1340, LEVEL_WIDTH - MARGIN * 2 - 120),
    platform(6, MARGIN, 1700, LEVEL_WIDTH - MARGIN * 2),
  ],
  [tooth(0, 8), tooth(2, 14), tooth(1, 18)],
  [blocker(1, 520, 90, 52, 16, 0.1), blocker(2, 1100, 110, 56, 18, 0.55), blocker(3, 1520, 130, 48, 16, 0.3)],
)

/** Dense gaps — chains stall without tip force. */
export const gapGauntletLevel: LevelData = baseLevel(
  'Gap Gauntlet',
  2400,
  30,
  56,
  [
    platform(1, MARGIN, 300, LEVEL_WIDTH - MARGIN * 2),
    platform(2, MARGIN, 540, 160),
    platform(3, LEVEL_WIDTH - MARGIN - 160, 700, 160),
    platform(4, 140, 900, 260),
    platform(5, MARGIN, 1180, LEVEL_WIDTH - MARGIN * 2),
    platform(6, MARGIN + 80, 1500, 180),
    platform(7, LEVEL_WIDTH - MARGIN - 180, 1500, 180),
    platform(8, MARGIN, 1840, LEVEL_WIDTH - MARGIN * 2),
  ],
  [
    tooth(0, 5, 44),
    tooth(0, 12, 40),
    tooth(1, 7, 46),
    tooth(1, 16, 42),
    tooth(2, 9, 44),
    tooth(2, 19, 40),
    tooth(4, 10, 40),
    tooth(5, 8, 44),
  ],
  [
    blocker(1, 480, 100, 50, 16, 0.2),
    blocker(2, 820, 140, 54, 18, 0.7),
    blocker(3, 1260, 120, 48, 16, 0.4),
    blocker(4, 1680, 160, 58, 18, 0.15),
  ],
)

/** Heavy cross-traffic mid-course. */
export const crossfireLevel: LevelData = baseLevel(
  'Crossfire',
  2300,
  26,
  60,
  [
    platform(1, MARGIN, 260, LEVEL_WIDTH - MARGIN * 2),
    platform(2, MARGIN, 720, LEVEL_WIDTH - MARGIN * 2),
    platform(3, MARGIN, 1180, 220),
    platform(4, LEVEL_WIDTH - MARGIN - 220, 1180, 220),
    platform(5, MARGIN, 1640, LEVEL_WIDTH - MARGIN * 2),
  ],
  [tooth(0, 10), tooth(1, 13), tooth(2, 7), tooth(3, 16), tooth(4, 11)],
  [
    blocker(1, 400, 150, 60, 18, 0),
    blocker(2, 560, 170, 54, 16, 0.5),
    blocker(3, 880, 160, 58, 18, 0.25),
    blocker(4, 1040, 180, 52, 16, 0.75),
    blocker(5, 1400, 155, 56, 18, 0.35),
    blocker(6, 1560, 175, 50, 16, 0.85),
  ],
)

/** Tight finish into the vault. */
export const alarmSprintLevel: LevelData = baseLevel(
  'Alarm Sprint',
  2100,
  24,
  62,
  [
    platform(1, MARGIN, 240, LEVEL_WIDTH - MARGIN * 2),
    platform(2, MARGIN + 40, 560, LEVEL_WIDTH - MARGIN * 2 - 80),
    platform(3, MARGIN, 900, LEVEL_WIDTH - MARGIN * 2),
    platform(4, MARGIN + 100, 1240, LEVEL_WIDTH - MARGIN * 2 - 200),
    platform(5, MARGIN, 1580, LEVEL_WIDTH - MARGIN * 2),
  ],
  [tooth(0, 6), tooth(1, 9), tooth(2, 12), tooth(3, 8), tooth(4, 14), tooth(5, 10)],
  [blocker(1, 700, 120, 48, 16, 0.4), blocker(2, 1100, 145, 52, 18, 0.1), blocker(3, 1450, 165, 56, 16, 0.6)],
)

export type PresetId = 'vault-run' | 'gap-gauntlet' | 'crossfire' | 'alarm-sprint'

export const presetLevels: LevelData[] = [
  vaultRunLevel,
  gapGauntletLevel,
  crossfireLevel,
  alarmSprintLevel,
]

const PRESET_MAP: Record<PresetId, LevelData> = {
  'vault-run': vaultRunLevel,
  'gap-gauntlet': gapGauntletLevel,
  crossfire: crossfireLevel,
  'alarm-sprint': alarmSprintLevel,
}

export function getPreset(id: PresetId): LevelData {
  return PRESET_MAP[id]
}
