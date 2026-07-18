import type { Chain } from './types'
import { VIEW_HEIGHT, VIEW_WIDTH } from './types'

export type Camera = { x: number; y: number; zoom: number }

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 }
}

export function updateCamera(
  camera: Camera,
  chains: Chain[],
  levelWidth: number,
  levelHeight: number,
  punch = 0,
  heistAlarm = false,
) {
  const fronts: number[] = []
  for (const chain of chains) {
    if (!chain.alive) continue
    const tip = chain.dominos.find((d) => d.state === 'tipping')
    if (tip) {
      fronts.push(tip.y)
      continue
    }
    const front = chain.dominos[Math.max(0, chain.tipFront)]
    if (front && front.state !== 'shattered') fronts.push(front.y)
    else {
      const upright = chain.dominos.find((d) => d.state === 'upright')
      if (upright) fronts.push(upright.y)
    }
  }

  if (fronts.length === 0) return

  const minY = Math.min(...fronts)
  const maxY = Math.max(...fronts)
  const padding = heistAlarm ? 200 : 260
  const requiredHeight = Math.max(VIEW_HEIGHT, maxY - minY + padding)
  const stretchBoost = heistAlarm ? 1.1 : 1
  const targetZoom = Math.min(stretchBoost, (VIEW_HEIGHT / requiredHeight) * stretchBoost)
  camera.zoom += (targetZoom - camera.zoom) * (heistAlarm ? 0.16 : 0.1)

  const visibleWidth = VIEW_WIDTH / camera.zoom
  const visibleHeight = VIEW_HEIGHT / camera.zoom
  const midpointY = (minY + maxY) / 2
  const leaderBias = heistAlarm ? 0.7 : 0.55
  const focusY = minY * (1 - leaderBias) + midpointY * leaderBias

  camera.x += (levelWidth / 2 - visibleWidth / 2 - camera.x) * 0.12
  camera.y += (focusY - visibleHeight * 0.42 - camera.y) * 0.14
  camera.y += punch

  camera.x = Math.max(0, Math.min(levelWidth - visibleWidth, camera.x))
  camera.y = Math.max(0, Math.min(Math.max(0, levelHeight - visibleHeight), camera.y))
}
