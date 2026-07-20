import { useEffect, useRef, type MutableRefObject, type PointerEvent } from 'react'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { renderFrame } from './render'
import {
  snapshot,
  stepWorld,
  tryManualDrop,
  type CascadeWorld,
} from './sim'
import type { CascadeSnapshot } from './types'

type Props = {
  worldRef: MutableRefObject<CascadeWorld>
  onTreasury: (value: number) => void
  onSnapshot: (snap: CascadeSnapshot) => void
  running: boolean
}

export function CascadeCanvas({
  worldRef,
  onTreasury,
  onSnapshot,
  running,
}: Props) {
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
      renderFrame(ctx, snapshot(worldRef.current))

      uiAcc.current += dt
      if (uiAcc.current >= 0.1) {
        uiAcc.current = 0
        const snap = snapshot(worldRef.current)
        onTreasury(snap.treasury)
        onSnapshot(snap)
      }
    }

    renderFrame(ctx, snapshot(worldRef.current))
    onTreasury(worldRef.current.treasury)
    onSnapshot(snapshot(worldRef.current))
    rafRef.current = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafRef.current)
  }, [onSnapshot, onTreasury, running, worldRef])

  const onPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT
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
