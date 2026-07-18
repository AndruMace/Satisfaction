import {
  type Agent,
  type ClosingFloor,
  type Coin,
  COIN_RADIUS,
  type Deposit,
  type ImpactFlash,
  type LevelData,
  type MagnetWell,
  type OverlayState,
  type Particle,
  type Pit,
  type Platform,
  PLAYER_PROFILES,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Winner,
} from './types'
import { wealth } from './physics'

const FONT = '"Archivo Black", "Syne", system-ui, sans-serif'

const COLORS = {
  bgTop: '#1c1208',
  bgBot: '#080503',
  platform: '#6b5540',
  platformEdge: '#3d2e22',
  fragile: '#a86b3a',
  pit: '#120605',
  deposit: '#c9a227',
  depositGlow: 'rgba(255, 176, 32, 0.35)',
  coin: '#ffd24a',
  coinEdge: '#e09600',
  floor: '#e85d4c',
  magnet: 'rgba(255, 160, 40, 0.22)',
  moss: '#4a6b3a',
}

export type Camera = { x: number; y: number; zoom: number }

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 }
}

export function updateCamera(
  camera: Camera,
  agents: Agent[],
  level: LevelData,
  punch = 0,
) {
  const alive = agents.filter((a) => a.alive)
  let focusY = level.bounds.height * 0.25
  if (alive.length > 0) {
    focusY = alive.reduce((s, a) => s + a.y, 0) / alive.length
  }
  const targetY = Math.max(
    0,
    Math.min(level.bounds.height - VIEW_HEIGHT, focusY - VIEW_HEIGHT * 0.4),
  )
  camera.y += (targetY - camera.y) * 0.08
  camera.x = 0
  camera.zoom = 1
  if (punch !== 0) {
    camera.y += punch
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  level: LevelData,
  agents: Agent[],
  coins: Coin[],
  floor: ClosingFloor,
  particles: Particle[],
  flashes: ImpactFlash[],
  winner: Winner,
  overlay: OverlayState,
  depositRequired: boolean,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT)
  bg.addColorStop(0, COLORS.bgTop)
  bg.addColorStop(0.45, '#140c06')
  bg.addColorStop(1, COLORS.bgBot)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Warm torchlight glow
  const vig = ctx.createRadialGradient(
    VIEW_WIDTH / 2,
    VIEW_HEIGHT * 0.28,
    40,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT * 0.45,
    VIEW_HEIGHT * 0.8,
  )
  vig.addColorStop(0, 'rgba(255,160,40,0.08)')
  vig.addColorStop(0.5, 'rgba(180,60,20,0.04)')
  vig.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  // Cave rock grit
  ctx.fillStyle = 'rgba(255, 200, 120, 0.03)'
  for (let i = 0; i < 40; i++) {
    const x = ((i * 53) % VIEW_WIDTH) + 4
    const y = ((i * 97) % VIEW_HEIGHT) + 4
    ctx.fillRect(x, y, 2 + (i % 3), 1)
  }

  ctx.save()
  ctx.translate(-camera.x, -camera.y)

  for (const pit of level.pits) drawPit(ctx, pit)
  for (const magnet of level.magnets) drawMagnet(ctx, magnet, overlay.magnetPulse)
  for (const dep of level.deposits) drawDeposit(ctx, dep)
  for (const plat of level.platforms) drawPlatform(ctx, plat)
  for (const coin of coins) {
    if (coin.alive) drawCoin(ctx, coin)
  }
  if (floor.active) drawFloor(ctx, floor, level.bounds.width)

  for (const agent of agents) {
    if (agent.alive) {
      drawAgent(ctx, agent, overlay.rivalryIds.includes(agent.id))
    }
  }
  for (const p of particles) drawParticle(ctx, p)
  for (const flash of flashes) drawFlash(ctx, flash)

  ctx.restore()

  if (overlay.nameTags) {
    for (const agent of agents) {
      if (agent.alive) drawNameTag(ctx, camera, agent)
    }
  }

  if (overlay.scoreHud) {
    drawScoreHud(ctx, agents, depositRequired)
  }

  if (overlay.timerLabel) {
    drawTimer(ctx, overlay.timerLabel)
  }

  if (overlay.launchFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, overlay.launchFlash * 1.4)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.closingFloor) {
    const glow = ctx.createLinearGradient(0, VIEW_HEIGHT * 0.75, 0, VIEW_HEIGHT)
    glow.addColorStop(0, 'rgba(232, 93, 76, 0)')
    glow.addColorStop(1, 'rgba(232, 93, 76, 0.18)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.coinRain) {
    ctx.fillStyle = 'rgba(255, 212, 59, 0.06)'
    ctx.fillRect(0, 0, VIEW_WIDTH, 48)
  }

  if (overlay.hookLine) {
    drawCenterBanner(ctx, overlay.hookLine, '#ffd24a', 56, 22)
  }

  if (overlay.countdownValue !== null) {
    drawCountdown(ctx, overlay.countdownValue)
  }

  if (overlay.eventBanner) {
    drawCenterBanner(ctx, overlay.eventBanner, '#ffe8b0', VIEW_HEIGHT * 0.28)
  }

  if (overlay.slowMo > 0) {
    ctx.fillStyle = `rgba(20, 24, 36, ${Math.min(0.35, overlay.slowMo * 0.4)})`
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  if (overlay.photoFinish > 0) {
    ctx.strokeStyle = `rgba(255, 212, 59, ${Math.min(0.8, overlay.photoFinish)})`
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, VIEW_WIDTH - 20, VIEW_HEIGHT - 20)
  }

  if (winner) {
    drawWinnerBanner(ctx, winner, overlay.winMessage)
  }
}

function drawPit(ctx: CanvasRenderingContext2D, pit: Pit) {
  const g = ctx.createLinearGradient(0, pit.y, 0, pit.y + pit.h)
  g.addColorStop(0, 'rgba(5,6,8,0.4)')
  g.addColorStop(1, COLORS.pit)
  ctx.fillStyle = g
  ctx.fillRect(pit.x, pit.y, pit.w, pit.h)
  // Jagged lip
  ctx.strokeStyle = 'rgba(232, 93, 76, 0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pit.x, pit.y)
  let i = 0
  for (let x = pit.x; x <= pit.x + pit.w; x += 18) {
    ctx.lineTo(x, pit.y + (i++ % 2 === 0 ? 4 : -2))
  }
  ctx.stroke()
}

function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform) {
  const fragile = plat.sinkMass > 0
  const g = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h)
  if (fragile) {
    g.addColorStop(0, '#c4844a')
    g.addColorStop(1, COLORS.fragile)
  } else {
    g.addColorStop(0, '#7d6650')
    g.addColorStop(1, COLORS.platform)
  }
  ctx.fillStyle = g
  ctx.strokeStyle = COLORS.platformEdge
  ctx.lineWidth = 2
  roundRect(ctx, plat.x, plat.y, plat.w, plat.h, 3)
  ctx.fill()
  ctx.stroke()
  // Moss flecks on solid ledges
  if (!fragile) {
    ctx.fillStyle = COLORS.moss
    for (let i = 6; i < plat.w - 4; i += 18) {
      ctx.globalAlpha = 0.45
      ctx.fillRect(plat.x + i, plat.y + 2, 5, 2)
    }
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = 'rgba(40, 16, 4, 0.35)'
    for (let i = 8; i < plat.w - 4; i += 14) {
      ctx.fillRect(plat.x + i, plat.y + 4, 6, 2)
    }
  }
}

function drawDeposit(ctx: CanvasRenderingContext2D, dep: Deposit) {
  ctx.fillStyle = COLORS.depositGlow
  ctx.fillRect(dep.x - 4, dep.y - 4, dep.w + 8, dep.h + 8)
  const g = ctx.createLinearGradient(dep.x, dep.y, dep.x, dep.y + dep.h)
  g.addColorStop(0, '#e8c547')
  g.addColorStop(1, COLORS.deposit)
  ctx.fillStyle = g
  roundRect(ctx, dep.x, dep.y, dep.w, dep.h, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#1a1200'
  ctx.font = `400 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VAULT', dep.x + dep.w / 2, dep.y + dep.h / 2)
}

function drawMagnet(ctx: CanvasRenderingContext2D, m: MagnetWell, pulse: boolean) {
  const r = m.radius * (pulse ? 1.05 : 1)
  const g = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, r)
  g.addColorStop(0, 'rgba(255, 176, 32, 0.4)')
  g.addColorStop(1, 'rgba(255, 120, 40, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(m.x, m.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(m.x, m.y, r * 0.55, 0, Math.PI * 2)
  ctx.stroke()
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin) {
  const spark = coin.spark > 0 ? 1 + coin.spark * 0.4 : 1
  const r = COIN_RADIUS * spark
  const g = ctx.createRadialGradient(coin.x - 2, coin.y - 2, 1, coin.x, coin.y, r)
  g.addColorStop(0, '#fff3b0')
  g.addColorStop(0.45, COLORS.coin)
  g.addColorStop(1, COLORS.coinEdge)
  ctx.beginPath()
  ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = COLORS.coinEdge
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(coin.x - 2, coin.y - 2, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawFloor(ctx: CanvasRenderingContext2D, floor: ClosingFloor, width: number) {
  const g = ctx.createLinearGradient(0, floor.y - 30, 0, floor.y + 40)
  g.addColorStop(0, 'rgba(232, 93, 76, 0)')
  g.addColorStop(0.5, 'rgba(232, 93, 76, 0.55)')
  g.addColorStop(1, 'rgba(80, 20, 16, 0.95)')
  ctx.fillStyle = g
  ctx.fillRect(0, floor.y - 20, width, 80)
  ctx.fillStyle = COLORS.floor
  ctx.fillRect(0, floor.y, width, 12)
}

function drawAgent(ctx: CanvasRenderingContext2D, agent: Agent, rivalry: boolean) {
  // Trail
  for (let i = 0; i < agent.trail.length; i++) {
    const t = agent.trail[i]
    const a = (i + 1) / agent.trail.length
    ctx.fillStyle = hexAlpha(agent.color, a * 0.25)
    ctx.beginPath()
    ctx.arc(t.x, t.y, agent.radius * a * 0.7, 0, Math.PI * 2)
    ctx.fill()
  }

  // Vacuum ring
  ctx.strokeStyle = hexAlpha(agent.color, 0.2)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(agent.x, agent.y, agent.radius + 22, 0, Math.PI * 2)
  ctx.stroke()

  if (rivalry) {
    ctx.strokeStyle = 'rgba(255, 212, 59, 0.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(agent.x, agent.y, agent.radius + 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Body — size grows with mass visually via radius
  const g = ctx.createRadialGradient(
    agent.x - agent.radius * 0.3,
    agent.y - agent.radius * 0.3,
    2,
    agent.x,
    agent.y,
    agent.radius,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, agent.color)
  g.addColorStop(1, shade(agent.color, 0.55))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(agent.x, agent.y, agent.radius, 0, Math.PI * 2)
  ctx.fill()

  // Coin count badge
  if (agent.carried > 0) {
    ctx.fillStyle = COLORS.coin
    ctx.beginPath()
    ctx.arc(agent.x + agent.radius * 0.55, agent.y - agent.radius * 0.55, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1200'
    ctx.font = `400 10px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(agent.carried), agent.x + agent.radius * 0.55, agent.y - agent.radius * 0.55)
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const a = Math.max(0, p.life / p.maxLife)
  ctx.fillStyle = hexAlpha(p.color, a)
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
  ctx.fill()
}

function drawFlash(ctx: CanvasRenderingContext2D, flash: ImpactFlash) {
  const a = Math.max(0, flash.life * 8)
  ctx.fillStyle = hexAlpha(flash.color, Math.min(0.5, a))
  ctx.beginPath()
  ctx.arc(flash.x, flash.y, flash.radius * (1 + (0.12 - flash.life) * 4), 0, Math.PI * 2)
  ctx.fill()
}

function drawNameTag(ctx: CanvasRenderingContext2D, camera: Camera, agent: Agent) {
  const sx = agent.x - camera.x
  const sy = agent.y - camera.y - agent.radius - 16
  const profile = PLAYER_PROFILES.find((p) => p.id === agent.id)
  ctx.font = `400 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(12, 6, 2, 0.6)'
  const label = profile?.label ?? agent.id
  const w = ctx.measureText(label).width + 12
  roundRect(ctx, sx - w / 2, sy - 9, w, 18, 4)
  ctx.fill()
  ctx.fillStyle = '#ffe8b0'
  ctx.fillText(label, sx, sy)
}

function drawScoreHud(
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  depositRequired: boolean,
) {
  const ranked = [...agents].sort(
    (a, b) => wealth(b, depositRequired) - wealth(a, depositRequired),
  )
  let y = 72
  ctx.font = `400 12px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const agent of ranked) {
    const profile = PLAYER_PROFILES.find((p) => p.id === agent.id)
    const score = wealth(agent, depositRequired)
    const label = `${profile?.label ?? agent.id}  ${score}${agent.alive ? '' : ' out'}`
    ctx.fillStyle = agent.alive ? 'rgba(12, 6, 2, 0.55)' : 'rgba(12, 6, 2, 0.3)'
    roundRect(ctx, 12, y - 10, 124, 20, 4)
    ctx.fill()
    ctx.fillStyle = agent.alive ? agent.color : '#666'
    ctx.fillText(label, 20, y)
    y += 24
  }
}

function drawTimer(ctx: CanvasRenderingContext2D, label: string) {
  ctx.font = `400 16px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(12, 6, 2, 0.55)'
  roundRect(ctx, VIEW_WIDTH / 2 - 40, 14, 80, 28, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.4)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#ffe8b0'
  ctx.fillText(label, VIEW_WIDTH / 2, 28)
}

function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  const text = value <= 0 ? 'GO' : String(value)
  ctx.font = `400 92px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillText(text, VIEW_WIDTH / 2 + 3, VIEW_HEIGHT / 2 + 3)
  ctx.fillStyle = value <= 0 ? '#ffd24a' : '#ffe8b0'
  ctx.fillText(text, VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  size = 22,
) {
  ctx.font = `400 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = Math.min(VIEW_WIDTH - 40, ctx.measureText(text).width + 36)
  ctx.fillStyle = 'rgba(12, 6, 2, 0.7)'
  roundRect(ctx, VIEW_WIDTH / 2 - w / 2, y - size * 0.75, w, size * 1.5, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, VIEW_WIDTH / 2, y)
}

function drawWinnerBanner(
  ctx: CanvasRenderingContext2D,
  winner: Winner,
  winMessage: string | null,
) {
  if (!winner) return
  const profile = PLAYER_PROFILES.find((p) => p.id === winner)
  const message =
    winMessage?.toUpperCase() ?? `${profile?.label ?? winner} WINS`.toUpperCase()
  const size = winMessage && winMessage.length > 22 ? 22 : 30
  ctx.fillStyle = 'rgba(12, 6, 2, 0.7)'
  roundRect(ctx, 30, VIEW_HEIGHT * 0.42, VIEW_WIDTH - 60, 90, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.45)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = profile?.color ?? '#ffe8b0'
  ctx.font = `400 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(message, VIEW_WIDTH / 2, VIEW_HEIGHT * 0.42 + 45)
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

function shade(hex: string, factor: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor)
  return `rgb(${r},${g},${b})`
}
