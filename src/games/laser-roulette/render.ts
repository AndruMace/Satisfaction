import {
  ARENA_CX,
  ARENA_CY,
  ARENA_RADIUS,
  type Dodger,
  HUB_SAFE_DEFAULT,
  type ImpactFlash,
  type LaserBeam,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

const FONT = '"Orbitron", "Syne", system-ui, sans-serif'

const COLORS = {
  bg0: '#05020c',
  bg1: '#16082a',
  floor: 'rgba(18, 8, 36, 0.92)',
  magenta: '#ff2d95',
  cyan: '#00f0ff',
  hubFill: 'rgba(0, 240, 255, 0.06)',
  hubStroke: 'rgba(0, 240, 255, 0.35)',
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
  drawSafeHub(ctx, beams)
  drawSafeWedgesHint(ctx, beams)

  for (const beam of beams) drawBeam(ctx, beam)

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

function currentHubRadius(beams: LaserBeam[]): number {
  if (beams.length === 0) return ARENA_RADIUS * HUB_SAFE_DEFAULT
  return ARENA_RADIUS * Math.min(...beams.map((b) => b.hubClear))
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

  ctx.fillStyle = 'rgba(0, 240, 255, 0.025)'
  for (let y = 0; y < VIEW_HEIGHT; y += 4) {
    ctx.fillRect(0, y, VIEW_WIDTH, 1)
  }

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
}

function drawSafeHub(ctx: CanvasRenderingContext2D, beams: LaserBeam[]) {
  const hubR = currentHubRadius(beams)
  if (hubR < 4) return

  const g = ctx.createRadialGradient(
    ARENA_CX,
    ARENA_CY,
    hubR * 0.15,
    ARENA_CX,
    ARENA_CY,
    hubR,
  )
  g.addColorStop(0, 'rgba(0, 240, 255, 0.12)')
  g.addColorStop(0.7, COLORS.hubFill)
  g.addColorStop(1, 'rgba(0, 240, 255, 0.02)')
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, hubR, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, hubR, 0, Math.PI * 2)
  ctx.strokeStyle = COLORS.hubStroke
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 7])
  ctx.stroke()
  ctx.setLineDash([])

  // Pivot core
  ctx.beginPath()
  ctx.arc(ARENA_CX, ARENA_CY, 10, 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(COLORS.magenta, 0.4)
  ctx.fill()
  ctx.strokeStyle = COLORS.cyan
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawSafeWedgesHint(ctx: CanvasRenderingContext2D, beams: LaserBeam[]) {
  if (beams.length === 0) return
  for (const beam of beams) {
    const half = Math.max(0.035, beam.halfWidth)
    const hubR = ARENA_RADIUS * beam.hubClear
    const outer = ARENA_RADIUS * Math.max(0.35, beam.length)
    ctx.beginPath()
    ctx.arc(ARENA_CX, ARENA_CY, outer, beam.angle - half, beam.angle + half)
    ctx.arc(ARENA_CX, ARENA_CY, hubR, beam.angle + half, beam.angle - half, true)
    ctx.closePath()
    const alpha = 0.1 + beam.pulse * 0.14
    ctx.fillStyle = hexAlpha(beam.color, alpha)
    ctx.fill()
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: LaserBeam) {
  const hubR = ARENA_RADIUS * beam.hubClear
  const len = ARENA_RADIUS * Math.max(0.2, beam.length)
  const cos = Math.cos(beam.angle)
  const sin = Math.sin(beam.angle)
  const hubX = ARENA_CX + cos * hubR
  const hubY = ARENA_CY + sin * hubR
  const tipX = ARENA_CX + cos * len
  const tipY = ARENA_CY + sin * len
  const glow = 0.65 + beam.pulse * 0.45 + beam.telegraph * 0.2
  const lethal = beam.length >= 0.72

  ctx.save()

  // Dim ghost inside hub (not lethal)
  if (hubR > 8) {
    ctx.strokeStyle = hexAlpha(beam.color, 0.12 * glow)
    ctx.lineWidth = 10 + beam.halfWidth * 40
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ARENA_CX, ARENA_CY)
    ctx.lineTo(hubX, hubY)
    ctx.stroke()
  }

  // Lethal segment outside hub
  ctx.strokeStyle = hexAlpha(beam.color, (lethal ? 0.3 : 0.18) * glow)
  ctx.lineWidth = 22 + beam.halfWidth * 100
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(hubX, hubY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  ctx.strokeStyle = hexAlpha(beam.color, (lethal ? 0.95 : 0.7) * glow)
  ctx.lineWidth = 4.5 + beam.halfWidth * 28
  ctx.beginPath()
  ctx.moveTo(hubX, hubY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  ctx.strokeStyle = `rgba(255,255,255,${lethal ? 0.55 : 0.3})`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(hubX, hubY)
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
  const trail = dodger.trail
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i]
    const a = ((i + 1) / trail.length) * 0.4
    ctx.beginPath()
    ctx.arc(p.x, p.y, dodger.radius * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = hexAlpha(dodger.color, a)
    ctx.fill()
  }

  // Dash afterimage
  if (dodger.dash > 0) {
    const speed = Math.hypot(dodger.vx, dodger.vy) || 1
    const ux = dodger.vx / speed
    const uy = dodger.vy / speed
    for (let k = 1; k <= 3; k++) {
      const ax = dodger.x - ux * k * 10
      const ay = dodger.y - uy * k * 10
      ctx.beginPath()
      ctx.arc(ax, ay, dodger.radius * (1 - k * 0.12), 0, Math.PI * 2)
      ctx.fillStyle = hexAlpha(dodger.color, 0.22 / k)
      ctx.fill()
    }
  }

  const r = dodger.radius

  if (rivalry) {
    ctx.beginPath()
    ctx.arc(dodger.x, dodger.y, r + 8, 0, Math.PI * 2)
    ctx.strokeStyle = hexAlpha('#ffffff', 0.45)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(dodger.x, dodger.y, r + 3, 0, Math.PI * 2)
  ctx.fillStyle = hexAlpha(dodger.color, 0.25)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(dodger.x, dodger.y, r, 0, Math.PI * 2)
  ctx.fillStyle = dodger.color
  ctx.fill()
  ctx.strokeStyle =
    dodger.dash > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'
  ctx.lineWidth = dodger.dash > 0 ? 2.5 : 2
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
  const label = PLAYER_PROFILES.find((p) => p.id === dodger.id)?.label ?? dodger.id
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, dodger.x + 1, dodger.y - dodger.radius - 6)
  ctx.fillStyle = '#f4ecff'
  ctx.fillText(label, dodger.x, dodger.y - dodger.radius - 7)
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
