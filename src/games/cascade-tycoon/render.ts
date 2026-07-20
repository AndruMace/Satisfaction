import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import { formatMult } from './format'
import type { CascadeSnapshot } from './types'
import { ZONE_BINS, ZONE_TOP } from './types'

const FONT = '"Orbitron", "Syne", system-ui, sans-serif'

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  snap: CascadeSnapshot,
): void {
  ctx.save()
  drawBackground(ctx)
  drawTopZone(ctx, snap)
  drawBins(ctx, snap)
  drawPegs(ctx, snap)
  drawBalls(ctx, snap)
  drawHudHint(ctx, snap)
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
  g.addColorStop(0, '#070b14')
  g.addColorStop(0.45, '#0b1220')
  g.addColorStop(1, '#06080f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Subtle vertical guides
  ctx.strokeStyle = 'rgba(100, 180, 255, 0.04)'
  ctx.lineWidth = 1
  for (let x = 40; x < VIEW_WIDTH; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, ZONE_TOP)
    ctx.lineTo(x, ZONE_BINS)
    ctx.stroke()
  }
}

function drawTopZone(ctx: CanvasRenderingContext2D, snap: CascadeSnapshot) {
  ctx.fillStyle = 'rgba(40, 80, 140, 0.18)'
  ctx.fillRect(0, 0, VIEW_WIDTH, ZONE_TOP)

  ctx.strokeStyle = 'rgba(120, 190, 255, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, ZONE_TOP)
  ctx.lineTo(VIEW_WIDTH, ZONE_TOP)
  ctx.stroke()

  ctx.font = `600 11px ${FONT}`
  ctx.fillStyle = 'rgba(180, 210, 255, 0.55)'
  ctx.textAlign = 'center'
  ctx.fillText('SPAWNER', VIEW_WIDTH / 2, 18)

  for (const emitter of snap.emitters) {
    const pulse = 0.55 + Math.sin(performance.now() * 0.008 + emitter.id) * 0.2
    ctx.beginPath()
    ctx.arc(emitter.x, ZONE_TOP * 0.55, 10, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(80, 200, 255, ${0.25 * pulse})`
    ctx.fill()
    ctx.strokeStyle = `rgba(120, 220, 255, ${0.7 * pulse})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Funnel notch
    ctx.beginPath()
    ctx.moveTo(emitter.x - 8, ZONE_TOP - 4)
    ctx.lineTo(emitter.x, ZONE_TOP + 6)
    ctx.lineTo(emitter.x + 8, ZONE_TOP - 4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(100, 210, 255, 0.45)'
    ctx.fill()
  }
}

function drawBins(ctx: CanvasRenderingContext2D, snap: CascadeSnapshot) {
  const h = VIEW_HEIGHT - ZONE_BINS
  for (const bin of snap.bins) {
    const w = bin.x1 - bin.x0
    const g = ctx.createLinearGradient(0, ZONE_BINS, 0, VIEW_HEIGHT)
    g.addColorStop(0, hexAlpha(bin.color, 0.22))
    g.addColorStop(1, hexAlpha(bin.color, 0.5))
    ctx.fillStyle = g
    ctx.fillRect(bin.x0, ZONE_BINS, w, h)

    ctx.strokeStyle = hexAlpha(bin.color, 0.55)
    ctx.lineWidth = 1.5
    ctx.strokeRect(bin.x0 + 0.5, ZONE_BINS + 0.5, w - 1, h - 1)

    ctx.font = `800 ${bin.multiplier >= 50 ? 16 : 14}px ${FONT}`
    ctx.fillStyle = bin.multiplier >= 50 ? '#ffe082' : '#e8f4ff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatMult(bin.multiplier), (bin.x0 + bin.x1) / 2, ZONE_BINS + h * 0.45)
  }

  ctx.strokeStyle = 'rgba(255, 200, 80, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, ZONE_BINS)
  ctx.lineTo(VIEW_WIDTH, ZONE_BINS)
  ctx.stroke()
}

function drawPegs(ctx: CanvasRenderingContext2D, snap: CascadeSnapshot) {
  for (const peg of snap.pegs) {
    if (peg.kind === 'bumper') {
      const glow = 0.35 + peg.flash * 0.55
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius + 5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 120, 40, ${glow * 0.35})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fillStyle = peg.flash > 0 ? '#ffb074' : '#ff6b2c'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 230, 180, 0.85)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      const flash = peg.flash
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius + (flash > 0 ? 3 : 0), 0, Math.PI * 2)
      ctx.fillStyle =
        flash > 0
          ? `rgba(120, 220, 255, ${0.35 + flash * 0.45})`
          : 'rgba(70, 110, 160, 0.85)'
      ctx.fill()
      ctx.strokeStyle =
        flash > 0 ? 'rgba(200, 240, 255, 0.9)' : 'rgba(140, 180, 220, 0.45)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
}

function drawBalls(ctx: CanvasRenderingContext2D, snap: CascadeSnapshot) {
  for (const ball of snap.balls) {
    if (!ball.alive) continue
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius + 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 230, 120, 0.2)'
    ctx.fill()

    const g = ctx.createRadialGradient(
      ball.x - 2,
      ball.y - 2,
      1,
      ball.x,
      ball.y,
      ball.radius,
    )
    g.addColorStop(0, '#fff6c8')
    g.addColorStop(1, '#f0b429')
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
  }
}

function drawHudHint(ctx: CanvasRenderingContext2D, snap: CascadeSnapshot) {
  if (snap.ballsDropped > 8) return
  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(200, 220, 255, 0.4)'
  ctx.textAlign = 'center'
  ctx.fillText('Tap ceiling to drop', VIEW_WIDTH / 2, ZONE_TOP + 22)
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }
  return hex
}
