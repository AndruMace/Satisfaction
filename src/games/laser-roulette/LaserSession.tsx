import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { generateProceduralCourse, randomSeed } from './courses/procedural'
import { getPreset, type PresetId, presetCourses } from './courses/presets'
import {
  DEFAULT_RUN_SETTINGS,
  type MatchMetrics,
  type RunSettings,
  scoreMatch,
  SETTING_TOGGLES,
} from './settings'
import type { CourseData } from './types'

export type CourseChoice = PresetId | 'procedural'

const PRESET_OPTIONS: { id: CourseChoice; label: string }[] = [
  { id: 'sparse', label: 'Slow Sweep' },
  { id: 'dual', label: 'Slow Dual' },
  { id: 'crossfire', label: 'Crossfire' },
  { id: 'dense', label: 'Dense Blades' },
  { id: 'procedural', label: 'Procedural' },
]

export { PRESET_OPTIONS }

function resolveCourse(choice: CourseChoice, seed: number): CourseData {
  if (choice === 'procedural') return generateProceduralCourse(seed)
  return getPreset(choice)
}

export type LaserSession = {
  course: CourseChoice
  setCourse: (course: CourseChoice) => void
  seed: number
  newSeed: () => void
  nextPreset: () => void
  reelKey: number
  startReel: () => void
  beamCount: number
  setBeamCount: (value: number) => void
  beamSpeed: number
  setBeamSpeed: (value: number) => void
  aiAggression: number
  setAiAggression: (value: number) => void
  settings: RunSettings
  toggleSetting: (key: keyof RunSettings) => void
  setGroup: (group: string, enabled: boolean) => void
  showSpectacle: boolean
  setShowSpectacle: (show: boolean) => void
  reelStatus: string | null
  setReelStatus: (status: string | null) => void
  highlights: MatchMetrics[]
  setHighlights: (metrics: MatchMetrics[]) => void
  lastMetrics: MatchMetrics | null
  setLastMetrics: (metrics: MatchMetrics | null) => void
  level: CourseData
  levelHint: string
  scoreMatch: typeof scoreMatch
  SETTING_TOGGLES: typeof SETTING_TOGGLES
}

const LaserContext = createContext<LaserSession | null>(null)

export function LaserProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseChoice>('dual')
  const [seed, setSeed] = useState(() => randomSeed())
  const [reelKey, setReelKey] = useState(0)
  const [beamCount, setBeamCount] = useState(0) // 0 = use course default
  const [beamSpeed, setBeamSpeed] = useState(1)
  const [aiAggression, setAiAggression] = useState(0.75)
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN_SETTINGS })
  const [showSpectacle, setShowSpectacle] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<MatchMetrics[]>([])
  const [lastMetrics, setLastMetrics] = useState<MatchMetrics | null>(null)

  const level = useMemo(() => resolveCourse(course, seed), [course, seed])

  const setCourse = (next: CourseChoice) => {
    setCourseState(next)
    if (next === 'procedural') setSeed(randomSeed())
    setBeamCount(0)
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

  const levelHint = `${level.name} · ${presetCourses.some((p) => p.name === level.name) ? 'preset' : 'procedural'} · ${level.beams.length} beams`

  const value: LaserSession = {
    course,
    setCourse,
    seed,
    newSeed,
    nextPreset,
    reelKey,
    startReel,
    beamCount,
    setBeamCount,
    beamSpeed,
    setBeamSpeed,
    aiAggression,
    setAiAggression,
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

  return <LaserContext.Provider value={value}>{children}</LaserContext.Provider>
}

export function useLaser(): LaserSession {
  const ctx = useContext(LaserContext)
  if (!ctx) throw new Error('useLaser must be used within LaserProvider')
  return ctx
}
