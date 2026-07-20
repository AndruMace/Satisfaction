import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import type { ClearSnapshot } from './types'

const FONT = '"Orbitron", "Syne", system-ui, sans-serif'

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  snap: ClearSnapshot,
): void {
  ctx.save()
  drawVoid(ctx)
  drawNodes(ctx, snap)
  drawSparks(ctx, snap)
  drawParticles(ctx, snap)
  drawHud(ctx, snap)
  if (snap.phase === 'cleared' && snap.stampLife > 0) {
    drawClearStamp(ctx, snap.stampLife)
  }
  if (snap.phase === 'failed' && snap.failLife > 0) {
    drawFailBanner(ctx, snap)
  }
  if (snap.phase === 'ready') {
    drawReadyHint(ctx, snap)
  }
  ctx.restore()
}

function drawVoid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#03040a'
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  const g = ctx.createRadialGradient(
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    40,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    VIEW_HEIGHT * 0.55,
  )
  g.addColorStop(0, 'rgba(30, 40, 80, 0.22)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
}

function drawNodes(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  for (const node of snap.nodes) {
    if (!node.alive) continue
    const half = node.size * 0.5
    const cracked = node.kind === 'heavy' && node.hp < node.maxHp
    const flash = node.flash

    if (flash > 0) {
      ctx.fillStyle = `hsla(${node.hue}, 100%, 70%, ${0.2 + flash * 0.45})`
      ctx.fillRect(
        node.x - half - 3,
        node.y - half - 3,
        node.size + 6,
        node.size + 6,
      )
    }

    const light = node.kind === 'heavy' ? (cracked ? 58 : 52) : 62
    ctx.fillStyle = `hsl(${node.hue}, ${node.kind === 'heavy' ? 90 : 75}%, ${light}%)`
    roundRect(ctx, node.x - half, node.y - half, node.size, node.size, 2.5)
    ctx.fill()

    ctx.strokeStyle = `hsla(${node.hue}, 100%, 85%, ${0.35 + flash * 0.5})`
    ctx.lineWidth = node.kind === 'heavy' ? 1.8 : 1.1
    ctx.stroke()

    if (node.kind === 'heavy') {
      ctx.strokeStyle = cracked
        ? 'rgba(255, 220, 120, 0.85)'
        : 'rgba(255, 200, 80, 0.55)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      if (cracked) {
        ctx.moveTo(node.x - half * 0.5, node.y - half * 0.2)
        ctx.lineTo(node.x + half * 0.15, node.y + half * 0.45)
        ctx.moveTo(node.x + half * 0.1, node.y - half * 0.45)
        ctx.lineTo(node.x - half * 0.35, node.y + half * 0.35)
      } else {
        ctx.moveTo(node.x - half * 0.35, node.y)
        ctx.lineTo(node.x + half * 0.35, node.y)
        ctx.moveTo(node.x, node.y - half * 0.35)
        ctx.lineTo(node.x, node.y + half * 0.35)
      }
      ctx.stroke()
    }
  }
}

function drawSparks(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  for (const spark of snap.sparks) {
    const speed = Math.hypot(spark.vx, spark.vy)
    const trail = Math.min(18, speed * 0.028)
    const ang = Math.atan2(spark.vy, spark.vx)

    ctx.strokeStyle = `hsla(${spark.hue}, 100%, 70%, 0.35)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(spark.x, spark.y)
    ctx.lineTo(
      spark.x - Math.cos(ang) * trail,
      spark.y - Math.sin(ang) * trail,
    )
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(spark.x, spark.y, spark.radius + 2.5, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${spark.hue}, 100%, 70%, 0.25)`
    ctx.fill()

    ctx.beginPath()
    ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${spark.hue}, 100%, 85%)`
    ctx.fill()
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  for (const p of snap.particles) {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${a})`
    ctx.fill()
  }
}

function drawHud(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  ctx.font = `700 13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(220, 230, 255, 0.55)'
  ctx.fillText(snap.levelName.toUpperCase(), VIEW_WIDTH / 2, 36)

  ctx.font = `800 22px ${FONT}`
  ctx.fillStyle = snap.remaining === 0 ? '#ffe082' : '#eef3ff'
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 8
  ctx.fillText(`Shapes Remaining: ${snap.remaining}`, VIEW_WIDTH / 2, 68)
  ctx.shadowBlur = 0
}

function drawReadyHint(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  ctx.font = `600 12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(180, 200, 255, 0.4)'
  ctx.fillText('One spark. Tap to ignite.', VIEW_WIDTH / 2, VIEW_HEIGHT - 48)
  ctx.font = `500 11px ${FONT}`
  ctx.fillStyle = 'rgba(160, 180, 220, 0.32)'
  ctx.fillText(snap.levelName, VIEW_WIDTH / 2, VIEW_HEIGHT - 28)
}

function drawClearStamp(ctx: CanvasRenderingContext2D, life: number) {
  const t = Math.min(1, life / 0.35)
  const scale = 0.85 + (1 - Math.pow(1 - Math.min(1, 2.8 - life), 2)) * 0.2
  const alpha = Math.min(1, life * 1.2)

  ctx.save()
  ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
  ctx.scale(scale * (0.7 + t * 0.3), scale * (0.7 + t * 0.3))
  ctx.rotate(-0.08)

  ctx.fillStyle = `rgba(255, 200, 60, ${0.18 * alpha})`
  roundRect(ctx, -160, -48, 320, 96, 8)
  ctx.fill()

  ctx.strokeStyle = `rgba(255, 220, 100, ${0.85 * alpha})`
  ctx.lineWidth = 4
  roundRect(ctx, -160, -48, 320, 96, 8)
  ctx.stroke()

  ctx.font = `900 36px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = `rgba(255, 230, 120, ${alpha})`
  ctx.shadowColor = 'rgba(255, 180, 40, 0.55)'
  ctx.shadowBlur = 18
  ctx.fillText('100% CLEARED', 0, 0)
  ctx.restore()
}

function drawFailBanner(ctx: CanvasRenderingContext2D, snap: ClearSnapshot) {
  const alpha = Math.min(1, snap.failLife)
  ctx.fillStyle = `rgba(8, 4, 12, ${0.45 * alpha})`
  ctx.fillRect(0, VIEW_HEIGHT * 0.38, VIEW_WIDTH, 120)

  ctx.font = `800 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(255, 120, 140, ${alpha})`
  ctx.fillText('CASCADE STOPPED', VIEW_WIDTH / 2, VIEW_HEIGHT * 0.45)

  ctx.font = `600 14px ${FONT}`
  ctx.fillStyle = `rgba(230, 210, 220, ${0.75 * alpha})`
  ctx.fillText(
    `${snap.remaining} shape${snap.remaining === 1 ? '' : 's'} left — try again`,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT * 0.5,
  )
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
