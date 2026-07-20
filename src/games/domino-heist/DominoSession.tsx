import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { generateCourse, MOOD_OPTIONS, randomSeed } from './course'
import {
  DEFAULT_RUN_SETTINGS,
  DEFAULT_TUNE,
  type CascadeRunSettings,
  type DominoTune,
} from './settings'
import type { CascadeMetrics, DominoCourse, MoodId } from './types'

export { MOOD_OPTIONS }

export type DominoHeistSession = {
  mood: MoodId
  setMood: (mood: MoodId) => void
  seed: number
  newSeed: () => void
  nextMood: () => void
  tune: DominoTune
  setTune: (patch: Partial<DominoTune>) => void
  resetTune: () => void
  settings: CascadeRunSettings
  lastMetrics: CascadeMetrics | null
  setLastMetrics: (metrics: CascadeMetrics | null) => void
  course: DominoCourse
  levelHint: string
}

const DominoHeistContext = createContext<DominoHeistSession | null>(null)

export function DominoHeistProvider({ children }: { children: ReactNode }) {
  const [mood, setMoodState] = useState<MoodId>('spiral')
  const [seed, setSeed] = useState(() => randomSeed())
  const [tune, setTuneState] = useState<DominoTune>(() => ({ ...DEFAULT_TUNE }))
  const [lastMetrics, setLastMetrics] = useState<CascadeMetrics | null>(null)
  const settings = DEFAULT_RUN_SETTINGS

  const course = useMemo(
    () =>
      generateCourse(mood, seed, {
        drama: tune.drama,
        spacing: tune.spacing,
        clutchSpacing: tune.clutchSpacing,
      }),
    [mood, seed, tune.drama, tune.spacing, tune.clutchSpacing],
  )

  const setMood = (next: MoodId) => {
    setMoodState(next)
    setSeed(randomSeed())
  }

  const newSeed = () => setSeed(randomSeed())

  const nextMood = () => {
    const idx = MOOD_OPTIONS.findIndex((o) => o.id === mood)
    const next = MOOD_OPTIONS[(idx + 1) % MOOD_OPTIONS.length]
    setMood(next.id)
  }

  const setTune = useCallback((patch: Partial<DominoTune>) => {
    setTuneState((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetTune = useCallback(() => {
    setTuneState({ ...DEFAULT_TUNE })
  }, [])

  const value: DominoHeistSession = {
    mood,
    setMood,
    seed,
    newSeed,
    nextMood,
    tune,
    setTune,
    resetTune,
    settings,
    lastMetrics,
    setLastMetrics,
    course,
    levelHint: `${course.name} · seed ${seed.toString(16)}`,
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
