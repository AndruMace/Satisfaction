import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import type { SoftBody, SquishSnapshot, WallSeg } from './types'

const FONT = '"Fredoka", "Syne", system-ui, sans-serif'

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  snap: SquishSnapshot,
): void {
  ctx.save()
  drawBackground(ctx)
  drawJarGlass(ctx, snap)
  for (const body of snap.bodies) drawBody(ctx, body)
  drawJarStroke(ctx, snap.walls)
  drawLid(ctx, snap)
  drawQueue(ctx, snap)
  drawHud(ctx, snap)
  if (snap.phase === 'won' && snap.stampLife > 0) drawWinStamp(ctx, snap)
  if (snap.phase === 'overflow') drawOverflow(ctx)
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
  g.addColorStop(0, '#12081a')
  g.addColorStop(0.5, '#1a0e28')
  g.addColorStop(1, '#0c0614')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  ctx.fillStyle = 'rgba(255, 120, 200, 0.03)'
  for (let y = 0; y < VIEW_HEIGHT; y += 5) {
    ctx.fillRect(0, y, VIEW_WIDTH, 1)
  }
}

function drawJarGlass(ctx: CanvasRenderingContext2D, snap: SquishSnapshot) {
  if (snap.walls.length < 2) return
  ctx.beginPath()
  ctx.moveTo(snap.walls[0].ax, snap.walls[0].ay)
  for (const w of snap.walls) ctx.lineTo(w.bx, w.by)
  // Close across rim
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 200, 0, 800)
  g.addColorStop(0, 'rgba(180, 230, 255, 0.06)')
  g.addColorStop(0.5, 'rgba(140, 200, 255, 0.1)')
  g.addColorStop(1, 'rgba(100, 160, 220, 0.14)')
  ctx.fillStyle = g
  ctx.fill()

  // Specular streak
  ctx.strokeStyle = 'rgba(220, 245, 255, 0.18)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(VIEW_WIDTH / 2 - 100, 280)
  ctx.quadraticCurveTo(VIEW_WIDTH / 2 - 120, 500, VIEW_WIDTH / 2 - 95, 720)
  ctx.stroke()
}

function drawJarStroke(ctx: CanvasRenderingContext2D, walls: WallSeg[]) {
  ctx.strokeStyle = 'rgba(190, 230, 255, 0.55)'
  ctx.lineWidth = 3.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (walls.length) {
    ctx.moveTo(walls[0].ax, walls[0].ay)
    for (const w of walls) ctx.lineTo(w.bx, w.by)
  }
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 1.2
  ctx.stroke()
}

function drawBody(ctx: CanvasRenderingContext2D, body: SoftBody) {
  const pts = body.particles
  if (pts.length < 3) return

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    const prev = pts[i - 1]
    const mx = (prev.x + p.x) / 2
    const my = (prev.y + p.y) / 2
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
  }
  const last = pts[pts.length - 1]
  const first = pts[0]
  ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2)
  ctx.quadraticCurveTo(first.x, first.y, first.x, first.y)
  ctx.closePath()

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const g = ctx.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, 42)
  g.addColorStop(0, body.glow)
  g.addColorStop(0.55, body.color)
  g.addColorStop(1, shade(body.color, -35))
  ctx.fillStyle = g
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Highlight blob
  ctx.beginPath()
  ctx.ellipse(cx - 8, cy - 10, 8, 5, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fill()
}

function drawLid(ctx: CanvasRenderingContext2D, snap: SquishSnapshot) {
  const y = snap.lidY
  const left = VIEW_WIDTH / 2 - 108
  const right = VIEW_WIDTH / 2 + 108
  const sealing = snap.phase === 'sealing' || snap.phase === 'won'

  ctx.fillStyle = sealing ? 'rgba(200, 220, 240, 0.92)' : 'rgba(160, 180, 200, 0.35)'
  roundRect(ctx, left, y, right - left, 18, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Clamp bolts
  ctx.fillStyle = '#ffd56a'
  ctx.beginPath()
  ctx.arc(left + 14, y + 9, 4, 0, Math.PI * 2)
  ctx.arc(right - 14, y + 9, 4, 0, Math.PI * 2)
  ctx.fill()

  if (sealing) {
    ctx.font = `700 11px ${FONT}`
    ctx.fillStyle = 'rgba(30, 40, 60, 0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('LID', VIEW_WIDTH / 2, y + 13)
  }
}

function drawQueue(ctx: CanvasRenderingContext2D, snap: SquishSnapshot) {
  const startX = 24
  const y = 56
  ctx.font = `700 11px ${FONT}`
  ctx.fillStyle = 'rgba(255, 220, 240, 0.55)'
  ctx.textAlign = 'left'
  ctx.fillText('NEXT', startX, y - 14)

  snap.queue.slice(0, 5).forEach((item, i) => {
    const x = startX + i * 36
    ctx.beginPath()
    ctx.arc(x + 12, y + 10, 11 * Math.min(1, item.scale), 0, Math.PI * 2)
    ctx.fillStyle = item.color
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.stroke()
  })
}

function drawHud(ctx: CanvasRenderingContext2D, snap: SquishSnapshot) {
  const pct = Math.min(100, Math.round(snap.fillRatio * 100))
  ctx.font = `800 18px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffe6f5'
  ctx.fillText(`${pct}% filled`, VIEW_WIDTH - 22, 48)

  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(255, 200, 230, 0.5)'
  ctx.fillText(`${snap.dropped}/${snap.total} shapes`, VIEW_WIDTH - 22, 70)

  if (snap.phase === 'crowded' && snap.queue.length > 0) {
    ctx.textAlign = 'center'
    ctx.font = `700 14px ${FONT}`
    ctx.fillStyle = 'rgba(255, 200, 120, 0.75)'
    ctx.fillText('Getting tight…', VIEW_WIDTH / 2, 150)
  }
}

function drawWinStamp(ctx: CanvasRenderingContext2D, snap: SquishSnapshot) {
  const alpha = Math.min(1, snap.stampLife)
  const pct = Math.min(100, Math.round(snap.fillRatio * 100))
  ctx.save()
  ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.42)
  ctx.rotate(-0.06)
  const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.02
  ctx.scale(pulse, pulse)

  ctx.fillStyle = `rgba(255, 220, 80, ${0.2 * alpha})`
  roundRect(ctx, -170, -42, 340, 84, 10)
  ctx.fill()
  ctx.strokeStyle = `rgba(255, 230, 120, ${0.9 * alpha})`
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.font = `900 26px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = `rgba(255, 240, 160, ${alpha})`
  ctx.shadowColor = 'rgba(255, 180, 40, 0.5)'
  ctx.shadowBlur = 16
  ctx.fillText(
    pct >= 98 ? '100% VOLUME FILLED' : `${pct}% VOLUME FILLED`,
    0,
    0,
  )
  ctx.restore()
}

function drawOverflow(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(20, 0, 10, 0.45)'
  ctx.fillRect(0, VIEW_HEIGHT * 0.4, VIEW_WIDTH, 100)
  ctx.font = `800 24px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ff8ab0'
  ctx.fillText('OVERFLOW', VIEW_WIDTH / 2, VIEW_HEIGHT * 0.48)
  ctx.font = `600 13px ${FONT}`
  ctx.fillStyle = 'rgba(255,200,220,0.7)'
  ctx.fillText('Tap Reset to try again', VIEW_WIDTH / 2, VIEW_HEIGHT * 0.53)
}

function shade(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount)
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount)
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r},${g},${b})`
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
