import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { generateProceduralLevel, randomSeed } from './courses/procedural'
import { getPreset, type PresetId, presetLevels } from './courses/presets'
import {
  DEFAULT_RUN_SETTINGS,
  type RaceMetrics,
  type RunSettings,
  scoreRace,
  SETTING_TOGGLES,
} from './settings'
import type { LevelData, PlayerShape } from './types'
import { PRESSURE_WALL_CHEVRON_ANGLE } from './types'

export type CourseChoice = PresetId | 'procedural'

const PRESET_OPTIONS: { id: CourseChoice; label: string }[] = [
  { id: 'corridor', label: 'Corridor' },
  { id: 'gauntlet', label: 'Gauntlet' },
  { id: 'split', label: 'Split' },
  { id: 'maze', label: 'Twisting Maze' },
  { id: 'procedural', label: 'Procedural' },
]

export { PRESET_OPTIONS }

function resolveLevel(choice: CourseChoice, seed: number): LevelData {
  if (choice === 'procedural') return generateProceduralLevel(seed)
  return getPreset(choice)
}

export type BounceRaceSession = {
  course: CourseChoice
  setCourse: (course: CourseChoice) => void
  seed: number
  newSeed: () => void
  nextPreset: () => void
  reelKey: number
  startReel: () => void
  randomizeBounces: boolean
  setRandomizeBounces: (enabled: boolean) => void
  playerShape: PlayerShape
  setPlayerShape: (shape: PlayerShape) => void
  barrierHealth: number
  setBarrierHealth: (value: number) => void
  wallSpeed: number
  setWallSpeed: (value: number) => void
  chevronAngle: number
  setChevronAngle: (value: number) => void
  crushMargin: number
  setCrushMargin: (value: number) => void
  settings: RunSettings
  toggleSetting: (key: keyof RunSettings) => void
  setGroup: (group: string, enabled: boolean) => void
  showSpectacle: boolean
  setShowSpectacle: (show: boolean) => void
  reelStatus: string | null
  setReelStatus: (status: string | null) => void
  highlights: RaceMetrics[]
  setHighlights: (metrics: RaceMetrics[]) => void
  lastMetrics: RaceMetrics | null
  setLastMetrics: (metrics: RaceMetrics | null) => void
  level: LevelData
  levelHint: string
  scoreRace: typeof scoreRace
  SETTING_TOGGLES: typeof SETTING_TOGGLES
}

const BounceRaceContext = createContext<BounceRaceSession | null>(null)

export function BounceRaceProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseChoice>('corridor')
  const [seed, setSeed] = useState(() => randomSeed())
  const [reelKey, setReelKey] = useState(0)
  const [randomizeBounces, setRandomizeBounces] = useState(false)
  const [playerShape, setPlayerShape] = useState<PlayerShape>('ball')
  const [barrierHealth, setBarrierHealth] = useState(25)
  const [wallSpeed, setWallSpeed] = useState(50)
  const [chevronAngle, setChevronAngle] = useState(PRESSURE_WALL_CHEVRON_ANGLE)
  /** Extra px of squeeze forgiveness before a racer is crushed (default slightly forgiving). */
  const [crushMargin, setCrushMargin] = useState(6)
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN_SETTINGS })
  const [showSpectacle, setShowSpectacle] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<RaceMetrics[]>([])
  const [lastMetrics, setLastMetrics] = useState<RaceMetrics | null>(null)

  const level = useMemo(() => resolveLevel(course, seed), [course, seed])

  const setCourse = (next: CourseChoice) => {
    setCourseState(next)
    if (next === 'procedural') setSeed(randomSeed())
  }

  const newSeed = () => {
    setSeed(randomSeed())
  }

  const nextPreset = () => {
    const idx = PRESET_OPTIONS.findIndex((o) => o.id === course)
    const next = PRESET_OPTIONS[(idx + 1) % PRESET_OPTIONS.length]
    setCourse(next.id)
  }

  const startReel = () => {
    setHighlights([])
    setReelStatus('Collecting races…')
    setReelKey((k) => k + 1)
  }

  const toggleSetting = (key: keyof RunSettings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }))
  }

  const setGroup = (group: string, enabled: boolean) => {
    setSettings((current) => {
      const next = { ...current }
      for (const toggle of SETTING_TOGGLES) {
        if (toggle.group === group) next[toggle.key] = enabled
      }
      return next
    })
  }

  const levelHint = `${level.name} · ${presetLevels.some((p) => p.name === level.name) ? 'preset' : 'procedural'}`

  const value: BounceRaceSession = {
    course,
    setCourse,
    seed,
    newSeed,
    nextPreset,
    reelKey,
    startReel,
    randomizeBounces,
    setRandomizeBounces,
    playerShape,
    setPlayerShape,
    barrierHealth,
    setBarrierHealth,
    wallSpeed,
    setWallSpeed,
    chevronAngle,
    setChevronAngle,
    crushMargin,
    setCrushMargin,
    settings,
    toggleSetting,
    setGroup,
    showSpectacle,
    setShowSpectacle,
    reelStatus,
    setReelStatus,
    highlights,
    setHighlights,
    lastMetrics,
    setLastMetrics,
    level,
    levelHint,
    scoreRace,
    SETTING_TOGGLES,
  }

  return (
    <BounceRaceContext.Provider value={value}>{children}</BounceRaceContext.Provider>
  )
}

export function useBounceRace(): BounceRaceSession {
  const ctx = useContext(BounceRaceContext)
  if (!ctx) throw new Error('useBounceRace must be used within BounceRaceProvider')
  return ctx
}
