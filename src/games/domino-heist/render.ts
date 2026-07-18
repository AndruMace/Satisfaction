import type { Camera } from './camera'
import {
  type Blocker,
  type Chain,
  type ImpactFlash,
  type LevelData,
  type OverlayState,
  type Particle,
  type Platform,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'

const FONT = '"Cinzel", "Syne", Georgia, serif'

const COLORS = {
  bgTop: '#0d1a14',
  bgBot: '#050a08',
  platform: '#8a7348',
  platformEdge: '#5c4a2e',
  vault: '#e8c547',
  vaultGlow: 'rgba(232, 197, 71, 0.32)',
  blocker: '#c9a227',
  blockerCore: '#1a241c',
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  level: LevelData,
  chains: Chain[],
  blockers: Blocker[],
  particles: Particle[],
  flashes: ImpactFlash[],
  winner: Winner,
  overlay: OverlayState,
) {
  ctx.save()
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
  bg.addColorStop(0, COLORS.bgTop)
  bg.addColorStop(1, COLORS.bgBot)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Noir diamond lattice
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.045)'
  ctx.lineWidth = 1
  for (let y = -40; y < VIEW_HEIGHT + 40; y += 36) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(VIEW_WIDTH, y + VIEW_WIDTH * 0.35)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(VIEW_WIDTH, y)
    ctx.lineTo(0, y + VIEW_WIDTH * 0.35)
    ctx.stroke()
  }

  // Emerald wash
  const wash = ctx.createRadialGradient(
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.15,
    20,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.2,
    VIEW_HEIGHT * 0.55,
  )
  wash.addColorStop(0, 'rgba(45, 106, 79, 0.14)')
  wash.addColorStop(1, 'rgba(45, 106, 79, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  ctx.scale(camera.zoom, camera.zoom)
  ctx.translate(-camera.x, -camera.y)

  drawVault(ctx, level, overlay.heistAlarm)
  for (const platform of level.platforms) drawPlatform(ctx, platform)

  // Missing-tooth gaps — dashed hazard marks so stalls read as intentional
  drawGaps(ctx, level, chains)

  for (const chain of chains) {
    for (const domino of chain.dominos) {
      if (domino.state === 'shattered') continue
      drawDomino(
        ctx,
        domino,
        chain.color,
        overlay.rivalryIds.includes(chain.id),
        !chain.alive,
      )
    }
    if (chain.alive && chain.stallTimer > 0.28) {
      drawStallCue(ctx, chain)
    }
  }

  for (const blocker of blockers) drawBlocker(ctx, blocker)
  for (const p of particles) drawParticle(ctx, p)
  for (const flash of flashes) drawFlash(ctx, flash)

  ctx.restore()

  if (overlay.nameTags) {
    for (const chain of chains) {
      if (!chain.alive) continue
      const tip =
        chain.dominos.find((d) => d.state === 'tipping') ??
        chain.dominos[Math.max(0, chain.tipFront)] ??
        chain.dominos[0]
      if (tip) drawNameTagScreen(ctx, camera, tip.x, tip.y - 28, chain.label, chain.color)
    }
  }

  if (overlay.launchFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, overlay.launchFlash * 1.3)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.heistAlarm) {
    const glow = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
    glow.addColorStop(0, 'rgba(255, 70, 70, 0.08)')
    glow.addColorStop(0.5, 'rgba(255, 70, 70, 0)')
    glow.addColorStop(1, 'rgba(212, 175, 55, 0.12)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.hookLine) {
    drawCenterBanner(ctx, overlay.hookLine, '#e8c547', 56, 24)
  }

  if (overlay.countdownValue !== null) {
    drawCountdown(ctx, overlay.countdownValue)
  }

  if (overlay.eventBanner) {
    drawCenterBanner(ctx, overlay.eventBanner, '#f0e6c8', VIEW_HEIGHT * 0.28)
  }

  if (overlay.photoFinish > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + overlay.photoFinish * 0.05})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawCenterBanner(ctx, 'PHOTO FINISH', '#ffffff', VIEW_HEIGHT * 0.4, 34)
  }

  if (overlay.photoFinish <= 0 && (winner || overlay.winMessage)) {
    drawWinnerBanner(ctx, winner, chains, overlay.winMessage)
  }

  drawProgressTrack(ctx, level, chains, overlay.rivalryIds)
}

/** Mark missing-tooth gaps from the level data. */
function drawGaps(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  chains: Chain[],
) {
  for (let slot = 0; slot < chains.length; slot++) {
    const chain = chains[slot]
    for (const tooth of level.missingTeeth) {
      if (tooth.chainSlot !== slot) continue
      const a = chain.dominos[tooth.afterIndex]
      const b = chain.dominos[tooth.afterIndex + 1]
      if (!a || !b) continue
      if (a.state === 'shattered' && b.state === 'shattered') continue
      // Settings can disable missing teeth — skip if the gap wasn't applied.
      if (b.y - a.y < 48) continue
      const midY = (a.y + b.y) / 2
      const x = a.x
      ctx.save()
      ctx.strokeStyle = chain.alive
        ? 'rgba(232, 197, 71, 0.55)'
        : 'rgba(120, 110, 90, 0.35)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.moveTo(x, a.y + a.h * 0.45)
      ctx.lineTo(x, b.y - b.h * 0.45)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = chain.alive
        ? 'rgba(232, 197, 71, 0.4)'
        : 'rgba(120, 110, 90, 0.25)'
      ctx.lineWidth = 1.5
      for (let t = -1; t <= 1; t++) {
        ctx.beginPath()
        ctx.moveTo(x - 7, midY + t * 8)
        ctx.lineTo(x + 7, midY + t * 8)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

function drawStallCue(ctx: CanvasRenderingContext2D, chain: Chain) {
  const front =
    chain.dominos[Math.max(0, chain.tipFront)] ??
    chain.dominos.find((d) => d.state === 'fallen') ??
    chain.dominos[0]
  if (!front) return
  const pulse = 0.45 + Math.min(0.45, chain.stallTimer * 0.5)
  ctx.save()
  ctx.globalAlpha = pulse
  ctx.font = `700 10px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#e8c547'
  ctx.fillText('STALLING', front.x, front.y + 28)
  ctx.restore()
}

function drawVault(ctx: CanvasRenderingContext2D, level: LevelData, glow: boolean) {
  const y = level.vaultY + 28
  const x = 48
  const w = level.bounds.width - 96
  const h = 56

  if (glow) {
    ctx.fillStyle = COLORS.vaultGlow
    ctx.beginPath()
    roundRect(ctx, x - 8, y - 10, w + 16, h + 20, 12)
    ctx.fill()
  }

  ctx.fillStyle = '#0e1612'
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, 6)
  ctx.fill()

  // Brass frame
  ctx.strokeStyle = COLORS.vault
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 4)
  ctx.stroke()

  // Art-deco chevrons
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.4)'
  ctx.lineWidth = 1.5
  const midX = level.bounds.width / 2
  for (let i = 0; i < 3; i++) {
    const cy = y + 14 + i * 12
    ctx.beginPath()
    ctx.moveTo(midX - 28, cy)
    ctx.lineTo(midX, cy + 6)
    ctx.lineTo(midX + 28, cy)
    ctx.stroke()
  }

  ctx.fillStyle = COLORS.vault
  ctx.font = `700 13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VAULT', midX, y + h - 14)
}

function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform) {
  const g = ctx.createLinearGradient(platform.x, 0, platform.x + platform.w, 0)
  g.addColorStop(0, shade(COLORS.platform, -30))
  g.addColorStop(0.5, COLORS.platform)
  g.addColorStop(1, shade(COLORS.platform, -20))
  ctx.fillStyle = g
  ctx.beginPath()
  roundRect(ctx, platform.x, platform.y, platform.w, platform.h, 2)
  ctx.fill()
  ctx.strokeStyle = COLORS.platformEdge
  ctx.lineWidth = 1
  ctx.stroke()
  // Brass highlight rail
  ctx.fillStyle = 'rgba(232, 197, 71, 0.35)'
  ctx.fillRect(platform.x + 2, platform.y + 1, platform.w - 4, 1.5)
}

function drawDomino(
  ctx: CanvasRenderingContext2D,
  domino: { x: number; y: number; w: number; h: number; angle: number; isVault: boolean; state: string },
  color: string,
  rivalry: boolean,
  eliminated: boolean,
) {
  ctx.save()
  ctx.translate(domino.x, domino.y)
  ctx.rotate(domino.angle)

  const w = domino.w
  const h = domino.h
  const fallen = domino.state === 'fallen'
  // Dead chains read as ash — not still racing.
  if (eliminated) {
    ctx.globalAlpha = fallen ? 0.18 : 0.22
  } else {
    ctx.globalAlpha = fallen ? 0.5 : 1
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h)

  const body = eliminated ? shade(color, -55) : color
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  grad.addColorStop(0, shade(body, -28))
  grad.addColorStop(0.45, body)
  grad.addColorStop(1, shade(body, 22))
  ctx.fillStyle = grad
  ctx.beginPath()
  roundRect(ctx, -w / 2, -h / 2, w, h, 2)
  ctx.fill()

  if (domino.isVault) {
    // Win target — bright gold frame + lock pip
    ctx.strokeStyle = COLORS.vault
    ctx.lineWidth = 2.5
    ctx.stroke()
    if (!eliminated && !fallen) {
      ctx.fillStyle = COLORS.vault
      ctx.beginPath()
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(15, 20, 14, 0.7)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, -1.2, 2.2, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Domino pips
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.arc(0, -h * 0.22, 1.6, 0, Math.PI * 2)
  ctx.arc(0, h * 0.22, 1.6, 0, Math.PI * 2)
  ctx.fill()

  if (rivalry && !eliminated) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4)
  }

  ctx.restore()
}

function drawBlocker(ctx: CanvasRenderingContext2D, blocker: Blocker) {
  ctx.fillStyle = COLORS.blockerCore
  ctx.beginPath()
  roundRect(ctx, blocker.x, blocker.y, blocker.w, blocker.h, 4)
  ctx.fill()
  ctx.strokeStyle = COLORS.blocker
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(blocker.x + 4, blocker.y + 3, blocker.w - 8, 2)
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = Math.max(0, p.life / p.maxLife)
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  ctx.globalAlpha = 1
}

function drawFlash(ctx: CanvasRenderingContext2D, flash: ImpactFlash) {
  const alpha = Math.max(0, flash.life * 8)
  ctx.globalAlpha = Math.min(0.7, alpha)
  ctx.fillStyle = flash.color
  ctx.beginPath()
  ctx.arc(flash.x, flash.y, flash.radius * (1.2 - flash.life * 4), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawProgressTrack(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  chains: Chain[],
  rivalryIds: Chain['id'][],
) {
  const trackX = VIEW_WIDTH - 28
  const trackTop = 72
  const trackBottom = VIEW_HEIGHT - 72
  const trackHeight = trackBottom - trackTop
  const span = Math.max(1, level.vaultY - level.startY)

  ctx.save()
  ctx.fillStyle = 'rgba(5, 12, 8, 0.55)'
  ctx.beginPath()
  roundRect(ctx, trackX - 10, trackTop - 18, 28, trackHeight + 36, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = 'rgba(45, 106, 79, 0.45)'
  ctx.fillRect(trackX - 3, trackTop, 6, trackHeight)

  ctx.fillStyle = COLORS.vault
  ctx.fillRect(trackX - 9, trackBottom - 1, 18, 2)
  ctx.font = `700 8px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('GOAL', trackX, trackBottom + 12)

  for (const chain of chains) {
    const front = chain.dominos[Math.max(0, chain.tipFront)] ?? chain.dominos[0]
    if (!front) continue
    const t = Math.max(0, Math.min(1, (front.y - level.startY) / span))
    const y = trackTop + t * trackHeight
    if (!chain.alive) {
      // Ghost mark at death point — clearly not racing
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = chain.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(trackX - 4, y - 4)
      ctx.lineTo(trackX + 4, y + 4)
      ctx.moveTo(trackX + 4, y - 4)
      ctx.lineTo(trackX - 4, y + 4)
      ctx.stroke()
      ctx.globalAlpha = 1
      continue
    }
    const rivalry = rivalryIds.includes(chain.id)
    ctx.fillStyle = chain.color
    ctx.beginPath()
    ctx.arc(trackX, y, rivalry ? 6 : 4.5, 0, Math.PI * 2)
    ctx.fill()
    if (chain.stallTimer > 0.28) {
      ctx.strokeStyle = '#e8c547'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(trackX, y, 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawNameTagScreen(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  worldX: number,
  worldY: number,
  label: string,
  color: string,
) {
  const x = (worldX - camera.x) * camera.zoom
  const y = (worldY - camera.y) * camera.zoom
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, x + 1, y + 1)
  ctx.fillStyle = color
  ctx.fillText(label, x, y)
}

function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  const text = value <= 0 ? 'GO' : String(value)
  ctx.font = `800 96px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillText(text, VIEW_WIDTH / 2 + 3, VIEW_HEIGHT * 0.42 + 3)
  ctx.fillStyle = value <= 0 ? '#e8c547' : '#f0e6c8'
  ctx.fillText(text, VIEW_WIDTH / 2, VIEW_HEIGHT * 0.42)
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  size = 28,
) {
  ctx.font = `700 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const width = ctx.measureText(text).width + 36
  ctx.fillStyle = 'rgba(5, 12, 8, 0.7)'
  ctx.beginPath()
  roundRect(ctx, VIEW_WIDTH / 2 - width / 2, y - size * 0.7, width, size * 1.4, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, VIEW_WIDTH / 2, y)
}

function drawWinnerBanner(
  ctx: CanvasRenderingContext2D,
  winner: Winner,
  chains: Chain[],
  winMessage: string | null,
) {
  if (!winner) {
    drawCenterBanner(
      ctx,
      winMessage ?? 'No one cracks the vault',
      '#f0e6c8',
      VIEW_HEIGHT * 0.46,
      24,
    )
    return
  }
  const chain = chains.find((c) => c.id === winner)
  const label = chain?.label ?? winner
  const message = winMessage ?? `${label} cracks the vault`
  drawCenterBanner(ctx, message, chain?.color ?? '#fff', VIEW_HEIGHT * 0.46, 26)
}

function shade(hex: string, amount: number): string {
  const raw = hex.replace('#', '')
  const num = parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
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
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
