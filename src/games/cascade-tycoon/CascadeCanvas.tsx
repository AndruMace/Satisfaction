import {
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent,
} from 'react'
import {
  downloadBlob,
  isRecordingSupported,
  RaceRecorder,
} from '../../shared/recorder'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { AudioEngine } from './audio'
import { renderFrame } from './render'
import { FINISH_HOLD_MS } from './shorts'
import {
  snapshot,
  startRun,
  stepWorld,
  tryManualDrop,
  type CascadeWorld,
} from './sim'
import type { CascadePhase, CascadeSnapshot } from './types'

const GAME_SLUG = 'cascade-tycoon'

type Props = {
  worldRef: MutableRefObject<CascadeWorld>
  running: boolean
  autoRecord: boolean
  onTreasury: (value: number) => void
  onSnapshot: (snap: CascadeSnapshot) => void
  onRecordingChange: (recording: boolean) => void
  onRecordingReady: (blob: Blob, filename: string, durationSec: number) => void
  onRecordingError: (message: string) => void
}

function clipFilename(world: CascadeWorld): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const score = Math.floor(world.treasury)
  return `${GAME_SLUG}-${score}-${stamp}.webm`
}

export function CascadeCanvas({
  worldRef,
  running,
  autoRecord,
  onTreasury,
  onSnapshot,
  onRecordingChange,
  onRecordingReady,
  onRecordingError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const recorderRef = useRef<RaceRecorder | null>(null)
  const lastCueSeq = useRef(0)
  const runningRef = useRef(running)
  runningRef.current = running
  const autoRecordRef = useRef(autoRecord)
  autoRecordRef.current = autoRecord
  const phaseRef = useRef<CascadePhase>('ready')
  const finishTimerRef = useRef<number | null>(null)
  const recordingOpsRef = useRef(Promise.resolve())

  const callbacksRef = useRef({
    onTreasury,
    onSnapshot,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  })
  callbacksRef.current = {
    onTreasury,
    onSnapshot,
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  }

  useEffect(() => {
    const audio = new AudioEngine()
    audioRef.current = audio
    recorderRef.current = new RaceRecorder(audio)
    return () => {
      audioRef.current = null
      recorderRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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

    const stopAndDeliver = async () => {
      const recorder = recorderRef.current
      if (!recorder?.isRecording()) return
      const durationSec = recorder.elapsedSeconds()
      const blob = await recorder.stop()
      callbacksRef.current.onRecordingChange(false)
      if (!blob) return
      const filename = clipFilename(worldRef.current)
      callbacksRef.current.onRecordingReady(blob, filename, durationSec)
      downloadBlob(blob, filename)
    }

    const startRecording = async () => {
      if (!autoRecordRef.current) return
      if (!isRecordingSupported()) {
        callbacksRef.current.onRecordingError(
          'Recording is not supported in this browser.',
        )
        return
      }
      const recorder = recorderRef.current
      const audio = audioRef.current
      if (!recorder || recorder.isRecording()) return
      try {
        audio?.unlock()
        await recorder.start(canvas)
        callbacksRef.current.onRecordingChange(true)
      } catch (error) {
        callbacksRef.current.onRecordingError(
          error instanceof Error ? error.message : 'Could not start recording.',
        )
      }
    }

    let raf = 0
    let last = 0
    let uiAcc = 0

    phaseRef.current = worldRef.current.phase
    renderFrame(ctx, snapshot(worldRef.current))
    callbacksRef.current.onTreasury(worldRef.current.treasury)
    callbacksRef.current.onSnapshot(snapshot(worldRef.current))

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016
      last = ts

      if (runningRef.current) {
        stepWorld(worldRef.current, dt)
      }

      const world = worldRef.current
      const prevPhase = phaseRef.current
      const phase = world.phase

      if (phase !== prevPhase) {
        phaseRef.current = phase
        if (phase === 'running' && prevPhase !== 'running') {
          clearFinishTimer()
          void enqueueRecordingOp(async () => {
            const recorder = recorderRef.current
            if (recorder?.isRecording()) await stopAndDeliver()
            await startRecording()
          })
        }
        if (phase === 'finished' && recorderRef.current?.isRecording()) {
          clearFinishTimer()
          finishTimerRef.current = window.setTimeout(() => {
            void enqueueRecordingOp(stopAndDeliver)
          }, FINISH_HOLD_MS)
        }
      }

      if (world.cueSeq !== lastCueSeq.current && world.lastCue) {
        lastCueSeq.current = world.cueSeq
        audioRef.current?.playCue(world.lastCue)
      }

      renderFrame(ctx, snapshot(world))
      recorderRef.current?.captureFrame()

      uiAcc += dt
      if (uiAcc >= 0.1) {
        uiAcc = 0
        const snap = snapshot(world)
        callbacksRef.current.onTreasury(snap.treasury)
        callbacksRef.current.onSnapshot(snap)
      }
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      clearFinishTimer()
      void recorderRef.current?.stop()
    }
  }, [worldRef])

  const onPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    audioRef.current?.unlock()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT

    const phase = worldRef.current.phase
    if (phase === 'ready' || phase === 'finished') {
      startRun(worldRef.current)
      callbacksRef.current.onSnapshot(snapshot(worldRef.current))
      callbacksRef.current.onTreasury(worldRef.current.treasury)
      return
    }

    if (y > VIEW_HEIGHT * 0.28) return
    tryManualDrop(worldRef.current, x)
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas cascade-canvas"
      width={VIEW_WIDTH}
      height={VIEW_HEIGHT}
      aria-label="Cascade Tycoon board"
      onPointerDown={onPointer}
    />
  )
}
