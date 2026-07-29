import * as THREE from 'three'
import { formatOp } from './courses'
import { previewGateColors, type GateRushWorld } from './sim'
import {
  GATE_D,
  GATE_GAP_W,
  GATE_H,
  GATE_W,
  ROAD_HALF,
  ROAD_WIDTH,
  UNIT_RADIUS,
  toWorldX,
  toWorldZ,
} from './space'
import type { GateOp, GatePair } from './types'
import { GATE_GHOST_DUR, MAX_UNITS, VIEW_WIDTH } from './types'

const BG = 0x080a0e

export type GateRushScene = {
  sync: (world: GateRushWorld, time: number) => void
  render: () => void
  setSize: (cssW: number, cssH: number, dpr: number) => void
  dispose: () => void
}

type GateDoorMeshes = {
  group: THREE.Group
  left: THREE.Mesh
  right: THREE.Mesh
  leftLabel: THREE.Sprite
  rightLabel: THREE.Sprite
  leftMat: THREE.MeshStandardMaterial
  rightMat: THREE.MeshStandardMaterial
  leftCanvas: HTMLCanvasElement
  rightCanvas: HTMLCanvasElement
  leftTex: THREE.CanvasTexture
  rightTex: THREE.CanvasTexture
  leftLabelMat: THREE.SpriteMaterial
  rightLabelMat: THREE.SpriteMaterial
  gateId: number
  lastCount: number
}

type HazardMeshes = {
  group: THREE.Group
  kind: 'saw' | 'spike'
  hazardId: number
  spin: THREE.Object3D
}

type BlockerMeshes = {
  group: THREE.Group
  left: THREE.Mesh
  right: THREE.Mesh
  matL: THREE.MeshStandardMaterial
  matR: THREE.MeshStandardMaterial
  label: THREE.Sprite
  labelMat: THREE.SpriteMaterial
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
  blockerId: number
  lastReq: number
  leftHome: THREE.Vector3
  rightHome: THREE.Vector3
}

type PopupSprite = {
  sprite: THREE.Sprite
  mat: THREE.SpriteMaterial
  tex: THREE.CanvasTexture
  canvas: HTMLCanvasElement
  id: number
}

function makeLabelTexture(text: string, color: string, size = 512): {
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
} {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  paintLabel(canvas, text, color)
  return { canvas, tex }
}

function paintLabel(canvas: HTMLCanvasElement, text: string, color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  // Solid plate so the op reads even at distance / in fog
  ctx.fillStyle = 'rgba(8, 12, 18, 0.92)'
  roundRect2d(ctx, w * 0.06, h * 0.18, w * 0.88, h * 0.64, 36)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 10
  roundRect2d(ctx, w * 0.06, h * 0.18, w * 0.88, h * 0.64, 36)
  ctx.stroke()
  ctx.font = `800 ${Math.floor(w * 0.36)}px Impact, "Arial Black", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 18
  ctx.strokeStyle = '#000000'
  ctx.strokeText(text, w / 2, h / 2 + 6)
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2 + 6)
}

function paintPopup(canvas: HTMLCanvasElement, text: string, color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.font = `800 ${Math.floor(h * 0.42)}px "Archivo Black", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 12
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.strokeText(text, w / 2, h / 2)
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2)
}

function paintCount(canvas: HTMLCanvasElement, n: number, color = '#fff7d6') {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const text = String(Math.round(n))
  ctx.font = `800 ${Math.floor(h * 0.55)}px "Archivo Black", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 16
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.strokeText(text, w / 2, h / 2)
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2)
}

function paintDramaBanner(canvas: HTMLCanvasElement, text: string, color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.font = `800 ${Math.floor(h * 0.38)}px "Archivo Black", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 20
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'
  ctx.strokeText(text, w / 2, h / 2)
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2)
}

function paintBanner(canvas: HTMLCanvasElement, title: string, sub: string, color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.font = `800 ${Math.floor(h * 0.28)}px "Archivo Black", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 18
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.strokeText(title, w / 2, h * 0.38)
  ctx.fillStyle = color
  ctx.fillText(title, w / 2, h * 0.38)
  ctx.font = `700 ${Math.floor(h * 0.12)}px "Syne", sans-serif`
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 8
  ctx.strokeText(sub, w / 2, h * 0.62)
  ctx.fillStyle = '#fff7d6'
  ctx.fillText(sub, w / 2, h * 0.62)
}

function roundRect2d(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function opColor(op: GateOp, good: boolean): string {
  if (good) return '#3dff9a'
  if (op.kind === 'sub' || op.kind === 'div') return '#ff3d6e'
  return '#ff8a5c'
}

export function createGateRushScene(canvas: HTMLCanvasElement): GateRushScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(BG, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(0x0a0e14, 12, 72)

  const camera = new THREE.PerspectiveCamera(58, 9 / 16, 0.1, 220)
  // Behind the crowd looking down -Z (forward)
  camera.position.set(0, 3.4, 7.5)

  // Lights
  scene.add(new THREE.AmbientLight(0x7a8aa0, 0.48))
  const sun = new THREE.DirectionalLight(0xfff0d4, 1.85)
  sun.position.set(-6, 14, -4)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x5eb8ff, 0.4)
  fill.position.set(6, 3, 8)
  scene.add(fill)
  const neon = new THREE.PointLight(0xffe14a, 2.6, 36)
  neon.position.set(0, 2.6, 0)
  scene.add(neon)
  const greenGlow = new THREE.PointLight(0x3dff9a, 1.6, 30)
  greenGlow.position.set(0, 2, 8)
  scene.add(greenGlow)

  // Sky backdrop band
  {
    const skyGeo = new THREE.SphereGeometry(120, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x121820,
      side: THREE.BackSide,
      fog: false,
    })
    const sky = new THREE.Mesh(skyGeo, skyMat)
    sky.position.y = -2
    scene.add(sky)
  }

  // Horizon glow
  {
    const geo = new THREE.PlaneGeometry(100, 28)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe14a,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      fog: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, 5, -90)
    scene.add(mesh)
  }

  // Side blocks for depth parallax
  const sideGroup = new THREE.Group()
  scene.add(sideGroup)
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x151b24,
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0x0a1018,
    emissiveIntensity: 0.4,
  })
  const sideBlocks: THREE.Mesh[] = []
  for (let i = 0; i < 28; i++) {
    const h = 1.2 + (i % 5) * 0.7
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4 + (i % 3) * 0.4, h, 2.2),
      blockMat,
    )
    const side = i % 2 === 0 ? -1 : 1
    mesh.position.set(side * (ROAD_HALF + 2.2 + (i % 4) * 0.35), h / 2, 0)
    sideBlocks.push(mesh)
    sideGroup.add(mesh)
  }

  // Road
  const roadGroup = new THREE.Group()
  scene.add(roadGroup)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x141a22,
    roughness: 0.95,
    metalness: 0.04,
  })
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH + 1.6, 180)
  const road = new THREE.Mesh(roadGeo, roadMat)
  road.rotation.x = -Math.PI / 2
  road.position.y = 0
  roadGroup.add(road)

  // Shoulder asphalt
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x0e1218,
    roughness: 1,
    metalness: 0,
  })
  const shoulder = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH + 8, 180),
    shoulderMat,
  )
  shoulder.rotation.x = -Math.PI / 2
  shoulder.position.y = -0.02
  roadGroup.add(shoulder)

  // Lane dashes as repeating boxes we'll reposition
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xffe14a,
    emissive: 0xffe14a,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  })
  const dashGeo = new THREE.BoxGeometry(0.18, 0.04, 1.4)
  const dashes: THREE.Mesh[] = []
  for (let i = 0; i < 48; i++) {
    const d = new THREE.Mesh(dashGeo, dashMat)
    dashes.push(d)
    roadGroup.add(d)
  }

  // Side rails
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x2a3340,
    roughness: 0.7,
    metalness: 0.25,
    emissive: 0x111820,
    emissiveIntensity: 0.4,
  })
  const railGeo = new THREE.BoxGeometry(0.22, 0.55, 180)
  const leftRail = new THREE.Mesh(railGeo, railMat)
  leftRail.position.set(-ROAD_HALF - 0.2, 0.28, 0)
  const rightRail = new THREE.Mesh(railGeo, railMat.clone())
  rightRail.position.set(ROAD_HALF + 0.2, 0.28, 0)
  roadGroup.add(leftRail, rightRail)

  // Shoulder stripes
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
  const stripeGeo = new THREE.BoxGeometry(0.08, 0.03, 180)
  const ls = new THREE.Mesh(stripeGeo, stripeMat)
  ls.position.set(-ROAD_HALF + 0.35, 0.02, 0)
  const rs = new THREE.Mesh(stripeGeo, stripeMat)
  rs.position.set(ROAD_HALF - 0.35, 0.02, 0)
  roadGroup.add(ls, rs)

  // Crowd as capsule “army” bodies — denser, more readable growth
  const unitGeo = new THREE.CapsuleGeometry(UNIT_RADIUS * 0.72, UNIT_RADIUS * 1.35, 4, 8)
  const unitMat = new THREE.MeshStandardMaterial({
    color: 0xffe14a,
    emissive: 0xffaa22,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.12,
  })
  const crowd = new THREE.InstancedMesh(unitGeo, unitMat, MAX_UNITS)
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  crowd.count = 0
  crowd.frustumCulled = false
  const colorArr = new Float32Array(MAX_UNITS * 3)
  for (let i = 0; i < MAX_UNITS; i++) {
    colorArr[i * 3] = 1
    colorArr[i * 3 + 1] = 0.88
    colorArr[i * 3 + 2] = 0.3
  }
  crowd.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3)
  scene.add(crowd)
  const dummy = new THREE.Object3D()
  const unitColor = new THREE.Color()

  // Count sprite above crowd
  const countCanvas = document.createElement('canvas')
  countCanvas.width = 512
  countCanvas.height = 256
  const countTex = new THREE.CanvasTexture(countCanvas)
  countTex.colorSpace = THREE.SRGBColorSpace
  const countMat = new THREE.SpriteMaterial({
    map: countTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const countSprite = new THREE.Sprite(countMat)
  countSprite.scale.set(3.2, 1.6, 1)
  countSprite.renderOrder = 10
  scene.add(countSprite)

  // Peak ghost when count dips
  const peakCanvas = document.createElement('canvas')
  peakCanvas.width = 512
  peakCanvas.height = 256
  const peakTex = new THREE.CanvasTexture(peakCanvas)
  peakTex.colorSpace = THREE.SRGBColorSpace
  const peakMat = new THREE.SpriteMaterial({
    map: peakTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.45,
  })
  const peakSprite = new THREE.Sprite(peakMat)
  peakSprite.scale.set(2.4, 1.2, 1)
  peakSprite.renderOrder = 9
  peakSprite.visible = false
  scene.add(peakSprite)
  let lastPeakDrawn = -1

  // Lane flash under chosen path
  const laneFlashMat = new THREE.MeshBasicMaterial({
    color: 0x3dff9a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const laneFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(GATE_W * 0.95, 6.5),
    laneFlashMat,
  )
  laneFlash.rotation.x = -Math.PI / 2
  laneFlash.position.y = 0.05
  laneFlash.visible = false
  scene.add(laneFlash)

  // Gates pool — thick doors with billboard op labels
  const gateDoorGeo = new THREE.BoxGeometry(GATE_W, GATE_H, GATE_D * 1.6)
  const gates: GateDoorMeshes[] = []

  function makeGate(): GateDoorMeshes {
    const group = new THREE.Group()
    const leftMat = new THREE.MeshStandardMaterial({
      color: 0x1a3d2e,
      emissive: 0x3dff9a,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.25,
      transparent: true,
      opacity: 1,
    })
    const rightMat = leftMat.clone()
    const left = new THREE.Mesh(gateDoorGeo, leftMat)
    const right = new THREE.Mesh(gateDoorGeo, rightMat)
    left.position.x = -(GATE_W / 2 + GATE_GAP_W / 2)
    right.position.x = GATE_W / 2 + GATE_GAP_W / 2
    left.position.y = GATE_H / 2
    right.position.y = GATE_H / 2

    const leftLabel = makeLabelTexture('x2', '#3dff9a')
    const rightLabel = makeLabelTexture('+5', '#ff3d6e')
    const leftLabelMat = new THREE.SpriteMaterial({
      map: leftLabel.tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true,
    })
    const rightLabelMat = new THREE.SpriteMaterial({
      map: rightLabel.tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true,
    })
    const leftLabelMesh = new THREE.Sprite(leftLabelMat)
    const rightLabelMesh = new THREE.Sprite(rightLabelMat)
    leftLabelMesh.scale.set(GATE_W * 1.05, GATE_H * 0.85, 1)
    rightLabelMesh.scale.set(GATE_W * 1.05, GATE_H * 0.85, 1)
    // Sit clearly in front of the door slab (camera is on +Z side)
    leftLabelMesh.position.set(left.position.x, GATE_H / 2 + 0.05, GATE_D * 1.35)
    rightLabelMesh.position.set(right.position.x, GATE_H / 2 + 0.05, GATE_D * 1.35)
    leftLabelMesh.renderOrder = 5
    rightLabelMesh.renderOrder = 5

    // Pillars
    const pillarGeo = new THREE.BoxGeometry(0.35, GATE_H + 0.6, 0.35)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x2a3340,
      metalness: 0.45,
      roughness: 0.45,
      emissive: 0x111820,
      emissiveIntensity: 0.3,
    })
    for (const x of [
      left.position.x - GATE_W / 2 - 0.05,
      left.position.x + GATE_W / 2 + 0.05,
      right.position.x - GATE_W / 2 - 0.05,
      right.position.x + GATE_W / 2 + 0.05,
    ]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat)
      p.position.set(x, (GATE_H + 0.6) / 2, 0)
      group.add(p)
    }

    // Arch beam
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_WIDTH * 0.98, 0.35, 0.45),
      pillarMat,
    )
    beam.position.set(0, GATE_H + 0.35, 0)
    group.add(beam)

    // Base curb
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_WIDTH * 0.98, 0.18, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.8 }),
    )
    curb.position.set(0, 0.09, 0)
    group.add(curb)

    group.add(left, right, leftLabelMesh, rightLabelMesh)
    group.visible = false
    scene.add(group)

    return {
      group,
      left,
      right,
      leftLabel: leftLabelMesh,
      rightLabel: rightLabelMesh,
      leftMat,
      rightMat,
      leftCanvas: leftLabel.canvas,
      rightCanvas: rightLabel.canvas,
      leftTex: leftLabel.tex,
      rightTex: rightLabel.tex,
      leftLabelMat,
      rightLabelMat,
      gateId: -1,
      lastCount: -1,
    }
  }

  for (let i = 0; i < 12; i++) gates.push(makeGate())

  // Hazards pool
  const hazards: HazardMeshes[] = []
  const sawGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24)
  const sawMat = new THREE.MeshStandardMaterial({
    color: 0xc8ced8,
    metalness: 0.85,
    roughness: 0.25,
    emissive: 0xff3d6e,
    emissiveIntensity: 0.25,
  })
  const spikeGeo = new THREE.ConeGeometry(0.55, 1.5, 5)
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xff8a5c,
    emissive: 0xff3d6e,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.3,
  })

  function makeHazard(kind: 'saw' | 'spike'): HazardMeshes {
    const group = new THREE.Group()
    const spin = new THREE.Group()
    if (kind === 'saw') {
      const disc = new THREE.Mesh(sawGeo, sawMat)
      disc.rotation.x = Math.PI / 2
      spin.add(disc)
      // teeth hints
      for (let i = 0; i < 8; i++) {
        const tooth = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.28, 3),
          sawMat,
        )
        const a = (i / 8) * Math.PI * 2
        tooth.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0)
        tooth.rotation.z = a + Math.PI / 2
        spin.add(tooth)
      }
      spin.position.y = 0.95
    } else {
      const spike = new THREE.Mesh(spikeGeo, spikeMat)
      spike.position.y = 0.75
      spin.add(spike)
    }
    group.add(spin)
    group.visible = false
    scene.add(group)
    return { group, kind, hazardId: -1, spin }
  }

  for (let i = 0; i < 10; i++) {
    hazards.push(makeHazard(i % 2 === 0 ? 'saw' : 'spike'))
  }

  // Mid-run blockers (soft boss)
  const blockers: BlockerMeshes[] = []
  function makeBlocker(): BlockerMeshes {
    const group = new THREE.Group()
    const matL = new THREE.MeshStandardMaterial({
      color: 0x2a2230,
      emissive: 0xff8a5c,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.3,
    })
    const matR = matL.clone()
    const bw = ROAD_WIDTH * 0.42
    const left = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.4, 0.55), matL)
    const right = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.4, 0.55), matR)
    left.position.set(-bw / 2 - 0.05, 1.7, 0)
    right.position.set(bw / 2 + 0.05, 1.7, 0)
    const labelData = makeLabelTexture('40', '#ff8a5c', 512)
    const labelMat = new THREE.SpriteMaterial({
      map: labelData.tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
    const label = new THREE.Sprite(labelMat)
    label.scale.set(5.2, 2.6, 1)
    label.position.set(0, 2.0, 0.9)
    label.renderOrder = 5
    group.add(left, right, label)
    group.visible = false
    scene.add(group)
    return {
      group,
      left,
      right,
      matL,
      matR,
      label,
      labelMat,
      canvas: labelData.canvas,
      tex: labelData.tex,
      blockerId: -1,
      lastReq: -1,
      leftHome: left.position.clone(),
      rightHome: right.position.clone(),
    }
  }
  for (let i = 0; i < 4; i++) blockers.push(makeBlocker())

  // Drama banner (SPEED UP / BOSS AHEAD)
  const dramaCanvas = document.createElement('canvas')
  dramaCanvas.width = 1024
  dramaCanvas.height = 320
  const dramaTex = new THREE.CanvasTexture(dramaCanvas)
  dramaTex.colorSpace = THREE.SRGBColorSpace
  const dramaMat = new THREE.SpriteMaterial({
    map: dramaTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const dramaBanner = new THREE.Sprite(dramaMat)
  dramaBanner.scale.set(7, 2.2, 1)
  dramaBanner.visible = false
  dramaBanner.renderOrder = 18
  scene.add(dramaBanner)
  let lastDramaKey = ''

  // Boss gate — two halves so a win can smash them apart
  const bossGroup = new THREE.Group()
  const bossMat = new THREE.MeshStandardMaterial({
    color: 0x222a36,
    emissive: 0xffe14a,
    emissiveIntensity: 0.3,
    roughness: 0.55,
    metalness: 0.35,
  })
  const bossMatR = bossMat.clone()
  const halfW = ROAD_WIDTH * 0.49
  const bossLeft = new THREE.Mesh(
    new THREE.BoxGeometry(halfW, 4.2, 0.7),
    bossMat,
  )
  const bossRight = new THREE.Mesh(
    new THREE.BoxGeometry(halfW, 4.2, 0.7),
    bossMatR,
  )
  bossLeft.position.set(-halfW / 2 - 0.04, 2.1, 0)
  bossRight.position.set(halfW / 2 + 0.04, 2.1, 0)
  bossGroup.add(bossLeft, bossRight)
  const bossLabel = makeLabelTexture('180', '#ffe14a', 512)
  const bossLabelMat = new THREE.SpriteMaterial({
    map: bossLabel.tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  })
  const bossLabelMesh = new THREE.Sprite(bossLabelMat)
  bossLabelMesh.scale.set(6.8, 3.4, 1)
  bossLabelMesh.position.set(0, 2.2, 1.1)
  bossLabelMesh.renderOrder = 5
  bossGroup.add(bossLabelMesh)
  // Impact ring
  const impactRingMat = new THREE.MeshBasicMaterial({
    color: 0xffe14a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1.1, 32),
    impactRingMat,
  )
  impactRing.rotation.x = -Math.PI / 2
  impactRing.position.y = 0.08
  impactRing.visible = false
  bossGroup.add(impactRing)
  scene.add(bossGroup)
  const bossLeftHome = bossLeft.position.clone()
  const bossRightHome = bossRight.position.clone()

  // Particles as points
  const PARTICLE_CAP = 200
  const particlePositions = new Float32Array(PARTICLE_CAP * 3)
  const particleColors = new Float32Array(PARTICLE_CAP * 3)
  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
  const particleMat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const particles = new THREE.Points(particleGeo, particleMat)
  particles.frustumCulled = false
  scene.add(particles)
  const tmpColor = new THREE.Color()

  // Popup sprites pool
  const popups: PopupSprite[] = []
  for (let i = 0; i < 16; i++) {
    const canvasEl = document.createElement('canvas')
    canvasEl.width = 512
    canvasEl.height = 256
    const tex = new THREE.CanvasTexture(canvasEl)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.visible = false
    sprite.renderOrder = 12
    scene.add(sprite)
    popups.push({ sprite, mat, tex, canvas: canvasEl, id: -1 })
  }

  // End banner
  const bannerCanvas = document.createElement('canvas')
  bannerCanvas.width = 1024
  bannerCanvas.height = 512
  const bannerTex = new THREE.CanvasTexture(bannerCanvas)
  bannerTex.colorSpace = THREE.SRGBColorSpace
  const bannerMat = new THREE.SpriteMaterial({
    map: bannerTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const banner = new THREE.Sprite(bannerMat)
  banner.scale.set(8, 4, 1)
  banner.visible = false
  banner.renderOrder = 20
  scene.add(banner)

  // Flash overlay (camera-facing plane parented conceptually each frame)
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffe14a,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), flashMat)
  flash.renderOrder = 30
  flash.frustumCulled = false
  scene.add(flash)

  // Hint sprite for ready state
  const hintCanvas = document.createElement('canvas')
  hintCanvas.width = 1024
  hintCanvas.height = 256
  const hintTex = new THREE.CanvasTexture(hintCanvas)
  hintTex.colorSpace = THREE.SRGBColorSpace
  paintPopup(hintCanvas, 'DRAG TO STEER', '#ffe14a')
  hintTex.needsUpdate = true
  const hintMat = new THREE.SpriteMaterial({
    map: hintTex,
    transparent: true,
    depthTest: false,
  })
  const hint = new THREE.Sprite(hintMat)
  hint.scale.set(5, 1.25, 1)
  scene.add(hint)

  let lastBossReq = -1
  let lastBossBeat = false
  let lastBannerKey = ''
  let lastCountDrawn = -1

  function updateGateVisual(mesh: GateDoorMeshes, gate: GatePair, count: number) {
    const colors = previewGateColors(gate, count)
    const leftCol = opColor(gate.left, colors.leftGood)
    const rightCol = opColor(gate.right, colors.rightGood)

    mesh.leftMat.color.set(colors.leftGood ? 0x1a3d2e : 0x3d1a24)
    mesh.rightMat.color.set(colors.rightGood ? 0x1a3d2e : 0x3d1a24)
    mesh.leftMat.emissive.set(leftCol)
    mesh.rightMat.emissive.set(rightCol)
    mesh.leftMat.emissiveIntensity = 0.4
    mesh.rightMat.emissiveIntensity = 0.4

    paintLabel(mesh.leftCanvas, formatOp(gate.left), leftCol)
    paintLabel(mesh.rightCanvas, formatOp(gate.right), rightCol)
    mesh.leftTex.needsUpdate = true
    mesh.rightTex.needsUpdate = true
  }

  function sync(world: GateRushWorld, time: number) {
    const crowdZ = toWorldZ(world.distance)
    const crowdX = toWorldX(world.x)

    // Road follows player
    road.position.z = crowdZ - 50
    shoulder.position.z = crowdZ - 50
    leftRail.position.z = crowdZ - 50
    rightRail.position.z = crowdZ - 50
    ls.position.z = crowdZ - 50
    rs.position.z = crowdZ - 50

    const dashScroll = ((-crowdZ) % 2.8 + 2.8) % 2.8
    for (let i = 0; i < dashes.length; i++) {
      const d = dashes[i]
      // Place dashes ahead (−Z) and behind
      d.position.set(0, 0.04, crowdZ + 6 - i * 2.8 + dashScroll)
    }

    // Side scenery scrolls with player
    for (let i = 0; i < sideBlocks.length; i++) {
      const b = sideBlocks[i]
      const slot = (((-crowdZ) * 0.15 + i * 3.4) % 90) - 10
      b.position.z = crowdZ - slot
    }

    neon.position.set(crowdX, 2.8, crowdZ - 2)
    greenGlow.position.set(crowdX, 2.0, crowdZ - 10)

    // Crowd instances — denser army packing with upright capsules
    const units = world.units
    const n = world.count <= 0 && world.phase !== 'ready' ? 0 : units.length
    crowd.count = n
    const pack = 0.011
    const bodyH = UNIT_RADIUS * 1.9
    for (let i = 0; i < n; i++) {
      const u = units[i]
      const bob = Math.sin(u.phase) * 0.06
      const march = Math.sin(u.phase * 1.7) * 0.04
      dummy.position.set(
        crowdX + u.ox * pack,
        bodyH * 0.5 + bob,
        crowdZ - u.oy * pack * 0.75 + march,
      )
      const s = 0.75 + Math.min(0.7, Math.sqrt(world.count) * 0.045)
      dummy.scale.set(s * 0.85, s, s * 0.85)
      dummy.rotation.set(0, u.phase * 0.15, Math.sin(u.phase) * 0.08)
      dummy.updateMatrix()
      crowd.setMatrixAt(i, dummy.matrix)
      // Warm gold → hot amber as army grows
      const heat = Math.min(0.2, world.count / 800)
      unitColor.setHSL((38 + (u.hue % 40)) / 360, 0.9, 0.52 + heat)
      crowd.setColorAt(i, unitColor)
    }
    crowd.instanceMatrix.needsUpdate = true
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true

    // Count badge with FOV-punch scale
    const shown = Math.round(world.displayCount)
    if (shown !== lastCountDrawn) {
      paintCount(countCanvas, shown)
      countTex.needsUpdate = true
      lastCountDrawn = shown
    }
    const countScale =
      2.6 +
      Math.min(1.6, Math.log10(Math.max(1, shown)) * 0.6) +
      world.fovPunch * 0.9
    countSprite.scale.set(countScale, countScale * 0.5, 1)
    countSprite.position.set(
      crowdX,
      2.15 + Math.min(1.4, Math.sqrt(world.count) * 0.09),
      crowdZ,
    )
    countSprite.visible = world.count > 0 || world.phase === 'ready'

    // Peak ghost when dipping
    const showPeak =
      world.peakCount > world.count && world.phase === 'running'
    if (showPeak) {
      if (world.peakCount !== lastPeakDrawn) {
        paintCount(peakCanvas, world.peakCount, '#ff8a5c')
        peakTex.needsUpdate = true
        lastPeakDrawn = world.peakCount
      }
      peakSprite.visible = true
      peakMat.opacity = 0.35 + Math.sin(time * 5) * 0.08
      peakSprite.position.set(
        crowdX + 1.1,
        countSprite.position.y + 0.55,
        crowdZ + 0.2,
      )
      peakSprite.scale.set(countScale * 0.72, countScale * 0.36, 1)
    } else {
      peakSprite.visible = false
    }

    // Lane floor flash
    if (world.laneFlash && world.laneFlash.life > 0) {
      const lf = world.laneFlash
      const laneX =
        lf.side === 'left'
          ? -(GATE_W / 2 + GATE_GAP_W / 2)
          : GATE_W / 2 + GATE_GAP_W / 2
      laneFlash.visible = true
      laneFlash.position.set(laneX, 0.05, crowdZ - 1.2)
      laneFlashMat.color.set(lf.good ? 0x3dff9a : 0xff3d6e)
      laneFlashMat.opacity = Math.min(0.7, lf.life * 1.6)
    } else {
      laneFlash.visible = false
    }

    // Gates — live + committed (open/split + rejected ghost)
    let gi = 0
    for (const gate of world.gates) {
      if (gate.hit && gate.ghostLife <= 0 && gate.openProgress >= 1) continue
      const z = toWorldZ(gate.z)
      if (z > crowdZ + 6 || z < crowdZ - 55) continue

      const mesh = gates[gi++]
      if (!mesh) break
      if (mesh.gateId !== gate.id || (!gate.hit && mesh.lastCount !== world.count)) {
        mesh.gateId = gate.id
        mesh.lastCount = world.count
        updateGateVisual(mesh, gate, world.count)
      }
      mesh.group.visible = true
      mesh.group.position.set(0, 0, z)
      mesh.group.scale.set(1, 1, 1)

      const leftHomeX = -(GATE_W / 2 + GATE_GAP_W / 2)
      const rightHomeX = GATE_W / 2 + GATE_GAP_W / 2
      mesh.left.position.x = leftHomeX
      mesh.right.position.x = rightHomeX
      mesh.left.rotation.y = 0
      mesh.right.rotation.y = 0
      mesh.leftMat.opacity = 1
      mesh.rightMat.opacity = 1
      mesh.leftLabelMat.opacity = 1
      mesh.rightLabelMat.opacity = 1
      mesh.leftLabel.position.x = leftHomeX
      mesh.rightLabel.position.x = rightHomeX

      if (gate.hit) {
        const open = gate.openProgress
        const ghostT = Math.max(0, gate.ghostLife / GATE_GHOST_DUR)
        const chosen = gate.hitSide
        const swing = open * 1.15
        const slide = open * 1.8

        if (chosen === 'left') {
          mesh.left.position.x = leftHomeX - slide
          mesh.left.rotation.y = swing
          mesh.leftLabel.position.x = mesh.left.position.x
          mesh.rightMat.opacity = 0.22 + ghostT * 0.55
          mesh.rightLabelMat.opacity = mesh.rightMat.opacity
        } else if (chosen === 'right') {
          mesh.right.position.x = rightHomeX + slide
          mesh.right.rotation.y = -swing
          mesh.rightLabel.position.x = mesh.right.position.x
          mesh.leftMat.opacity = 0.22 + ghostT * 0.55
          mesh.leftLabelMat.opacity = mesh.leftMat.opacity
        }
      } else {
        const pulse = 1 + Math.sin(time * 5 + gate.id) * 0.015
        mesh.group.scale.set(pulse, pulse, 1)
      }
    }
    for (; gi < gates.length; gi++) {
      gates[gi].group.visible = false
      gates[gi].gateId = -1
      gates[gi].left.position.x = -(GATE_W / 2 + GATE_GAP_W / 2)
      gates[gi].right.position.x = GATE_W / 2 + GATE_GAP_W / 2
      gates[gi].left.rotation.y = 0
      gates[gi].right.rotation.y = 0
      gates[gi].leftMat.opacity = 1
      gates[gi].rightMat.opacity = 1
    }

    // Hazards
    let hi = 0
    for (const h of world.hazards) {
      if (h.hit) continue
      const z = toWorldZ(h.z)
      if (z > crowdZ + 3 || z < crowdZ - 70) continue
      // find matching kind slot
      let mesh: HazardMeshes | null = null
      for (let k = hi; k < hazards.length; k++) {
        if (hazards[k].kind === h.kind) {
          mesh = hazards[k]
          // swap into place
          const tmp = hazards[hi]
          hazards[hi] = mesh
          hazards[k] = tmp
          break
        }
      }
      if (!mesh) continue
      hi++
      mesh.hazardId = h.id
      mesh.group.visible = true
      const scale = (h.width / 80) * 1.15
      mesh.group.position.set(toWorldX(h.x), 0, z)
      mesh.group.scale.setScalar(scale)
      if (h.kind === 'saw') mesh.spin.rotation.z = time * 8
      else mesh.spin.position.y = Math.sin(time * 10) * 0.08
    }
    for (; hi < hazards.length; hi++) {
      hazards[hi].group.visible = false
      hazards[hi].hazardId = -1
    }

    // Blockers
    let bi = 0
    for (const b of world.blockers) {
      if (b.smashed && b.breakProgress >= 1) continue
      const z = toWorldZ(b.z)
      if (z > crowdZ + 5 || z < crowdZ - 55) continue
      const mesh = blockers[bi++]
      if (!mesh) break
      mesh.group.visible = true
      mesh.group.position.set(0, 0, z)
      const canClear = world.count >= b.req || b.smashed
      mesh.matL.emissive.set(canClear ? 0x3dff9a : 0xff8a5c)
      mesh.matR.emissive.copy(mesh.matL.emissive)
      mesh.matL.emissiveIntensity =
        0.3 + Math.sin(time * 7) * 0.1 + (b.hit && !b.smashed ? 0.35 : 0)
      mesh.matR.emissiveIntensity = mesh.matL.emissiveIntensity
      if (mesh.blockerId !== b.id || mesh.lastReq !== b.req) {
        paintLabel(mesh.canvas, String(b.req), canClear ? '#3dff9a' : '#ff8a5c')
        const ctx = mesh.canvas.getContext('2d')
        if (ctx) {
          ctx.font = '600 32px Syne, sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.6)'
          ctx.textAlign = 'center'
          ctx.fillText('NEED', mesh.canvas.width / 2, mesh.canvas.height * 0.78)
        }
        mesh.tex.needsUpdate = true
        mesh.blockerId = b.id
        mesh.lastReq = b.req
      }
      if (b.smashed) {
        const ease = 1 - Math.pow(1 - b.breakProgress, 2)
        mesh.left.position.set(
          mesh.leftHome.x - ease * 4,
          mesh.leftHome.y + ease * 0.8,
          mesh.leftHome.z,
        )
        mesh.right.position.set(
          mesh.rightHome.x + ease * 4,
          mesh.rightHome.y + ease * 0.9,
          mesh.rightHome.z,
        )
        mesh.left.rotation.z = ease * 0.5
        mesh.right.rotation.z = -ease * 0.5
        mesh.labelMat.opacity = Math.max(0, 1 - ease * 2)
      } else {
        const shudder = b.hit ? Math.sin(time * 40) * 0.06 : 0
        mesh.left.position.set(mesh.leftHome.x + shudder, mesh.leftHome.y, mesh.leftHome.z)
        mesh.right.position.set(mesh.rightHome.x - shudder, mesh.rightHome.y, mesh.rightHome.z)
        mesh.left.rotation.set(0, 0, shudder)
        mesh.right.rotation.set(0, 0, -shudder)
        mesh.labelMat.opacity = 1
      }
    }
    for (; bi < blockers.length; bi++) {
      blockers[bi].group.visible = false
      blockers[bi].blockerId = -1
    }

    // Boss
    const bossZ = toWorldZ(world.bossAt)
    bossGroup.position.set(0, 0, bossZ)
    bossGroup.visible = bossZ < crowdZ + 8 && bossZ > crowdZ - 90
    const canBeat = world.count >= world.bossReq
    const slam = world.slamProgress
    const brk = world.doorBreak
    bossMat.emissive.set(canBeat || world.phase === 'won' ? 0x3dff9a : 0xff3d6e)
    bossMatR.emissive.copy(bossMat.emissive)
    bossMat.emissiveIntensity =
      0.25 + Math.sin(time * 6) * 0.12 + slam * 0.55 + brk * 0.4
    bossMatR.emissiveIntensity = bossMat.emissiveIntensity

    // Door smash / lose hold
    if (world.phase === 'won' || brk > 0) {
      const ease = 1 - Math.pow(1 - Math.min(1, brk), 2)
      bossLeft.position.set(
        bossLeftHome.x - ease * 5.5,
        bossLeftHome.y + ease * 1.2,
        bossLeftHome.z + ease * 1.5,
      )
      bossRight.position.set(
        bossRightHome.x + ease * 5.5,
        bossRightHome.y + ease * 1.4,
        bossRightHome.z + ease * 1.2,
      )
      bossLeft.rotation.z = ease * 0.55
      bossLeft.rotation.y = -ease * 0.35
      bossRight.rotation.z = -ease * 0.6
      bossRight.rotation.y = ease * 0.4
      bossLabelMesh.visible = brk < 0.35
      bossLabelMesh.material.opacity = Math.max(0, 1 - brk * 3)
      impactRing.visible = world.outroT < 0.9
      impactRingMat.opacity = Math.max(0, 0.85 - world.outroT * 1.2)
      const ringScale = 1.2 + world.outroT * 14
      impactRing.scale.set(ringScale, ringScale, 1)
      impactRingMat.color.set(0x3dff9a)
    } else if (world.phase === 'lost') {
      bossLeft.position.copy(bossLeftHome)
      bossRight.position.copy(bossRightHome)
      bossLeft.rotation.set(0, 0, Math.sin(world.outroT * 40) * 0.04)
      bossRight.rotation.set(0, 0, -Math.sin(world.outroT * 40) * 0.04)
      bossLabelMesh.visible = true
      bossLabelMesh.material.opacity = 1
      impactRing.visible = world.outroT < 0.6
      impactRingMat.color.set(0xff3d6e)
      impactRingMat.opacity = Math.max(0, 0.7 - world.outroT * 1.4)
      const ringScale = 1 + world.outroT * 8
      impactRing.scale.set(ringScale, ringScale, 1)
    } else {
      // Idle / charging — subtle inward lean on slam
      const lean = slam * 0.08
      bossLeft.position.set(bossLeftHome.x + lean, bossLeftHome.y, bossLeftHome.z)
      bossRight.position.set(bossRightHome.x - lean, bossRightHome.y, bossRightHome.z)
      bossLeft.rotation.set(0, 0, 0)
      bossRight.rotation.set(0, 0, 0)
      bossLabelMesh.visible = true
      bossLabelMesh.material.opacity = 1
      impactRing.visible = slam > 0.7
      if (slam > 0.7) {
        impactRingMat.opacity = (slam - 0.7) * 2
        impactRing.scale.setScalar(0.8 + slam * 1.5)
        impactRingMat.color.set(canBeat ? 0x3dff9a : 0xffe14a)
      }
    }

    if (world.bossReq !== lastBossReq || canBeat !== lastBossBeat) {
      paintLabel(bossLabel.canvas, String(world.bossReq), canBeat ? '#3dff9a' : '#ffe14a')
      const ctx = bossLabel.canvas.getContext('2d')
      if (ctx) {
        ctx.font = '600 36px Syne, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.textAlign = 'center'
        ctx.fillText('BOSS GATE', bossLabel.canvas.width / 2, bossLabel.canvas.height * 0.78)
      }
      bossLabel.tex.needsUpdate = true
      lastBossReq = world.bossReq
      lastBossBeat = canBeat
    }

    // Particles — map sim xy to world around crowd
    const pCount = Math.min(PARTICLE_CAP, world.particles.length)
    for (let i = 0; i < pCount; i++) {
      const p = world.particles[i]
      const px = toWorldX(p.x)
      const py = 0.4 + ((720 - p.y) / VIEW_WIDTH) * 4
      const pz = crowdZ - (p.y - 720) * 0.002
      particlePositions[i * 3] = px
      particlePositions[i * 3 + 1] = Math.max(0.1, py)
      particlePositions[i * 3 + 2] = pz
      tmpColor.set(p.color)
      particleColors[i * 3] = tmpColor.r
      particleColors[i * 3 + 1] = tmpColor.g
      particleColors[i * 3 + 2] = tmpColor.b
    }
    particleGeo.setDrawRange(0, pCount)
    particleGeo.attributes.position.needsUpdate = true
    particleGeo.attributes.color.needsUpdate = true
    particleMat.opacity = world.phase === 'running' || world.phase === 'boss' || world.flash > 0 ? 0.95 : 0.5

    // Popups
    let pi = 0
    for (const p of world.popups) {
      const slot = popups[pi++]
      if (!slot) break
      if (slot.id !== p.id) {
        paintPopup(slot.canvas, p.text, p.color)
        slot.tex.needsUpdate = true
        slot.id = p.id
      }
      const t = p.life / p.maxLife
      slot.sprite.visible = true
      slot.mat.opacity = Math.min(1, t * 1.4)
      const scale = 2.2 * p.scale * (0.85 + (1 - t) * 0.4)
      slot.sprite.scale.set(scale, scale * 0.5, 1)
      slot.sprite.position.set(
        toWorldX(p.x),
        1.5 + ((720 - p.y) / VIEW_WIDTH) * 5,
        crowdZ - 0.5,
      )
    }
    for (; pi < popups.length; pi++) {
      popups[pi].sprite.visible = false
      popups[pi].id = -1
    }

    // Hint / end banner / mid-run drama
    if (world.banner && world.banner.life > 0) {
      hint.visible = false
      const key = `${world.banner.text}:${world.banner.color}`
      if (key !== lastDramaKey) {
        paintDramaBanner(dramaCanvas, world.banner.text, world.banner.color)
        dramaTex.needsUpdate = true
        lastDramaKey = key
      }
      dramaBanner.visible = true
      const t = world.banner.life / world.banner.maxLife
      const punch = 0.85 + (1 - t) * 0.25 + Math.sin(time * 8) * 0.04
      dramaBanner.position.set(crowdX, 3.6, crowdZ + 1.2)
      dramaBanner.scale.set(7.2 * punch, 2.25 * punch, 1)
      dramaMat.opacity = Math.min(1, t * 2.2)
      banner.visible = false
    } else if (world.phase === 'ready') {
      dramaBanner.visible = false
      lastDramaKey = ''
      hint.visible = true
      hint.position.set(crowdX, 1.35, crowdZ + 1.4)
      const pulse = 0.92 + Math.sin(time * 4) * 0.05
      hint.scale.set(2.8 * pulse, 0.7 * pulse, 1)
      banner.visible = false
    } else if (
      (world.phase === 'won' || world.phase === 'lost') &&
      world.outroT >= 0.55
    ) {
      dramaBanner.visible = false
      hint.visible = false
      const result =
        world.phase === 'won'
          ? world.winKind === 'barely'
            ? 'BARELY'
            : world.winKind === 'overkill'
              ? 'OVERKILL'
              : 'CLEARED'
          : 'WIPEOUT'
      const key = `${world.phase}:${result}:${world.count}:${world.peakCount}`
      if (key !== lastBannerKey) {
        paintBanner(
          bannerCanvas,
          result,
          world.phase === 'won'
            ? `${world.count} smash the gate`
            : `peak ${world.peakCount}`,
          world.phase === 'won' ? '#3dff9a' : '#ff3d6e',
        )
        bannerTex.needsUpdate = true
        lastBannerKey = key
      }
      banner.visible = true
      const pop = Math.min(1, (world.outroT - 0.55) / 0.25)
      const punch = 0.7 + pop * 0.35 + Math.sin(time * 5) * 0.03
      banner.position.set(crowdX, 3.4, crowdZ + 1.4)
      banner.scale.set(7.5 * punch, 3.8 * punch, 1)
      banner.material.opacity = Math.min(1, pop * 1.4)
    } else {
      dramaBanner.visible = false
      hint.visible = false
      banner.visible = false
      if (world.phase !== 'won' && world.phase !== 'lost') lastBannerKey = ''
    }

    // Camera chase — roomier follow distance
    let lookAhead = 18
    let camHeight = 3.55
    let camBack = 9.6
    if (world.phase === 'boss') {
      lookAhead = 6 + world.slamProgress * 2
      camHeight = 3.0
      camBack = 7.2 - world.slamProgress * 1.4
    } else if (world.phase === 'won') {
      // Pull wide after the smash, then settle
      const t = Math.min(1, world.outroT / 1.2)
      lookAhead = 16 + t * 6
      camHeight = 3.4 + t * 1.6
      camBack = 9.2 + t * 4.5
    } else if (world.phase === 'lost') {
      lookAhead = 10
      camHeight = 3.2
      camBack = 8.5
    }
    const desired = new THREE.Vector3(
      crowdX * 0.18,
      camHeight,
      crowdZ + camBack,
    )
    const shakeAmp = world.shake * 0.03
    if (shakeAmp > 0) {
      desired.x += (Math.random() - 0.5) * shakeAmp * 2
      desired.y += (Math.random() - 0.5) * shakeAmp
    }
    camera.position.lerp(desired, world.phase === 'won' ? 0.12 : 0.2)
    camera.lookAt(crowdX * 0.3, 1.05, crowdZ - lookAhead)

    // FOV punch on big multis / impact
    const baseFov = 58
    const targetFov = baseFov + world.fovPunch * 10 + (world.timeScale < 1 ? 3 : 0)
    camera.fov += (targetFov - camera.fov) * 0.22
    camera.updateProjectionMatrix()

    // Flash plane in front of camera — brighter chromatic punch on big hits
    flashMat.opacity = Math.min(0.55, world.flash * 0.85 + world.fovPunch * 0.12)
    if (world.phase === 'won') flashMat.color.set(0x3dff9a)
    else if (world.phase === 'lost') flashMat.color.set(0xff3d6e)
    else flashMat.color.set(0xffe14a)
    flash.visible = flashMat.opacity > 0.01
    if (flash.visible) {
      flash.position.copy(camera.position)
      flash.quaternion.copy(camera.quaternion)
      flash.translateZ(-2)
    }

    // Fog tighten when racing
    const fog = scene.fog as THREE.Fog
    fog.near = 14
    fog.far = world.phase === 'running' ? 78 : 90
  }

  function render() {
    renderer.render(scene, camera)
  }

  function setSize(cssW: number, cssH: number, dpr: number) {
    const w = Math.max(1, Math.floor(cssW))
    const h = Math.max(1, Math.floor(cssH))
    renderer.setPixelRatio(Math.min(2, dpr))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function dispose() {
    renderer.dispose()
    unitGeo.dispose()
    unitMat.dispose()
    roadGeo.dispose()
    roadMat.dispose()
    dashGeo.dispose()
    dashMat.dispose()
    gateDoorGeo.dispose()
    sawGeo.dispose()
    sawMat.dispose()
    spikeGeo.dispose()
    spikeMat.dispose()
    particleGeo.dispose()
    particleMat.dispose()
    countTex.dispose()
    countMat.dispose()
    bannerTex.dispose()
    bannerMat.dispose()
    hintTex.dispose()
    hintMat.dispose()
    flashMat.dispose()
    for (const g of gates) {
      g.leftMat.dispose()
      g.rightMat.dispose()
      g.leftTex.dispose()
      g.rightTex.dispose()
    }
    for (const p of popups) {
      p.tex.dispose()
      p.mat.dispose()
    }
  }

  return { sync, render, setSize, dispose }
}
