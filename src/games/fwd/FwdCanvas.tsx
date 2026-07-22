import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { createInputController, type InputController } from './input'
import { createFwdScene, type FwdScene } from './scene'
import { snapshot, stepWorld, type FwdWorld } from './sim'
import type { FwdSnapshot } from './types'

type FwdCanvasProps = {
  worldRef: MutableRefObject<FwdWorld>
  running: boolean
  onSnapshot: (snap: FwdSnapshot) => void
  inputRef: MutableRefObject<InputController | null>
  resetKey: number
}

export function FwdCanvas({
  worldRef,
  running,
  onSnapshot,
  inputRef,
  resetKey,
}: FwdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<FwdScene | null>(null)
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const runningRef = useRef(running)
  runningRef.current = running

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = createFwdScene(canvas)
    sceneRef.current = scene
    const input = createInputController(canvas)
    inputRef.current = input

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      scene.setSize(rect.width, rect.height, window.devicePixelRatio || 1)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    scene.resetCamera(worldRef.current)
    scene.sync(worldRef.current)
    scene.render()

    let raf = 0
    let last = performance.now()
    let snapAccum = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const world = worldRef.current
      if (runningRef.current && world.phase === 'racing') {
        stepWorld(world, dt, input.get())
      }

      scene.updateCamera(world, dt)
      scene.sync(world)
      scene.render()

      snapAccum += dt
      if (snapAccum >= 0.05) {
        snapAccum = 0
        onSnapshotRef.current(snapshot(world))
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      input.dispose()
      inputRef.current = null
      sceneRef.current = null
      scene.dispose()
    }
  }, [worldRef, inputRef])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.resetCamera(worldRef.current)
    scene.sync(worldRef.current)
    onSnapshotRef.current(snapshot(worldRef.current))
  }, [resetKey, worldRef])

  return <canvas ref={canvasRef} className="fwd-canvas game-canvas" />
}
