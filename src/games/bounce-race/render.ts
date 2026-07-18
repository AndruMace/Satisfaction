import { type Camera } from './camera'
import {
  type Brick,
  type HealthBarrier,
  type ImpactFlash,
  type LevelData,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  type PressureWall,
  PRESSURE_WALL_INSET,
  type Racer,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Wall,
  wallPolygon,
  type Winner,
} from './types'

const COLORS = {
  bg: '#0e1014',
  wall: '#c8cdd8',
  wallEdge: '#8a919e',
  brick: '#3a4150',
  brickEdge: '#565f72',
  finish: '#f0f4ff',
  finishGlow: 'rgba(240, 244, 255, 0.25)',
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  level: LevelData,
  walls: Wall[],
  bricks: Brick[],
  barriers: HealthBarrier[],
  racers: Racer[],
  particles: Particle[],
  flashes: ImpactFlash[],
  winner: Winner,
  pressureWall: PressureWall,
  overlay: OverlayState,
) {
  ctx.save()
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  ctx.scale(camera.zoom, camera.zoom)
  ctx.translate(-camera.x, -camera.y)

  drawFinishLine(ctx, level)
  for (const wall of walls) drawWall(ctx, wall)
  for (const brick of bricks) {
    if (brick.alive) drawBrick(ctx, brick)
  }
  for (const barrier of barriers) {
    if (barrier.health > 0) drawHealthBarrier(ctx, barrier)
  }
  drawPressureWall(ctx, pressureWall, level.bounds.width)

  for (const racer of racers) {
    if (racer.alive) {
      drawRacer(ctx, racer, overlay.rivalryIds.includes(racer.id))
    }
  }
  for (const p of particles) drawParticle(ctx, p)
  for (const flash of flashes) drawFlash(ctx, flash)

  ctx.restore()

  if (overlay.nameTags) {
    for (const racer of racers) {
      if (racer.alive) drawNameTagScreen(ctx, camera, racer)
    }
  }

  if (overlay.launchFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, overlay.launchFlash * 1.4)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.finalStretch) {
    const glow = ctx.createLinearGradient(0, VIEW_HEIGHT * 0.7, 0, VIEW_HEIGHT)
    glow.addColorStop(0, 'rgba(255,255,255,0)')
    glow.addColorStop(1, 'rgba(255, 212, 59, 0.12)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.hookLine) {
    drawCenterBanner(ctx, overlay.hookLine, '#f4d35e', 56, 24)
  }

  if (overlay.countdownValue !== null) {
    drawCountdown(ctx, overlay.countdownValue)
  }

  if (overlay.eventBanner) {
    drawCenterBanner(ctx, overlay.eventBanner, '#eef1f7', VIEW_HEIGHT * 0.28)
  }

  if (overlay.photoFinish > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + overlay.photoFinish * 0.05})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawCenterBanner(ctx, 'PHOTO FINISH', '#ffffff', VIEW_HEIGHT * 0.4, 34)
  }

  if (winner && overlay.photoFinish <= 0) {
    drawWinnerBanner(ctx, winner, overlay.winMessage)
  }

  drawProgressTrack(ctx, level, racers, overlay.rivalryIds)
}

function drawProgressTrack(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  racers: Racer[],
  rivalryIds: Racer['id'][],
) {
  const trackX = VIEW_WIDTH - 28
  const trackTop = 72
  const trackBottom = VIEW_HEIGHT - 72
  const trackHeight = trackBottom - trackTop
  const trackWidth = 6
  const startY = 120
  const finishSpan = Math.max(1, level.finishY - startY)

  ctx.save()

  // Track background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  roundRect(ctx, trackX - 10, trackTop - 18, 28, trackHeight + 36, 10)
  ctx.fill()

  // Lane
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.fillRect(trackX - trackWidth / 2, trackTop, trackWidth, trackHeight)

  // Start / finish ticks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.fillRect(trackX - 9, trackTop - 1, 18, 2)
  ctx.fillStyle = '#f0f4ff'
  ctx.fillRect(trackX - 9, trackBottom - 1, 18, 2)

  ctx.font = '700 9px "Syne", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(238, 241, 247, 0.55)'
  ctx.fillText('S', trackX, trackTop - 8)
  ctx.fillStyle = 'rgba(240, 244, 255, 0.85)'
  ctx.fillText('F', trackX, trackBottom + 12)

  // Sorted for place badges (leader = farthest down course)
  const ranked = [...racers].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1
    return b.y - a.y
  })

  ranked.forEach((racer, index) => {
    const progress = Math.max(0, Math.min(1, (racer.y - startY) / finishSpan))
    const markerY = Math.round(trackTop + progress * trackHeight)
    const rivalry = rivalryIds.includes(racer.id)
    const size = rivalry ? 8 : 6

    ctx.globalAlpha = racer.alive ? 1 : 0.35

    // Marker
    ctx.fillStyle = racer.color
    ctx.beginPath()
    if (racer.shape === 'ball') {
      ctx.arc(trackX, markerY, size, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(trackX - size, markerY - size, size * 2, size * 2)
    }

    if (racer.alive) {
      ctx.strokeStyle = rivalry ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
      ctx.lineWidth = rivalry ? 2 : 1
      if (racer.shape === 'ball') {
        ctx.beginPath()
        ctx.arc(trackX, markerY, size, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.strokeRect(trackX - size + 0.5, markerY - size + 0.5, size * 2 - 1, size * 2 - 1)
      }

      // Place number for top racers
      if (index < 3) {
        ctx.font = '800 10px "Syne", system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillText(String(index + 1), trackX - 11, markerY + 1)
        ctx.fillStyle = '#eef1f7'
        ctx.fillText(String(index + 1), trackX - 12, markerY)
      }
    }

    ctx.globalAlpha = 1
  })

  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  const label = value <= 0 ? 'GO' : String(value)
  const x = Math.round(VIEW_WIDTH / 2)
  const y = Math.round(VIEW_HEIGHT * 0.42)
  ctx.save()
  ctx.font = '800 96px "Syne", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, x + 2, y + 2)
  ctx.fillStyle = value <= 0 ? '#39d98a' : '#eef1f7'
  ctx.fillText(label, x, y)
  ctx.restore()
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  size = 32,
) {
  const x = Math.round(VIEW_WIDTH / 2)
  const yy = Math.round(y)
  ctx.save()
  ctx.font = `800 ${size}px "Syne", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillText(text, x + 1, yy + 1)
  ctx.fillStyle = color
  ctx.fillText(text, x, yy)
  ctx.restore()
}

function drawNameTagScreen(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  racer: Racer,
) {
  const profile = PLAYER_PROFILES.find((p) => p.id === racer.id)
  const label = profile?.label ?? racer.id
  const screenX = Math.round((racer.x - camera.x) * camera.zoom)
  const screenY = Math.round((racer.y - camera.y) * camera.zoom - racer.size * camera.zoom * 0.5 - 18)

  ctx.save()
  ctx.font = '700 13px "Syne", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const width = Math.ceil(ctx.measureText(label).width) + 12
  const height = 18
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(screenX - width / 2, screenY - height / 2, width, height)
  ctx.fillStyle = racer.color
  ctx.fillText(label, screenX, screenY + 0.5)
  ctx.restore()
}

function drawPressureWall(
  ctx: CanvasRenderingContext2D,
  pressureWall: PressureWall,
  levelWidth: number,
) {
  const x = PRESSURE_WALL_INSET
  const right = levelWidth - PRESSURE_WALL_INSET
  const center = levelWidth / 2
  const y = pressureWall.y
  const sideY = y + pressureWall.height
  const tipY = sideY + pressureWall.chevronDepth
  const depth = pressureWall.chevronDepth

  ctx.save()
  ctx.fillStyle = '#181b22'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(levelWidth, 0)
  ctx.lineTo(levelWidth, tipY)
  ctx.lineTo(right, tipY)
  ctx.lineTo(right, sideY)
  ctx.lineTo(center, tipY)
  ctx.lineTo(x, sideY)
  ctx.lineTo(x, tipY)
  ctx.lineTo(0, tipY)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(0, 0, levelWidth, sideY)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
  for (let bandY = 0; bandY < y; bandY += 40) {
    ctx.fillRect(0, bandY, levelWidth, 1)
  }

  ctx.fillStyle = '#d7dce6'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(right, y)
  ctx.lineTo(right, sideY)
  ctx.lineTo(center, tipY)
  ctx.lineTo(x, sideY)
  ctx.closePath()
  ctx.fill()

  const stripeWidth = 32
  for (let stripeX = x; stripeX < right; stripeX += stripeWidth) {
    const nextX = Math.min(stripeX + stripeWidth, right)
    ctx.fillStyle =
      Math.floor((stripeX - x) / stripeWidth) % 2 === 0
        ? 'rgba(255, 59, 59, 0.28)'
        : 'rgba(59, 139, 255, 0.28)'

    const frontAt = (px: number) => {
      const half = (right - x) / 2
      const t = Math.min(1, Math.abs(px - center) / half)
      return sideY + depth * (1 - t)
    }

    ctx.beginPath()
    ctx.moveTo(stripeX, y)
    ctx.lineTo(nextX, y)
    ctx.lineTo(nextX, frontAt(nextX))
    ctx.lineTo(stripeX, frontAt(stripeX))
    ctx.closePath()
    ctx.fill()
  }

  ctx.strokeStyle = '#ff4d4d'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, sideY)
  ctx.lineTo(center, tipY)
  ctx.lineTo(right, sideY)
  ctx.stroke()
  ctx.restore()
}

function drawFinishLine(ctx: CanvasRenderingContext2D, level: LevelData) {
  const y = level.finishY
  const { width } = level.bounds
  ctx.save()
  ctx.fillStyle = COLORS.finishGlow
  ctx.fillRect(0, y - 24, width, 48)
  ctx.strokeStyle = COLORS.finish
  ctx.lineWidth = 4
  ctx.setLineDash([18, 12])
  ctx.beginPath()
  ctx.moveTo(32, y)
  ctx.lineTo(width - 32, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall) {
  const verts = wallPolygon(wall)
  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x, verts[i].y)
  }
  ctx.closePath()
  ctx.fillStyle = COLORS.wall
  ctx.fill()
  ctx.strokeStyle = COLORS.wallEdge
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawBrick(ctx: CanvasRenderingContext2D, brick: Brick) {
  ctx.fillStyle = COLORS.brick
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h)
  ctx.strokeStyle = COLORS.brickEdge
  ctx.lineWidth = 1.5
  ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 4)
}

function drawHealthBarrier(
  ctx: CanvasRenderingContext2D,
  barrier: HealthBarrier,
) {
  const ratio = Math.max(0, barrier.health / barrier.maxHealth)
  const inset = 4
  const meterWidth = barrier.w - inset * 2
  const meterHeight = 6
  const pulse = Math.max(0, Math.min(1, barrier.hitPulse))
  const cx = barrier.x + barrier.w / 2
  const cy = barrier.y + barrier.h / 2
  const scale = 1 + pulse * 0.08
  const shakeX = pulse > 0 ? Math.sin(pulse * 48) * pulse * 4 : 0
  const shakeY = pulse > 0 ? Math.cos(pulse * 36) * pulse * 2.5 : 0

  ctx.save()
  ctx.translate(cx + shakeX, cy + shakeY)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  ctx.fillStyle = pulse > 0.15 ? '#323846' : '#262b36'
  ctx.fillRect(barrier.x, barrier.y, barrier.w, barrier.h)
  ctx.strokeStyle = pulse > 0.2 ? '#a8b4cc' : '#778196'
  ctx.lineWidth = 2
  ctx.strokeRect(
    barrier.x + 1,
    barrier.y + 1,
    barrier.w - 2,
    barrier.h - 2,
  )

  ctx.fillStyle = '#0c0e12'
  ctx.fillRect(
    barrier.x + inset,
    barrier.y + barrier.h - meterHeight - inset,
    meterWidth,
    meterHeight,
  )
  ctx.fillStyle =
    ratio > 0.5 ? '#39d98a' : ratio > 0.25 ? '#ffd43b' : '#ff4d4d'
  ctx.fillRect(
    barrier.x + inset,
    barrier.y + barrier.h - meterHeight - inset,
    meterWidth * ratio,
    meterHeight,
  )

  ctx.font = '800 16px "Syne", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillText(
    String(barrier.health),
    barrier.x + barrier.w / 2 + 1,
    barrier.y + barrier.h / 2 - 2,
  )
  ctx.fillStyle = '#ffffff'
  ctx.fillText(
    String(barrier.health),
    barrier.x + barrier.w / 2,
    barrier.y + barrier.h / 2 - 3,
  )
  ctx.restore()
}

function drawRacer(ctx: CanvasRenderingContext2D, racer: Racer, rivalry: boolean) {
  const half = racer.size / 2
  const trailBoost = rivalry ? 1.35 : 1

  for (let i = racer.trail.length - 1; i >= 0; i--) {
    const t = racer.trail[i]
    const alpha = (1 - i / racer.trail.length) * (rivalry ? 0.55 : 0.4)
    ctx.globalAlpha = alpha
    ctx.fillStyle = racer.color
    const trailSize =
      racer.size * (0.45 + (1 - i / racer.trail.length) * 0.55) * trailBoost
    if (racer.shape === 'ball') {
      ctx.beginPath()
      ctx.arc(t.x, t.y, trailSize / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(t.x - trailSize / 2, t.y - trailSize / 2, trailSize, trailSize)
    }
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = racer.color
  ctx.strokeStyle = rivalry ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)'
  ctx.lineWidth = rivalry ? 3 : 2
  if (racer.shape === 'ball') {
    ctx.beginPath()
    ctx.arc(racer.x, racer.y, half, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillRect(racer.x - half, racer.y - half, racer.size, racer.size)
    ctx.strokeRect(racer.x - half + 1, racer.y - half + 1, racer.size - 2, racer.size - 2)
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = Math.max(0, p.life / p.maxLife)
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  ctx.globalAlpha = 1
}

function drawFlash(ctx: CanvasRenderingContext2D, flash: ImpactFlash) {
  const alpha = flash.life / 0.08
  ctx.globalAlpha = Math.max(0, alpha * 0.6)
  ctx.fillStyle = flash.color
  ctx.beginPath()
  ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawWinnerBanner(
  ctx: CanvasRenderingContext2D,
  winner: Winner,
  winMessage: string | null,
) {
  const screenX = Math.round(VIEW_WIDTH / 2)
  const screenY = Math.round(VIEW_HEIGHT * 0.18)
  const profile = PLAYER_PROFILES.find((candidate) => candidate.id === winner)
  const label =
    winMessage?.toUpperCase() ??
    `${profile?.label.toUpperCase() ?? 'PLAYER'} WINS`
  const color = profile?.color ?? '#ffffff'
  const size = winMessage && winMessage.length > 18 ? 28 : 36

  ctx.save()
  ctx.font = `700 ${size}px "Syne", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText(label, screenX + 1, screenY + 1)
  ctx.fillStyle = color
  ctx.fillText(label, screenX, screenY)
  ctx.restore()
}
