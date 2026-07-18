import {
  ARENA_CX,
  ARENA_CY,
  ARENA_RADIUS,
  type Dodger,
  type ImpactFlash,
  type LaserBeam,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  RING_RADIUS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'
import { ringPoint } from './physics'

const FONT = '"Orbitron", "Syne", system-ui, sans-serif'

const COLORS = {
  bg0: '#05020c',
  bg1: '#16082a',
  ring: 'rgba(0, 240, 255, 0.28)',
  ringBright: 'rgba(255, 45, 149, 0.45)',
  floor: 'rgba(18, 8, 36, 0.92)',
  magenta: '#ff2d95',
  cyan: '#00f0ff',
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  beams: LaserBeam[],
  dodgers: Dodger[],
  particles: Particle[],
  flashes: ImpactFlash[],
  winner: Winner,
  overlay: OverlayState,
  rivalryIds: Dodger['id'][],
) {
  ctx.save()
  drawBackground(ctx, overlay.tension)
  drawArena(ctx)
  drawSafeWedgesHint(ctx, beams)

  for (const beam of beams) drawBeam(ctx, beam)
  drawRing(ctx)

  for (const dodger of dodgers) {
    if (dodger.alive) drawDodger(ctx, dodger, rivalryIds.includes(dodger.id))
  }
  for (const p of particles) drawParticle(ctx, p)
  for (const flash of flashes) drawFlash(ctx, flash)

  ctx.restore()

  if (overlay.nameTags) {
    for (const dodger of dodgers) {
      if (dodger.alive) drawNameTag(ctx, dodger)
    }
  }

  drawAlivePips(ctx, dodgers)

  if (overlay.surviveTimer !== null && overlay.surviveTimer >= 0) {
    drawSurviveClock(ctx, overlay.surviveTimer)
  }

  if (overlay.launchFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, overlay.launchFlash * 1.35)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.hookLine) {
    drawCenterBanner(ctx, overlay.hookLine, COLORS.cyan, 56, 22)
  }

  if (overlay.countdownValue !== null) {
    drawCountdown(ctx, overlay.countdownValue)
  }

  if (overlay.eventBanner) {
    drawCenterBanner(ctx, overlay.eventBanner, '#f4ecff', VIEW_HEIGHT * 0.28)
  }

  if (overlay.photoFinish > 0) {
    ctx.fillStyle = `rgba(255,45,149,${0.06 + overlay.photoFinish * 0.05})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawCenterBanner(ctx, 'PHOTO FINISH', COLORS.cyan, VIEW_HEIGHT * 0.4, 30)
  }

  if (overlay.slowMo > 0) {
    ctx.fillStyle = `rgba(0, 240, 255, ${Math.min(0.1, overlay.slowMo * 0.12)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (winner && overlay.photoFinish <= 0) {
    drawWinnerBanner(ctx, winner, overlay.winMessage)
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, tension: number) {
  const g = ctx.createRadialGradient(
    ARENA_CX,
    ARENA_CY,
    40,
    ARENA_CX,
    ARENA_CY,
    VIEW_HEIGHT * 0.7,
  )
  g.addColorStop(0, COLORS.bg1)
  g.addColorStop(1, COLORS.bg0)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Scanlines
  ctx.fillStyle = 'rgba(0, 240, 255, 0.025)'
  for (let y = 0; y < VIEW_HEIGHT; y += 4) {
    ctx.fillRect(0, y, VIEW_WIDTH, 1)
  }

  // Corner neon ticks
  ctx.strokeStyle = 'rgba(255, 45, 149, 0.35)'
  ctx.lineWidth = 2
  const tick = 18
  for (const [ox, oy, dx, dy] of [
    [16, 16, 1, 1],
    [VIEW_WIDTH - 16, 16, -1, 1],
    [16, VIEW_HEIGHT - 16, 1, -1],
    [VIEW_WIDTH - 16, VIEW_HEIGHT - 16, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(ox, oy + dy * tick)
    ctx.lineTo(ox, oy)
    ctx.lineTo(ox + dx * tick, oy)
    ctx.stroke()
  }

  if (tension > 0.05) {
    const v = ctx.createRadialGradient(
      ARENA_CX,
      ARENA_CY,
      ARENA_RADIUS * 0.55,
      ARENA_CX,
      ARENA_CY,
      ARENA_RADIUS * 1.65,
    )
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, `rgba(255, 45, 149, ${0.08 + tension * 0.14})`)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
}

function drawArena(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS + 10, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(5, 2, 12, 0.75)'
  ctx.fill()
  ctx.strokeStyle = hexAlpha(COLORS.magenta, 0.35)
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.floor
  ctx.fill()

  // Concentric tech rings
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath()
    ctx.arc(ARENA_CX, ARENA_CY, (ARENA_RADIUS * i) / 5, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = hexAlpha(COLORS.cyan, 0.45)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

  // Hub
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, 14, 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(COLORS.magenta, 0.35)
  ctx.fill()
  ctx.strokeStyle = COLORS.cyan
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawRing(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = COLORS.ring
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  ctx.stroke()
  ctx.setLineDash([])
}

function drawSafeWedgesHint(ctx: CanvasRenderingContext2D, beams: LaserBeam[]) {
  if (beams.length === 0) return
  // Soft danger glow under beams
  for (const beam of beams) {
    const half = Math.max(0.035, beam.halfWidth)
    ctx.beginPath()
    ctx.moveTo(ARENA_CX, ARENA_CY)
    ctx.arc(
      ARENA_CX,
      ARENA_CY,
      ARENA_RADIUS * Math.max(0.35, beam.length),
      beam.angle - half,
      beam.angle + half,
    )
    ctx.closePath()
    const alpha = 0.1 + beam.pulse * 0.14
    ctx.fillStyle = hexAlpha(beam.color, alpha)
    ctx.fill()
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: LaserBeam) {
  const len = ARENA_RADIUS * Math.max(0.2, beam.length)
  const tipX = ARENA_CX + Math.cos(beam.angle) * len
  const tipY = ARENA_CY + Math.sin(beam.angle) * len
  const glow = 0.65 + beam.pulse * 0.45
  const lethal = beam.length >= 0.72

  ctx.save()
  ctx.strokeStyle = hexAlpha(beam.color, (lethal ? 0.28 : 0.16) * glow)
  ctx.lineWidth = 22 + beam.halfWidth * 100
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ARENA_CX, ARENA_CY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  ctx.strokeStyle = hexAlpha(beam.color, (lethal ? 0.95 : 0.7) * glow)
  ctx.lineWidth = 4.5 + beam.halfWidth * 28
  ctx.beginPath()
  ctx.moveTo(ARENA_CX, ARENA_CY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  // Hot core
  ctx.strokeStyle = `rgba(255,255,255,${lethal ? 0.55 : 0.3})`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(ARENA_CX, ARENA_CY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.globalAlpha = 0.75 + beam.pulse * 0.25
  ctx.beginPath()
  ctx.arc(tipX, tipY, 5 + beam.pulse * 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDodger(ctx: CanvasRenderingContext2D, dodger: Dodger, rivalry: boolean) {
  // Trail
  for (let i = 0; i < dodger.trail.length; i++) {
    const t = dodger.trail[i]
    const p = ringPoint(t)
    const a = ((i + 1) / dodger.trail.length) * 0.35
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = hexAlpha(dodger.color, a)
    ctx.fill()
  }

  const pos = ringPoint(dodger.angle)
  const r = 11

  if (rivalry) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r + 8, 0, Math.PI * 2)
    ctx.strokeStyle = hexAlpha('#ffffff', 0.45)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(dodger.color, 0.25)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
  ctx.fillStyle = dodger.color
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const a = Math.max(0, p.life / p.maxLife)
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(p.color, a)
  ctx.fill()
}

function drawFlash(ctx: CanvasRenderingContext2D, flash: ImpactFlash) {
  const a = Math.max(0, Math.min(1, flash.life * 8))
  ctx.beginPath()
  ctx.arc(flash.x, flash.y, flash.radius * (1.2 - flash.life), 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(flash.color, a * 0.55)
  ctx.fill()
}

function drawNameTag(ctx: CanvasRenderingContext2D, dodger: Dodger) {
  const pos = ringPoint(dodger.angle)
  const label = PLAYER_PROFILES.find((p) => p.id === dodger.id)?.label ?? dodger.id
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, pos.x + 1, pos.y - 16)
  ctx.fillStyle = '#f4ecff'
  ctx.fillText(label, pos.x, pos.y - 17)
}

function drawAlivePips(ctx: CanvasRenderingContext2D, dodgers: Dodger[]) {
  const alive = dodgers.filter((d) => d.alive)
  const startX = VIEW_WIDTH / 2 - ((dodgers.length - 1) * 18) / 2
  const y = 36
  dodgers.forEach((d, i) => {
    const x = startX + i * 18
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = d.alive ? d.color : 'rgba(80,85,95,0.5)'
    ctx.fill()
    if (!d.alive) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - 4, y - 4)
      ctx.lineTo(x + 4, y + 4)
      ctx.moveTo(x + 4, y - 4)
      ctx.lineTo(x - 4, y + 4)
      ctx.stroke()
    }
  })
  ctx.font = `600 10px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(244,236,255,0.55)'
  ctx.fillText(`${alive.length} STANDING`, VIEW_WIDTH / 2, y + 20)
}

function drawSurviveClock(ctx: CanvasRenderingContext2D, seconds: number) {
  const label = Math.ceil(Math.max(0, seconds)).toString()
  ctx.font = `800 22px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = seconds < 5 ? COLORS.magenta : COLORS.cyan
  ctx.fillText(label, VIEW_WIDTH / 2, VIEW_HEIGHT - 48)
  ctx.font = `600 10px ${FONT}`
  ctx.fillStyle = 'rgba(244,236,255,0.45)'
  ctx.fillText('SURVIVE', VIEW_WIDTH / 2, VIEW_HEIGHT - 28)
}

function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  const text = value <= 0 ? 'GO' : String(value)
  ctx.font = `800 88px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillText(text, VIEW_WIDTH / 2 + 3, VIEW_HEIGHT / 2 + 3)
  ctx.fillStyle = value <= 0 ? COLORS.cyan : '#f4ecff'
  ctx.shadowColor = value <= 0 ? COLORS.cyan : COLORS.magenta
  ctx.shadowBlur = 18
  ctx.fillText(text, VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
  ctx.shadowBlur = 0
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  size = 28,
) {
  ctx.save()
  ctx.font = `700 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const padX = 22
  const padY = 14
  const w = metrics.width + padX * 2
  const h = size + padY * 2
  const x = VIEW_WIDTH / 2 - w / 2
  roundRect(ctx, x, y - h / 2, w, h, 2)
  ctx.fillStyle = 'rgba(8, 2, 18, 0.82)'
  ctx.fill()
  ctx.strokeStyle = hexAlpha(COLORS.cyan, 0.45)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, VIEW_WIDTH / 2, y)
  ctx.restore()
}

function drawWinnerBanner(
  ctx: CanvasRenderingContext2D,
  winner: NonNullable<Winner>,
  winMessage: string | null,
) {
  const profile = PLAYER_PROFILES.find((p) => p.id === winner)
  const line =
    winMessage?.toUpperCase() ??
    `${profile?.label ?? winner} LASTS`.toUpperCase()
  const size = winMessage && winMessage.length > 22 ? 26 : 34
  drawCenterBanner(ctx, line, profile?.color ?? '#fff', VIEW_HEIGHT * 0.52, size)
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    let r = 0
    let g = 0
    let b = 0
    if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16)
      g = parseInt(hex.slice(3, 5), 16)
      b = parseInt(hex.slice(5, 7), 16)
    } else {
      r = parseInt(hex[1] + hex[1], 16)
      g = parseInt(hex[2] + hex[2], 16)
      b = parseInt(hex[3] + hex[3], 16)
    }
    return `rgba(${r},${g},${b},${a})`
  }
  return hex
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
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
