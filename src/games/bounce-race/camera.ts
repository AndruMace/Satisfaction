import { type Racer, VIEW_HEIGHT, VIEW_WIDTH } from './types'

export type Camera = { x: number; y: number; zoom: number }

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 }
}

export function updateCamera(
  camera: Camera,
  racers: Racer[],
  levelWidth: number,
  levelHeight: number,
  punch = 0,
  finalStretch = false,
) {
  if (racers.length === 0) return

  const minY = Math.min(...racers.map((r) => r.y))
  const maxY = Math.max(...racers.map((r) => r.y))
  const padding = finalStretch ? 180 : 240
  const requiredHeight = Math.max(VIEW_HEIGHT, maxY - minY + padding)
  const stretchBoost = finalStretch ? 1.12 : 1
  const targetZoom = Math.min(stretchBoost, (VIEW_HEIGHT / requiredHeight) * stretchBoost)
  camera.zoom += (targetZoom - camera.zoom) * (finalStretch ? 0.18 : 0.12)

  const visibleWidth = VIEW_WIDTH / camera.zoom
  const visibleHeight = VIEW_HEIGHT / camera.zoom
  const midpointY = (minY + maxY) / 2
  const leaderBias = finalStretch ? 0.72 : 0.5
  const focusY = midpointY * (1 - leaderBias) + maxY * leaderBias
  const targetY = focusY - visibleHeight / 2 + punch

  camera.x = (levelWidth - visibleWidth) / 2
  camera.y = Math.max(
    Math.min(0, levelHeight - visibleHeight),
    Math.min(Math.max(0, levelHeight - visibleHeight), targetY),
  )
}
