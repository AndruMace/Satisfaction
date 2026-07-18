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
  type GrabMetrics,
  type RunSettings,
  scoreGrab,
  SETTING_TOGGLES,
} from './settings'
import type { LevelData } from './types'

export type CourseChoice = PresetId | 'procedural'

const PRESET_OPTIONS: { id: CourseChoice; label: string }[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'fever', label: 'Fever' },
  { id: 'magnets', label: 'Magnets' },
  { id: 'squeeze', label: 'Squeeze' },
  { id: 'procedural', label: 'Procedural' },
]

export { PRESET_OPTIONS }

function resolveLevel(choice: CourseChoice, seed: number): LevelData {
  if (choice === 'procedural') return generateProceduralLevel(seed)
  return getPreset(choice)
}

export type GreedyGrabSession = {
  course: CourseChoice
  setCourse: (course: CourseChoice) => void
  seed: number
  newSeed: () => void
  nextPreset: () => void
  reelKey: number
  startReel: () => void
  greedWeight: number
  setGreedWeight: (value: number) => void
  roundLength: number
  setRoundLength: (value: number) => void
  depositRequired: boolean
  setDepositRequired: (enabled: boolean) => void
  bankOnElim: boolean
  setBankOnElim: (enabled: boolean) => void
  settings: RunSettings
  toggleSetting: (key: keyof RunSettings) => void
  setGroup: (group: string, enabled: boolean) => void
  showSpectacle: boolean
  setShowSpectacle: (show: boolean) => void
  reelStatus: string | null
  setReelStatus: (status: string | null) => void
  highlights: GrabMetrics[]
  setHighlights: (metrics: GrabMetrics[]) => void
  lastMetrics: GrabMetrics | null
  setLastMetrics: (metrics: GrabMetrics | null) => void
  level: LevelData
  levelHint: string
  scoreGrab: typeof scoreGrab
  SETTING_TOGGLES: typeof SETTING_TOGGLES
}

const GreedyGrabContext = createContext<GreedyGrabSession | null>(null)

export function GreedyGrabProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseChoice>('vault')
  const [seed, setSeed] = useState(() => randomSeed())
  const [reelKey, setReelKey] = useState(0)
  const [greedWeight, setGreedWeight] = useState(1)
  const [roundLength, setRoundLength] = useState(45)
  const [depositRequired, setDepositRequired] = useState(true)
  const [bankOnElim, setBankOnElim] = useState(false)
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN_SETTINGS })
  const [showSpectacle, setShowSpectacle] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<GrabMetrics[]>([])
  const [lastMetrics, setLastMetrics] = useState<GrabMetrics | null>(null)

  const level = useMemo(() => resolveLevel(course, seed), [course, seed])

  const setCourse = (next: CourseChoice) => {
    setCourseState(next)
    if (next === 'procedural') setSeed(randomSeed())
    if (next === 'fever') setDepositRequired(false)
    if (next === 'vault') setDepositRequired(true)
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
    setReelStatus('Collecting rounds…')
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

  const value: GreedyGrabSession = {
    course,
    setCourse,
    seed,
    newSeed,
    nextPreset,
    reelKey,
    startReel,
    greedWeight,
    setGreedWeight,
    roundLength,
    setRoundLength,
    depositRequired,
    setDepositRequired,
    bankOnElim,
    setBankOnElim,
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
    scoreGrab,
    SETTING_TOGGLES,
  }

  return (
    <GreedyGrabContext.Provider value={value}>{children}</GreedyGrabContext.Provider>
  )
}

export function useGreedyGrab(): GreedyGrabSession {
  const ctx = useContext(GreedyGrabContext)
  if (!ctx) throw new Error('useGreedyGrab must be used within GreedyGrabProvider')
  return ctx
}
