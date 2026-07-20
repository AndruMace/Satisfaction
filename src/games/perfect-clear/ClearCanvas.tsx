import { useEffect, useRef, type MutableRefObject, type PointerEvent } from 'react'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { renderFrame } from './render'
import {
  ignite,
  snapshot,
  stepWorld,
  type ClearWorld,
} from './sim'
import type { ClearSnapshot } from './types'

type Props = {
  worldRef: MutableRefObject<ClearWorld>
  running: boolean
  onSnapshot: (snap: ClearSnapshot) => void
}

export function ClearCanvas({ worldRef, running, onSnapshot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const lastTs = useRef(0)
  const uiAcc = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop)
      if (!running) {
        lastTs.current = ts
        return
      }
      const dt = lastTs.current
        ? Math.min(0.05, (ts - lastTs.current) / 1000)
        : 0.016
      lastTs.current = ts

      stepWorld(worldRef.current, dt)
      const snap = snapshot(worldRef.current)
      renderFrame(ctx, snap)

      uiAcc.current += dt
      if (uiAcc.current >= 0.08) {
        uiAcc.current = 0
        onSnapshot(snap)
      }
    }

    renderFrame(ctx, snapshot(worldRef.current))
    onSnapshot(snapshot(worldRef.current))
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onSnapshot, running, worldRef])

  const onPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT
    if (ignite(worldRef.current, x, y)) {
      onSnapshot(snapshot(worldRef.current))
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas clear-canvas"
      width={VIEW_WIDTH}
      height={VIEW_HEIGHT}
      aria-label="Perfect Clear board"
      onPointerDown={onPointer}
    />
  )
}
