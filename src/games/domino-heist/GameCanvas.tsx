import { useEffect, useRef } from 'react'
import {
  buildRecordingFilename,
  downloadBlob,
  isRecordingSupported,
  RaceRecorder,
} from '../../shared/recorder'
import { audioEngine } from './audio'
import { GameLoop } from './loop'
import type { CascadeRunSettings, DominoTune } from './settings'
import type { CascadeMetrics, GamePhase, MoodId } from './types'

type GameCanvasProps = {
  mood: MoodId
  seed: number
  tune: DominoTune
  settings: CascadeRunSettings
  launchKey: number
  autoRecord: boolean
  onPhaseChange: (phase: GamePhase) => void
  onMetrics: (metrics: CascadeMetrics) => void
  onRecordingChange: (recording: boolean) => void
  onRecordingReady: (blob: Blob, filename: string, durationSec: number) => void
  onRecordingError: (message: string) => void
}

const FINISH_HOLD_MS = 1600
const GAME_SLUG = 'domino-heist'

export function GameCanvas({
  mood,
  seed,
  tune,
  settings,
  launchKey,
  autoRecord,
  onPhaseChange,
  onMetrics,
  onRecordingChange,
  onRecordingReady,
  onRecordingError,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const recorderRef = useRef(new RaceRecorder(audioEngine))
  const autoRecordRef = useRef(autoRecord)
  const courseNameRef = useRef('cascade')
  const finishTimerRef = useRef<number | null>(null)
  const phaseRef = useRef<GamePhase>('idle')
  const recordingOpsRef = useRef(Promise.resolve())
  const cleanupRef = useRef<(() => void) | null>(null)

  const callbacksRef = useRef({
    onPhaseChange,
    onMetrics,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  })
  callbacksRef.current = {
    onPhaseChange,
    onMetrics,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  }

  autoRecordRef.current = autoRecord

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
    const blob = await recorder.stop()
    callbacksRef.current.onRecordingChange(false)
    if (!blob) return

    const filename = buildRecordingFilename(GAME_SLUG, courseNameRef.current)
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

    let cancelled = false
    const recorder = recorderRef.current

    void (async () => {
      const { initDominoPhysics } = await import('./sim')
      await initDominoPhysics()
      if (cancelled || !canvasRef.current) return

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
        onMetrics: (metrics) => {
          courseNameRef.current = metrics.name
          callbacksRef.current.onMetrics(metrics)
        },
        onAfterDraw: () => recorder.captureFrame(),
      })
      if (cancelled) {
        loop.destroy()
        return
      }
      loopRef.current = loop
      loop.loadCourse(mood, seed, tune)
      loop.start()

      const onResize = () => loop.syncCanvasResolution()
      window.addEventListener('resize', onResize)

      cleanupRef.current = () => {
        window.removeEventListener('resize', onResize)
        clearFinishTimer()
        void recorder.stop()
        loop.destroy()
        loopRef.current = null
      }
    })()

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loopRef.current?.loadCourse(mood, seed, tune)
    courseNameRef.current = mood
  }, [mood, seed, tune])

  useEffect(() => {
    loopRef.current?.setSettings(settings)
  }, [settings])

  useEffect(() => {
    if (launchKey === 0) return
    loopRef.current?.launch()
  }, [launchKey])

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label="Domino heist cascade"
    />
  )
}
