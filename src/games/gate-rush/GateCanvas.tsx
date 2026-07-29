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
import { VIEW_WIDTH } from '../../shared/types'
import { AudioEngine } from './audio'
import { createGateRushScene, type GateRushScene } from './scene'
import {
  setSteer,
  setSteerDir,
  snapshot,
  startRun,
  stepWorld,
  type GateRushWorld,
} from './sim'
import type { GateRushSnapshot, RushPhase } from './types'

const FINISH_HOLD_MS = 1400
const GAME_SLUG = 'gate-rush'

type Props = {
  worldRef: MutableRefObject<GateRushWorld>
  running: boolean
  autoRecord: boolean
  onSnapshot: (snap: GateRushSnapshot) => void
  onRecordingChange: (recording: boolean) => void
  onRecordingReady: (blob: Blob, filename: string, durationSec: number) => void
  onRecordingError: (message: string) => void
}

function clipFilename(world: GateRushWorld): string {
  const peak = world.peakCount
  const result =
    world.phase === 'won'
      ? world.winKind === 'barely'
        ? 'barely'
        : world.winKind === 'overkill'
          ? 'overkill'
          : 'cleared'
      : 'wipeout'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${GAME_SLUG}-${world.courseId}-${peak}-${result}-${stamp}.webm`
}

export function GateCanvas({
  worldRef,
  running,
  autoRecord,
  onSnapshot,
  onRecordingChange,
  onRecordingReady,
  onRecordingError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<GateRushScene | null>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const recorderRef = useRef<RaceRecorder | null>(null)
  const lastCueSeq = useRef(0)
  const pointers = useRef(new Map<number, number>())
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const runningRef = useRef(running)
  runningRef.current = running
  const autoRecordRef = useRef(autoRecord)
  autoRecordRef.current = autoRecord
  const phaseRef = useRef<RushPhase>('ready')
  const finishTimerRef = useRef<number | null>(null)
  const recordingOpsRef = useRef(Promise.resolve())

  const callbacksRef = useRef({
    onRecordingChange,
    onRecordingReady,
    onRecordingError,
  })
  callbacksRef.current = {
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
    const keys = new Set<string>()
    const syncDir = () => {
      const left =
        keys.has('ArrowLeft') || keys.has('a') || keys.has('A')
      const right =
        keys.has('ArrowRight') || keys.has('d') || keys.has('D')
      if (left && !right) setSteerDir(worldRef.current, -1)
      else if (right && !left) setSteerDir(worldRef.current, 1)
      else {
        setSteerDir(worldRef.current, 0)
        if (pointers.current.size === 0) setSteer(worldRef.current, null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'a' ||
        event.key === 'A' ||
        event.key === 'd' ||
        event.key === 'D'
      ) {
        event.preventDefault()
      }
      if (!event.repeat) keys.add(event.key)
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        audioRef.current?.unlock()
        const phase = worldRef.current.phase
        if (phase === 'ready' || phase === 'won' || phase === 'lost') {
          startRun(worldRef.current)
          onSnapshotRef.current(snapshot(worldRef.current))
        }
      }
      syncDir()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key)
      syncDir()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [worldRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = createGateRushScene(canvas)
    sceneRef.current = scene

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

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      scene.setSize(rect.width, rect.height, window.devicePixelRatio || 1)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    let raf = 0
    let last = performance.now()
    let snapAccum = 0

    scene.sync(worldRef.current, 0)
    scene.render()
    onSnapshotRef.current(snapshot(worldRef.current))
    phaseRef.current = worldRef.current.phase

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (runningRef.current) {
        stepWorld(worldRef.current, dt)
      }

      const world = worldRef.current
      const prevPhase = phaseRef.current
      const phase = world.phase

      if (phase !== prevPhase) {
        phaseRef.current = phase
        const enteringRun =
          (phase === 'running' || phase === 'boss') &&
          prevPhase !== 'running' &&
          prevPhase !== 'boss'
        if (enteringRun) {
          clearFinishTimer()
          void enqueueRecordingOp(async () => {
            const recorder = recorderRef.current
            if (recorder?.isRecording()) await stopAndDeliver()
            await startRecording()
          })
        }
        if (
          (phase === 'won' || phase === 'lost') &&
          recorderRef.current?.isRecording()
        ) {
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

      scene.sync(world, now / 1000)
      scene.render()
      recorderRef.current?.captureFrame()

      snapAccum += dt
      if (snapAccum >= 0.08) {
        snapAccum = 0
        onSnapshotRef.current(snapshot(world))
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      clearFinishTimer()
      ro.disconnect()
      void recorderRef.current?.stop()
      sceneRef.current = null
      scene.dispose()
    }
  }, [worldRef])

  const toSimX = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return VIEW_WIDTH / 2
    const rect = canvas.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * VIEW_WIDTH
  }

  const syncSteer = () => {
    if (pointers.current.size === 0) {
      setSteer(worldRef.current, null)
      return
    }
    let sum = 0
    for (const x of pointers.current.values()) sum += x
    setSteer(worldRef.current, sum / pointers.current.size)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    audioRef.current?.unlock()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, toSimX(event.clientX))
    syncSteer()

    const phase = worldRef.current.phase
    if (phase === 'ready' || phase === 'won' || phase === 'lost') {
      startRun(worldRef.current)
      onSnapshot(snapshot(worldRef.current))
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, toSimX(event.clientX))
    syncSteer()
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId)
    syncSteer()
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas gate-canvas"
      aria-label="Gate Rush runner"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}
