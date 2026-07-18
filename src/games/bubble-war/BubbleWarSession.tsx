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
  type BubbleMetrics,
  type RunSettings,
  scoreMatch,
  SETTING_TOGGLES,
} from './settings'
import type { LevelData } from './types'

export type CourseChoice = PresetId | 'procedural'

const PRESET_OPTIONS: { id: CourseChoice; label: string }[] = [
  { id: 'arena', label: 'Arena' },
  { id: 'gauntlet', label: 'Gauntlet' },
  { id: 'cage', label: 'Cage' },
  { id: 'pit', label: 'The Pit' },
  { id: 'procedural', label: 'Procedural' },
]

export { PRESET_OPTIONS }

function resolveLevel(
  choice: CourseChoice,
  seed: number,
  hazardDensity: number,
): LevelData {
  if (choice === 'procedural') return generateProceduralLevel(seed, hazardDensity)
  return getPreset(choice)
}

export type BubbleWarSession = {
  course: CourseChoice
  setCourse: (course: CourseChoice) => void
  seed: number
  newSeed: () => void
  nextPreset: () => void
  reelKey: number
  startReel: () => void
  growthRate: number
  setGrowthRate: (value: number) => void
  hazardDensity: number
  setHazardDensity: (value: number) => void
  settings: RunSettings
  toggleSetting: (key: keyof RunSettings) => void
  setGroup: (group: string, enabled: boolean) => void
  showSpectacle: boolean
  setShowSpectacle: (show: boolean) => void
  reelStatus: string | null
  setReelStatus: (status: string | null) => void
  highlights: BubbleMetrics[]
  setHighlights: (metrics: BubbleMetrics[]) => void
  lastMetrics: BubbleMetrics | null
  setLastMetrics: (metrics: BubbleMetrics | null) => void
  level: LevelData
  levelHint: string
  scoreMatch: typeof scoreMatch
  SETTING_TOGGLES: typeof SETTING_TOGGLES
}

const BubbleWarContext = createContext<BubbleWarSession | null>(null)

export function BubbleWarProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseChoice>('arena')
  const [seed, setSeed] = useState(() => randomSeed())
  const [reelKey, setReelKey] = useState(0)
  const [growthRate, setGrowthRate] = useState(6.5)
  const [hazardDensity, setHazardDensity] = useState(0.55)
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN_SETTINGS })
  const [showSpectacle, setShowSpectacle] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<BubbleMetrics[]>([])
  const [lastMetrics, setLastMetrics] = useState<BubbleMetrics | null>(null)

  const level = useMemo(
    () => resolveLevel(course, seed, hazardDensity),
    [course, seed, hazardDensity],
  )

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
    setReelStatus('Collecting matches…')
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

  const value: BubbleWarSession = {
    course,
    setCourse,
    seed,
    newSeed,
    nextPreset,
    reelKey,
    startReel,
    growthRate,
    setGrowthRate,
    hazardDensity,
    setHazardDensity,
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
    scoreMatch,
    SETTING_TOGGLES,
  }

  return (
    <BubbleWarContext.Provider value={value}>{children}</BubbleWarContext.Provider>
  )
}

export function useBubbleWar(): BubbleWarSession {
  const ctx = useContext(BubbleWarContext)
  if (!ctx) throw new Error('useBubbleWar must be used within BubbleWarProvider')
  return ctx
}
