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
  type HeistMetrics,
  type RunSettings,
  scoreHeist,
  SETTING_TOGGLES,
} from './settings'
import type { LevelData } from './types'

export type CourseChoice = PresetId | 'procedural'

const PRESET_OPTIONS: { id: CourseChoice; label: string }[] = [
  { id: 'vault-run', label: 'Vault Run' },
  { id: 'gap-gauntlet', label: 'Gap Gauntlet' },
  { id: 'crossfire', label: 'Crossfire' },
  { id: 'alarm-sprint', label: 'Alarm Sprint' },
  { id: 'procedural', label: 'Procedural' },
]

export { PRESET_OPTIONS }

function resolveLevel(choice: CourseChoice, seed: number): LevelData {
  if (choice === 'procedural') return generateProceduralLevel(seed)
  return getPreset(choice)
}

export type DominoHeistSession = {
  course: CourseChoice
  setCourse: (course: CourseChoice) => void
  seed: number
  newSeed: () => void
  nextPreset: () => void
  reelKey: number
  startReel: () => void
  tipForce: number
  setTipForce: (value: number) => void
  chaos: number
  setChaos: (value: number) => void
  settings: RunSettings
  toggleSetting: (key: keyof RunSettings) => void
  setGroup: (group: string, enabled: boolean) => void
  showSpectacle: boolean
  setShowSpectacle: (show: boolean) => void
  reelStatus: string | null
  setReelStatus: (status: string | null) => void
  highlights: HeistMetrics[]
  setHighlights: (metrics: HeistMetrics[]) => void
  lastMetrics: HeistMetrics | null
  setLastMetrics: (metrics: HeistMetrics | null) => void
  level: LevelData
  levelHint: string
  scoreHeist: typeof scoreHeist
  SETTING_TOGGLES: typeof SETTING_TOGGLES
}

const DominoHeistContext = createContext<DominoHeistSession | null>(null)

export function DominoHeistProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseChoice>('vault-run')
  const [seed, setSeed] = useState(() => randomSeed())
  const [reelKey, setReelKey] = useState(0)
  const [tipForce, setTipForce] = useState(1)
  const [chaos, setChaos] = useState(0.35)
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN_SETTINGS })
  const [showSpectacle, setShowSpectacle] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<HeistMetrics[]>([])
  const [lastMetrics, setLastMetrics] = useState<HeistMetrics | null>(null)

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
    setReelStatus('Collecting heists…')
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

  const value: DominoHeistSession = {
    course,
    setCourse,
    seed,
    newSeed,
    nextPreset,
    reelKey,
    startReel,
    tipForce,
    setTipForce,
    chaos,
    setChaos,
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
    scoreHeist,
    SETTING_TOGGLES,
  }

  return (
    <DominoHeistContext.Provider value={value}>{children}</DominoHeistContext.Provider>
  )
}

export function useDominoHeist(): DominoHeistSession {
  const ctx = useContext(DominoHeistContext)
  if (!ctx) throw new Error('useDominoHeist must be used within DominoHeistProvider')
  return ctx
}
