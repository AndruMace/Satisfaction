import {
  type Bubble,
  type LevelData,
  type OverlayState,
  type Particle,
  PLAYER_PROFILES,
  type PopBurst,
  type Spike,
  type WallSeg,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

const FONT = '"Fredoka", "Syne", system-ui, sans-serif'

const COLORS = {
  bgTop: '#2a1440',
  bgBot: '#140a22',
  wall: 'rgba(255, 160, 210, 0.2)',
  wallEdge: 'rgba(255, 200, 230, 0.5)',
  spike: '#ffb4d8',
  spikeTip: '#fff0f8',
  mint: '#7ef0d8',
  candy: '#ff8cc8',
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  _level: LevelData,
  walls: WallSeg[],
  spikes: Spike[],
  bubbles: Bubble[],
  particles: Particle[],
  bursts: PopBurst[],
  winner: Winner,
  overlay: OverlayState,
) {
  drawBackground(ctx, overlay)
  for (const wall of walls) drawWall(ctx, wall)
  for (const s of spikes) drawSpike(ctx, s)
  for (const bubble of bubbles) {
    if (bubble.alive) drawBubble(ctx, bubble, overlay.rivalryIds.includes(bubble.id))
  }
  for (const burst of bursts) drawBurst(ctx, burst)
  for (const p of particles) drawParticle(ctx, p)

  if (overlay.nameTags) {
    for (const bubble of bubbles) {
      if (bubble.alive) drawNameTag(ctx, bubble)
    }
  }

  if (overlay.growthSurge) {
    const g = ctx.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      40,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.7,
    )
    g.addColorStop(0, 'rgba(255, 140, 200, 0.12)')
    g.addColorStop(1, 'rgba(126, 240, 216, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.launchFlash > 0) {
    ctx.fillStyle = `rgba(255, 220, 240,${Math.min(0.5, overlay.launchFlash * 1.3)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.hookLine) {
    drawCenterBanner(ctx, overlay.hookLine, COLORS.candy, 64, 24)
  }

  if (overlay.countdownValue !== null) {
    drawCountdown(ctx, overlay.countdownValue)
  }

  if (overlay.eventBanner) {
    drawCenterBanner(ctx, overlay.eventBanner, '#fff0f8', VIEW_HEIGHT * 0.28)
  }

  if (overlay.photoFinish > 0) {
    ctx.fillStyle = `rgba(255,180,220,${0.06 + overlay.photoFinish * 0.05})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawCenterBanner(ctx, 'PHOTO FINISH', '#ffffff', VIEW_HEIGHT * 0.4, 34)
  }

  if (winner && overlay.photoFinish <= 0) {
    drawWinnerBanner(ctx, winner, overlay.winMessage)
  } else if (!winner && overlay.winMessage && overlay.photoFinish <= 0) {
    drawCenterBanner(ctx, overlay.winMessage.toUpperCase(), '#eef6ff', VIEW_HEIGHT * 0.38, 28)
  }

  drawAliveStrip(ctx, bubbles, overlay.rivalryIds)
}

function drawBackground(ctx: CanvasRenderingContext2D, overlay: OverlayState) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
  g.addColorStop(0, COLORS.bgTop)
  g.addColorStop(0.55, '#1e1040')
  g.addColorStop(1, COLORS.bgBot)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Soft soda-fizz blobs
  ctx.save()
  ctx.globalAlpha = 0.08 + (overlay.slowMo > 0 ? 0.04 : 0)
  const blobs = [
    { x: 80, y: 120, c: COLORS.candy, r: 140 },
    { x: VIEW_WIDTH - 70, y: 220, c: COLORS.mint, r: 120 },
    { x: VIEW_WIDTH * 0.4, y: VIEW_HEIGHT * 0.7, c: '#c9a0ff', r: 150 },
    { x: 100, y: VIEW_HEIGHT - 100, c: COLORS.candy, r: 100 },
    { x: VIEW_WIDTH - 90, y: VIEW_HEIGHT * 0.55, c: COLORS.mint, r: 110 },
  ]
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 8, b.x, b.y, b.r)
    rg.addColorStop(0, b.c)
    rg.addColorStop(1, 'transparent')
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Tiny bubble sparkles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  for (let i = 0; i < 18; i++) {
    const x = ((i * 67) % VIEW_WIDTH) + 10
    const y = ((i * 131) % VIEW_HEIGHT) + 10
    ctx.beginPath()
    ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWall(ctx: CanvasRenderingContext2D, wall: WallSeg) {
  ctx.fillStyle = COLORS.wall
  roundWall(ctx, wall.x, wall.y, wall.w, wall.h, 10)
  ctx.fill()
  ctx.strokeStyle = COLORS.wallEdge
  ctx.lineWidth = 2
  roundWall(ctx, wall.x, wall.y, wall.w, wall.h, 10)
  ctx.stroke()
  // Candy stripe
  ctx.fillStyle = 'rgba(126, 240, 216, 0.18)'
  ctx.fillRect(wall.x + 4, wall.y + 3, Math.max(0, wall.w - 8), 3)
}

function drawSpike(ctx: CanvasRenderingContext2D, s: Spike) {
  const tipX = s.x + Math.cos(s.angle) * s.length
  const tipY = s.y + Math.sin(s.angle) * s.length
  const px = -Math.sin(s.angle) * 5
  const py = Math.cos(s.angle) * 5

  ctx.beginPath()
  ctx.moveTo(s.x + px, s.y + py)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(s.x - px, s.y - py)
  ctx.closePath()
  const g = ctx.createLinearGradient(s.x, s.y, tipX, tipY)
  g.addColorStop(0, COLORS.spike)
  g.addColorStop(0.55, '#ffd0e8')
  g.addColorStop(1, COLORS.mint)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble, rivalry: boolean) {
  const rx = bubble.radius * bubble.squashX
  const ry = bubble.radius * bubble.squashY
  ctx.save()
  ctx.translate(bubble.x, bubble.y)

  // Soft outer glow
  const glow = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx * 1.35)
  glow.addColorStop(0, hexAlpha(bubble.color, 0.35 + bubble.shovePulse * 0.25))
  glow.addColorStop(1, hexAlpha(bubble.color, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(0, 0, rx * 1.35, ry * 1.35, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body
  const body = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, rx * 0.1, 0, 0, rx)
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.18, hexAlpha(bubble.color, 0.95))
  body.addColorStop(0.75, hexAlpha(bubble.color, 0.55))
  body.addColorStop(1, hexAlpha(bubble.color, 0.22))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.22, ry * 0.14, -0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = rivalry ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'
  ctx.lineWidth = rivalry ? 3 : 1.5
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Thin membrane ring for squash readability
  ctx.strokeStyle = hexAlpha(bubble.color, 0.5)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

function drawBurst(ctx: CanvasRenderingContext2D, burst: PopBurst) {
  const t = 1 - burst.life / burst.maxLife
  const alpha = (1 - t) * 0.85
  const r = burst.radius * (0.4 + t * 1.2)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = burst.color
  ctx.lineWidth = 4 * (1 - t)
  ctx.beginPath()
  ctx.arc(burst.x, burst.y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2 * (1 - t)
  ctx.beginPath()
  ctx.arc(burst.x, burst.y, r * 0.7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = Math.max(0, p.life / p.maxLife)
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawNameTag(ctx: CanvasRenderingContext2D, bubble: Bubble) {
  const profile = PLAYER_PROFILES.find((p) => p.id === bubble.id)
  const label = profile?.label ?? bubble.id
  ctx.save()
  ctx.font = `600 14px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, bubble.x + 1, bubble.y - bubble.radius * bubble.squashY - 9)
  ctx.fillStyle = '#fff0f8'
  ctx.fillText(label, bubble.x, bubble.y - bubble.radius * bubble.squashY - 10)
  ctx.restore()
}

function drawAliveStrip(
  ctx: CanvasRenderingContext2D,
  bubbles: Bubble[],
  rivalryIds: Bubble['id'][],
) {
  const alive = bubbles.filter((b) => b.alive)
  const x0 = 20
  const y = VIEW_HEIGHT - 36
  ctx.save()
  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(255,240,248,0.6)'
  ctx.textAlign = 'left'
  ctx.fillText(`${alive.length} left`, x0, y - 14)

  bubbles.forEach((bubble, index) => {
    const x = x0 + index * 28
    ctx.globalAlpha = bubble.alive ? 1 : 0.28
    ctx.fillStyle = bubble.color
    ctx.beginPath()
    ctx.arc(x + 8, y, rivalryIds.includes(bubble.id) ? 8 : 6, 0, Math.PI * 2)
    ctx.fill()
    if (bubble.alive) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
  ctx.restore()
}

function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  const label = value <= 0 ? 'GO' : String(value)
  const x = Math.round(VIEW_WIDTH / 2)
  const y = Math.round(VIEW_HEIGHT * 0.42)
  ctx.save()
  ctx.font = `700 96px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillText(label, x + 2, y + 2)
  ctx.fillStyle = value <= 0 ? COLORS.mint : '#fff0f8'
  ctx.fillText(label, x, y)
  ctx.restore()
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  size = 30,
) {
  const x = Math.round(VIEW_WIDTH / 2)
  const yy = Math.round(y)
  ctx.save()
  ctx.font = `700 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(20, 8, 30, 0.45)'
  ctx.fillText(text, x + 1.5, yy + 1.5)
  ctx.fillStyle = color
  ctx.fillText(text, x, yy)
  ctx.restore()
}

function roundWall(
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

function drawWinnerBanner(
  ctx: CanvasRenderingContext2D,
  winner: NonNullable<Winner>,
  winMessage: string | null,
) {
  const profile = PLAYER_PROFILES.find((p) => p.id === winner)
  const line =
    winMessage?.toUpperCase() ??
    `${(profile?.label ?? winner).toUpperCase()} IS THE LAST BUBBLE`
  const size = line.length > 22 ? 26 : 32
  drawCenterBanner(ctx, line, profile?.color ?? '#eef6ff', VIEW_HEIGHT * 0.38, size)
}

function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
