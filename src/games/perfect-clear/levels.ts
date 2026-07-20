import { VIEW_HEIGHT, VIEW_WIDTH } from '../../shared/types'
import type { LevelDef, NodeKind } from './types'
import { NODE_DEFAULT_SIZE } from './types'

const CX = VIEW_WIDTH / 2
const CY = VIEW_HEIGHT / 2

type Point = { x: number; y: number; size?: number; kind?: NodeKind; hue?: number }

function ring(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  opts?: { size?: number; kind?: NodeKind; hue?: number; phase?: number },
): Point[] {
  const out: Point[] = []
  const phase = opts?.phase ?? 0
  for (let i = 0; i < count; i++) {
    const a = phase + (Math.PI * 2 * i) / count
    out.push({
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius,
      size: opts?.size,
      kind: opts?.kind,
      hue: opts?.hue ?? (a / (Math.PI * 2)) * 360,
    })
  }
  return out
}

function gridDisc(
  cx: number,
  cy: number,
  radius: number,
  step: number,
  opts?: { size?: number; hueBase?: number },
): Point[] {
  const out: Point[] = []
  const size = opts?.size ?? NODE_DEFAULT_SIZE
  for (let y = cy - radius; y <= cy + radius; y += step) {
    for (let x = cx - radius; x <= cx + radius; x += step) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > radius * radius) continue
      const ang = Math.atan2(dy, dx)
      out.push({
        x,
        y,
        size,
        hue: (opts?.hueBase ?? 200) + (ang / Math.PI) * 40,
      })
    }
  }
  return out
}

function mandalaBasic(): Point[] {
  const pts: Point[] = []
  pts.push({ x: CX, y: CY, size: 16, hue: 45 })
  pts.push(...ring(CX, CY, 36, 8, { size: 13, hue: 190 }))
  pts.push(...ring(CX, CY, 72, 16, { size: 12, hue: 200 }))
  pts.push(...ring(CX, CY, 108, 24, { size: 11, hue: 210 }))
  pts.push(...ring(CX, CY, 144, 32, { size: 11, hue: 220 }))
  pts.push(...ring(CX, CY, 180, 36, { size: 10, hue: 230 }))
  return pts
}

function diamondLattice(): Point[] {
  const pts: Point[] = []
  const step = 22
  const layers = 9
  for (let row = -layers; row <= layers; row++) {
    const count = layers - Math.abs(row) + 1
    for (let i = 0; i < count; i++) {
      const x = CX + (i - (count - 1) / 2) * step
      const y = CY + row * step * 0.58
      pts.push({
        x,
        y,
        size: 12,
        hue: 160 + Math.abs(row) * 8 + i * 2,
      })
    }
  }
  return pts
}

function heavyCoreMandala(): Point[] {
  const pts: Point[] = []
  // Outer rings (normal)
  pts.push(...ring(CX, CY, 200, 40, { size: 10, hue: 265 }))
  pts.push(...ring(CX, CY, 168, 34, { size: 11, hue: 250 }))
  pts.push(...ring(CX, CY, 136, 28, { size: 11, hue: 240 }))
  pts.push(...ring(CX, CY, 104, 22, { size: 12, hue: 230 }))
  pts.push(...ring(CX, CY, 72, 16, { size: 12, hue: 220 }))
  // Inner heavy ring — need clever pathing
  pts.push(
    ...ring(CX, CY, 40, 8, { size: 14, kind: 'heavy', hue: 20 }),
  )
  pts.push({ x: CX, y: CY, size: 16, kind: 'heavy', hue: 35 })
  return pts
}

function pixelGlyph(): Point[] {
  // Dense square mandala with arms — pixel-art feel
  const pts: Point[] = []
  const step = 18
  const cells: Array<[number, number]> = []
  for (let gy = -10; gy <= 10; gy++) {
    for (let gx = -10; gx <= 10; gx++) {
      const ax = Math.abs(gx)
      const ay = Math.abs(gy)
      const inCross = ax <= 2 || ay <= 2
      const inDiamond = ax + ay <= 10
      const inRing = ax + ay >= 7 && ax + ay <= 9
      if ((inDiamond && inCross) || inRing || (ax <= 8 && ay <= 8 && ax + ay === 12)) {
        cells.push([gx, gy])
      }
    }
  }
  for (const [gx, gy] of cells) {
    pts.push({
      x: CX + gx * step,
      y: CY + gy * step,
      size: 13,
      hue: 280 + gx * 4 + gy * 3,
      kind: Math.abs(gx) + Math.abs(gy) <= 2 ? 'heavy' : 'normal',
    })
  }
  return pts
}

function starburst(): Point[] {
  const pts: Point[] = []
  pts.push(...gridDisc(CX, CY, 55, 18, { size: 12, hueBase: 40 }))
  for (let arm = 0; arm < 8; arm++) {
    const a = (Math.PI * 2 * arm) / 8
    for (let r = 70; r <= 210; r += 18) {
      pts.push({
        x: CX + Math.cos(a) * r,
        y: CY + Math.sin(a) * r,
        size: 11,
        hue: 30 + arm * 35 + r * 0.2,
        kind: r > 160 && arm % 2 === 0 ? 'heavy' : 'normal',
      })
      // Side thickeners
      if (r > 90 && r < 180) {
        const perp = a + Math.PI / 2
        pts.push({
          x: CX + Math.cos(a) * r + Math.cos(perp) * 14,
          y: CY + Math.sin(a) * r + Math.sin(perp) * 14,
          size: 10,
          hue: 50 + arm * 30,
        })
        pts.push({
          x: CX + Math.cos(a) * r - Math.cos(perp) * 14,
          y: CY + Math.sin(a) * r - Math.sin(perp) * 14,
          size: 10,
          hue: 50 + arm * 30,
        })
      }
    }
  }
  return pts
}

export const LEVELS: LevelDef[] = [
  {
    id: 'spark-ring',
    name: 'Spark Ring',
    hint: 'Tap near the outer ring — one spark starts everything.',
    nodes: mandalaBasic(),
  },
  {
    id: 'lattice',
    name: 'Crystal Lattice',
    hint: 'Dense diamond — aim for a corner seam.',
    nodes: diamondLattice(),
  },
  {
    id: 'heavy-core',
    name: 'Heavy Core',
    hint: 'Gold nodes need two hits. Feed the cascade back inward.',
    nodes: heavyCoreMandala(),
  },
  {
    id: 'glyph',
    name: 'Pixel Glyph',
    hint: 'Cross + ring. The center is heavy.',
    nodes: pixelGlyph(),
  },
  {
    id: 'starburst',
    name: 'Starburst',
    hint: 'Arms and tips — find the loop that reaches every tip.',
    nodes: starburst(),
  },
]

export function getLevel(index: number): LevelDef {
  const i = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length
  return LEVELS[i]
}
