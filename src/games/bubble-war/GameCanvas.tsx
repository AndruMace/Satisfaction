import { useEffect, useRef } from 'react'
import {
  buildRecordingFilename,
  downloadBlob,
  isRecordingSupported,
  RaceRecorder,
} from '../../shared/recorder'
import { audioEngine } from './audio'
import { GameLoop } from './loop'
import type { BubbleMetrics, RunSettings } from './settings'
import type { GamePhase, LevelData, Winner } from './types'

type GameCanvasProps = {
  level: LevelData | null
  launchKey: number
  reelKey: number
  playerCount: number
  growthRate: number
  hazardDensity: number
  settings: RunSettings
  autoRecord: boolean
  onPhaseChange: (phase: GamePhase) => void
  onWinner: (winner: Winner) => void
  onMatchMetrics: (metrics: BubbleMetrics) => void
  onReelProgress: (current: number, total: number) => void
  onReelComplete: (highlights: BubbleMetrics[]) => void
  onRecordingChange: (recording: boolean) => void
  onRecordingReady: (blob: Blob, filename: string, durationSec: number) => void
  onRecordingError: (message: string) => void
}

const FINISH_HOLD_MS = 1200
const GAME_SLUG = 'bubble-war'

export function GameCanvas({
  level,
  launchKey,
  reelKey,
  playerCount,
  growthRate,
  hazardDensity,
  settings,
  autoRecord,
  onPhaseChange,
  onWinner,
  onMatchMetrics,
  onReelProgress,
  onReelComplete,
  onRecordingChange,
  onRecordingReady,
  onRecordingError,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const recorderRef = useRef(new RaceRecorder(audioEngine))
  const autoRecordRef = useRef(autoRecord)
  const levelNameRef = useRef(level?.name ?? 'bubble')
  const reelActiveRef = useRef(false)
  const reelClipIndexRef = useRef(0)
  const finishTimerRef = useRef<number | null>(null)
  const phaseRef = useRef<GamePhase>('idle')
  const recordingOpsRef = useRef(Promise.resolve())

  const callbacksRef = useRef({
    onPhaseChange,
    onWinner,
    onMatchMetrics,
    onReelProgress,
    onReelComplete,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  })
  callbacksRef.current = {
    onPhaseChange,
    onWinner,
    onMatchMetrics,
    onReelProgress,
    onReelComplete,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  }

  autoRecordRef.current = autoRecord
  levelNameRef.current = level?.name ?? 'bubble'

  const clearFinishTimer = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
  }

  const enqueueRecordingOp = (op: () => Promise<void>) => {
    recordingOpsRef.current = recordingOpsRef.current.then(op, op)
    return recordingOpsRef.current
  }

  const stopAndDeliverInner = async () => {
    const recorder = recorderRef.current
    if (!recorder.isRecording()) return

    const durationSec = recorder.elapsedSeconds()
    const asReel = reelActiveRef.current
    const reelIndex = asReel ? reelClipIndexRef.current : undefined
    const blob = await recorder.stop()
    callbacksRef.current.onRecordingChange(false)
    if (!blob) return

    if (asReel) reelClipIndexRef.current += 1

    const filename = buildRecordingFilename(GAME_SLUG, levelNameRef.current, reelIndex)
    callbacksRef.current.onRecordingReady(blob, filename, durationSec)
    downloadBlob(blob, filename)
  }

  const startRecordingInner = async () => {
    if (!autoRecordRef.current) return
    if (!isRecordingSupported()) {
      callbacksRef.current.onRecordingError(
        'Recording is not supported in this browser.',
      )
      return
    }
    const canvas = canvasRef.current
    const recorder = recorderRef.current
    if (!canvas || recorder.isRecording()) return

    try {
      audioEngine.unlock()
      await recorder.start(canvas)
      callbacksRef.current.onRecordingChange(true)
    } catch (error) {
      callbacksRef.current.onRecordingError(
        error instanceof Error ? error.message : 'Could not start recording.',
      )
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const recorder = recorderRef.current

    const loop = new GameLoop(canvas, {
      onPhaseChange: (phase) => {
        const previous = phaseRef.current
        phaseRef.current = phase
        callbacksRef.current.onPhaseChange(phase)

        if (
          (phase === 'countdown' || phase === 'racing') &&
          previous !== 'countdown' &&
          previous !== 'racing'
        ) {
          clearFinishTimer()
          void enqueueRecordingOp(async () => {
            if (recorder.isRecording()) {
              await stopAndDeliverInner()
            }
            await startRecordingInner()
          })
        }

        if (phase === 'finished' && recorder.isRecording()) {
          clearFinishTimer()
          finishTimerRef.current = window.setTimeout(() => {
            void enqueueRecordingOp(stopAndDeliverInner)
          }, FINISH_HOLD_MS)
        }
      },
      onWinner: (winner) => callbacksRef.current.onWinner(winner),
      onMatchMetrics: (metrics) => callbacksRef.current.onMatchMetrics(metrics),
      onReelProgress: (current, total) =>
        callbacksRef.current.onReelProgress(current, total),
      onReelComplete: (highlights) =>
        callbacksRef.current.onReelComplete(highlights),
      onAfterDraw: () => recorder.captureFrame(),
    })
    loopRef.current = loop
    loop.start()

    const onResize = () => loop.syncCanvasResolution()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      clearFinishTimer()
      void recorder.stop()
      loop.destroy()
      loopRef.current = null
    }
    // Mount once; recording helpers use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const loop = loopRef.current
    if (!loop || !level) return
    loop.loadLevel(level)
  }, [level])

  useEffect(() => {
    loopRef.current?.setPlayerCount(playerCount)
  }, [playerCount])

  useEffect(() => {
    loopRef.current?.setGrowthRate(growthRate)
  }, [growthRate])

  useEffect(() => {
    loopRef.current?.setHazardDensity(hazardDensity)
  }, [hazardDensity])

  useEffect(() => {
    loopRef.current?.setSettings(settings)
  }, [settings])

  useEffect(() => {
    if (launchKey === 0) return
    reelActiveRef.current = false
    reelClipIndexRef.current = 0
    loopRef.current?.launch()
  }, [launchKey])

  useEffect(() => {
    if (reelKey === 0) return
    reelActiveRef.current = true
    reelClipIndexRef.current = 1
    loopRef.current?.startBestOfReel(8)
  }, [reelKey])

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Bubble War game" />
}
