import * as THREE from 'three'
import { createDriftCamera, type DriftCamera } from './camera'
import { ghostWorldPos, playerWorldPos, type DriftWorld } from './sim'
import {
  BASE_SPEED,
  FACE_LATERAL,
  FACE_OUTWARD,
  RING_DEPTH,
  TUNNEL_HALF,
  type FaceIndex,
  type TileKind,
} from './types'

const BG = 0x02030a
const FOG = 0x09052a

const TILE_COLORS: Record<TileKind, number> = {
  solid: 0x4d4fff,
  gap: 0x000000,
  crumble: 0xff6b18,
  ice: 0x18c9ff,
  boost: 0x5dff48,
}

const TILE_EMISSIVE: Record<TileKind, number> = {
  solid: 0x182dff,
  gap: 0x000000,
  crumble: 0xff2500,
  ice: 0x00baff,
  boost: 0x18ff70,
}

export type DriftScene = {
  renderer: THREE.WebGLRenderer
  sync: (world: DriftWorld) => void
  render: () => void
  setSize: (cssWidth: number, cssHeight: number, dpr: number) => void
  updateCamera: (world: DriftWorld, dt: number) => void
  resetCamera: (world: DriftWorld) => void
  dispose: () => void
}

type TileMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>

export function createDriftScene(canvas: HTMLCanvasElement): DriftScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(BG, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.FogExp2(FOG, 0.045)

  const camApi: DriftCamera = createDriftCamera()
  const { camera } = camApi

  scene.add(new THREE.AmbientLight(0xb5c8ff, 1.05))
  const key = new THREE.DirectionalLight(0xffffff, 2.1)
  key.position.set(2, 4, -1)
  scene.add(key)
  const rim = new THREE.PointLight(0x00ffd5, 2.8, 40)
  rim.position.set(0, 0, 0)
  scene.add(rim)
  const accent = new THREE.PointLight(0xff3bd4, 2.1, 50)
  accent.position.set(0, 0, 8)
  scene.add(accent)

  // Starfield
  {
    const count = 400
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80
      positions[i * 3 + 2] = Math.random() * 200 - 20
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xf2ecff, size: 0.085, sizeAttenuation: true }),
    )
    scene.add(stars)
  }

  const speedLineCount = 42
  const speedLinePositions = new Float32Array(speedLineCount * 6)
  const speedLineSeeds = Array.from({ length: speedLineCount }, () => ({
    x: (Math.random() - 0.5) * TUNNEL_HALF * 1.7,
    y: (Math.random() - 0.5) * TUNNEL_HALF * 1.7,
    z: Math.random() * 22,
    gate: Math.random(),
  }))
  const speedLineGeo = new THREE.BufferGeometry()
  speedLineGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(speedLinePositions, 3),
  )
  const speedLineMat = new THREE.LineBasicMaterial({
    color: 0x7dfff1,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const speedLines = new THREE.LineSegments(speedLineGeo, speedLineMat)
  speedLines.renderOrder = 4
  speedLines.visible = false
  // Positions follow the player every frame, so the geometry's initial
  // bounding sphere is not valid for frustum culling later in a run.
  speedLines.frustumCulled = false
  scene.add(speedLines)

  const tunnelGroup = new THREE.Group()
  scene.add(tunnelGroup)

  const tileGeo = new THREE.BoxGeometry(
    TUNNEL_HALF * 2 * 0.98,
    0.12,
    RING_DEPTH * 0.96,
  )
  const edgeGeo = new THREE.EdgesGeometry(tileGeo, 25)

  const matCache = new Map<string, THREE.MeshStandardMaterial>()
  function matFor(kind: TileKind, crumbled: boolean) {
    const key = `${kind}:${crumbled ? 1 : 0}`
    let m = matCache.get(key)
    if (m) return m
    m = new THREE.MeshStandardMaterial({
      color: crumbled ? 0x08080d : TILE_COLORS[kind],
      emissive: crumbled ? 0x000000 : TILE_EMISSIVE[kind],
      emissiveIntensity: kind === 'boost' ? 1.25 : kind === 'ice' ? 0.9 : 0.7,
      roughness: kind === 'ice' ? 0.08 : 0.38,
      metalness: kind === 'ice' ? 0.65 : 0.25,
      // Opaque depth is intentional: transparent tunnel segments sort
      // inconsistently at oblique wall/ceiling angles and look like holes.
      transparent: false,
      opacity: 1,
    })
    matCache.set(key, m)
    return m
  }

  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x88fff3,
    transparent: true,
    opacity: 0.72,
  })

  const pool: TileMesh[] = []
  const edgePool: THREE.LineSegments[] = []
  let activeTiles = 0
  let activeEdges = 0

  function acquireTile(): TileMesh {
    if (activeTiles < pool.length) return pool[activeTiles++]!
    const mesh = new THREE.Mesh(tileGeo, matFor('solid', false))
    tunnelGroup.add(mesh)
    pool.push(mesh)
    activeTiles++
    return mesh
  }

  function acquireEdge() {
    if (activeEdges < edgePool.length) return edgePool[activeEdges++]!
    const lines = new THREE.LineSegments(edgeGeo, edgeMat)
    lines.renderOrder = 1
    tunnelGroup.add(lines)
    edgePool.push(lines)
    activeEdges++
    return lines
  }

  function placeTile(
    mesh: THREE.Object3D,
    ringZ: number,
    face: FaceIndex,
    thicknessOffset = 0,
  ) {
    const out = FACE_OUTWARD[face]!
    const lat = FACE_LATERAL[face]!
    const half = TUNNEL_HALF

    // Tile sits just outside the inner surface
    const ox = out[0]! * (half + 0.06 + thicknessOffset)
    const oy = out[1]! * (half + 0.06 + thicknessOffset)
    mesh.position.set(ox, oy, ringZ)

    // Orient: tile's local +Y points inward (up from the standing surface)
    const up = new THREE.Vector3(-out[0]!, -out[1]!, -out[2]!)
    const forward = new THREE.Vector3(0, 0, 1)
    const right = new THREE.Vector3(lat[0]!, lat[1]!, lat[2]!)
    const m = new THREE.Matrix4()
    m.makeBasis(right, up, forward)
    mesh.quaternion.setFromRotationMatrix(m)
  }

  // A hand-drawn 2D mascot stays crisp and readable against the tunnel.
  const mascotFrontTexture = createMascotTexture(false)
  const mascotBackTexture = createMascotTexture(true)
  const mascotMaterial = new THREE.SpriteMaterial({
    map: mascotFrontTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  })
  const runner = new THREE.Sprite(mascotMaterial)
  runner.scale.set(0.9, 0.9, 1)
  scene.add(runner)

  const ghostMaterial = new THREE.SpriteMaterial({
    map: mascotBackTexture,
    color: 0x74eaff,
    opacity: 0.42,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const ghost = new THREE.Sprite(ghostMaterial)
  ghost.scale.set(0.76, 0.76, 1)
  ghost.renderOrder = 2
  ghost.visible = false
  scene.add(ghost)
  runner.renderOrder = 3

  function sync(world: DriftWorld) {
    activeTiles = 0
    activeEdges = 0

    const playerRing = Math.floor(world.z / RING_DEPTH)
    const start = Math.max(world.ringOffset, playerRing - 2)
    const end = playerRing + 28

    for (let absRing = start; absRing <= end; absRing++) {
      const local = absRing - world.ringOffset
      const ring = world.rings[local]
      if (!ring) continue
      const ringZ = absRing * RING_DEPTH + RING_DEPTH * 0.5

      for (let f = 0; f < 4; f++) {
        const tile = ring[f as FaceIndex]!
        if (tile.kind === 'gap') continue
        if (tile.kind === 'crumble' && tile.crumbled) continue

        const mesh = acquireTile()
        mesh.material = matFor(tile.kind, Boolean(tile.crumbled))
        mesh.visible = true
        placeTile(mesh, ringZ, f as FaceIndex)

        const edge = acquireEdge()
        edge.visible = true
        placeTile(edge, ringZ, f as FaceIndex)
      }
    }

    for (let i = activeTiles; i < pool.length; i++) pool[i]!.visible = false
    for (let i = activeEdges; i < edgePool.length; i++) edgePool[i]!.visible = false

    const p = playerWorldPos(world)
    const up = new THREE.Vector3(p.up[0], p.up[1], p.up[2])
    runner.position.set(p.x, p.y, p.z).addScaledVector(up, 0.38)

    const speedRatio = world.speed / BASE_SPEED[world.speedPreset]
    const speedIntensity = THREE.MathUtils.clamp((speedRatio - 1) / 2.2, 0, 1)
    speedLines.visible = speedIntensity > 0.015
    speedLineMat.opacity = 0.18 + speedIntensity * 0.62
    speedLineMat.color.setHSL(0.48 - speedIntensity * 0.08, 1, 0.68)
    const activeFraction = 0.18 + speedIntensity * 0.82
    for (let i = 0; i < speedLineCount; i++) {
      const seed = speedLineSeeds[i]!
      const offset = i * 6
      if (seed.gate > activeFraction) {
        speedLinePositions.fill(0, offset, offset + 6)
        continue
      }
      const phase =
        ((seed.z - world.elapsed * world.speed * 1.6) % 22 + 22) % 22
      const z = p.z + 1 + phase
      const length = 0.45 + speedIntensity * 3.8
      speedLinePositions[offset] = seed.x
      speedLinePositions[offset + 1] = seed.y
      speedLinePositions[offset + 2] = z
      speedLinePositions[offset + 3] = seed.x
      speedLinePositions[offset + 4] = seed.y
      speedLinePositions[offset + 5] = z + length
    }
    speedLineGeo.attributes.position.needsUpdate = true

    // Begin facing the viewer, then visually pivot to show the mascot's back.
    const turnProgress = world.phase === 'idle'
      ? 0
      : THREE.MathUtils.clamp((world.z - 1.2) / 1.8, 0, 1)
    const wantedTexture = turnProgress < 0.5 ? mascotFrontTexture : mascotBackTexture
    if (mascotMaterial.map !== wantedTexture) {
      mascotMaterial.map = wantedTexture
      mascotMaterial.needsUpdate = true
    }
    const turnWidth = Math.max(0.06, Math.abs(Math.cos(turnProgress * Math.PI)))

    // A slow two-step bob only while feet are on a surface. Jumping freezes
    // the pose completely instead of vibrating in mid-air.
    const groundedRun =
      world.phase === 'racing' && !world.falling && world.height <= 0.001
    const stride = groundedRun ? Math.sin(world.z * 1.75) : 0
    const runBob = groundedRun ? Math.abs(stride) * 0.025 : 0
    runner.position.addScaledVector(up, runBob)
    const squash = groundedRun ? 1 + Math.abs(stride) * 0.025 : 1
    runner.scale.set((0.9 * turnWidth) / squash, 0.9 * squash, 1)
    mascotMaterial.rotation = world.falling ? Math.sin(world.z * 3) * 0.3 : 0

    const ghostPose = ghostWorldPos(world)
    ghost.visible = ghostPose !== null
    if (ghostPose) {
      const ghostUp = new THREE.Vector3(...ghostPose.up)
      const ghostRight = new THREE.Vector3(...ghostPose.right)
      ghost.position
        .set(ghostPose.x, ghostPose.y, ghostPose.z)
        .addScaledVector(ghostUp, 0.38)
        .addScaledVector(ghostRight, 0.48)
      const pulse = 0.96 + Math.sin(world.elapsed * 7) * 0.04
      ghost.scale.set(0.76 * pulse, 0.76 * pulse, 1)
      ghostMaterial.opacity = 0.46 + Math.sin(world.elapsed * 5) * 0.07
    }

    rim.position.set(p.x, p.y, p.z + 2)
    accent.position.set(p.x, p.y, p.z + 10)

    // Lighting and tunnel edges build with speed, then fade with deceleration.
    rim.intensity = 2.8 + speedIntensity * 8
    rim.color.setHSL(0.48 - speedIntensity * 0.08, 1, 0.62)
    accent.intensity = 2.1 + speedIntensity * 4
    edgeMat.opacity = 0.72 + speedIntensity * 0.22
    edgeMat.color.setHSL(
      0.48 - speedIntensity * 0.1,
      0.75 + speedIntensity * 0.25,
      0.64 + speedIntensity * 0.22,
    )
  }

  return {
    renderer,
    sync,
    render() {
      renderer.render(scene, camera)
    },
    setSize(cssWidth, cssHeight, dpr) {
      renderer.setPixelRatio(Math.min(dpr, 2))
      renderer.setSize(cssWidth, cssHeight, false)
      camera.aspect = cssWidth / cssHeight
      camera.updateProjectionMatrix()
    },
    updateCamera(world, dt) {
      camApi.update(world, dt)
    },
    resetCamera(world) {
      camApi.reset(world)
    },
    dispose() {
      tileGeo.dispose()
      edgeGeo.dispose()
      for (const m of matCache.values()) m.dispose()
      edgeMat.dispose()
      speedLineGeo.dispose()
      speedLineMat.dispose()
      mascotFrontTexture.dispose()
      mascotBackTexture.dispose()
      mascotMaterial.dispose()
      ghostMaterial.dispose()
      renderer.dispose()
    },
  }
}

function createMascotTexture(showBack: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Soft neon shadow.
  ctx.shadowColor = '#00ffd5'
  ctx.shadowBlur = 18
  ctx.fillStyle = '#15102e'
  ctx.beginPath()
  ctx.ellipse(128, 221, 60, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Stubby legs.
  ctx.strokeStyle = '#291a62'
  ctx.lineWidth = 22
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(105, 184)
  ctx.lineTo(92, 218)
  ctx.moveTo(151, 184)
  ctx.lineTo(164, 218)
  ctx.stroke()

  // Peachy jelly-bean body with a bright outline.
  ctx.fillStyle = '#ffcf4a'
  ctx.strokeStyle = '#fff6b0'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(72, 145)
  ctx.bezierCurveTo(70, 75, 92, 45, 130, 45)
  ctx.bezierCurveTo(174, 45, 190, 85, 184, 151)
  ctx.bezierCurveTo(181, 190, 159, 204, 127, 204)
  ctx.bezierCurveTo(94, 204, 73, 184, 72, 145)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Tiny arms.
  ctx.strokeStyle = '#ff9d2e'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.moveTo(76, 135)
  ctx.lineTo(53, 157)
  ctx.moveTo(181, 135)
  ctx.lineTo(203, 153)
  ctx.stroke()

  if (showBack) {
    // Back tuft and center seam make the reverse readable.
    ctx.fillStyle = '#ff9d2e'
    ctx.beginPath()
    ctx.moveTo(111, 51)
    ctx.lineTo(128, 31)
    ctx.lineTo(145, 51)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#d97526'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(128, 66)
    ctx.lineTo(128, 139)
    ctx.stroke()

    ctx.strokeStyle = '#a9512b'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(128, 153)
    ctx.quadraticCurveTo(124, 170, 128, 184)
    ctx.stroke()
  } else {
    // Big expressive eyes.
    ctx.fillStyle = '#21133f'
    ctx.beginPath()
    ctx.ellipse(108, 113, 12, 16, 0, 0, Math.PI * 2)
    ctx.ellipse(151, 113, 12, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(104, 107, 4, 0, Math.PI * 2)
    ctx.arc(147, 107, 4, 0, Math.PI * 2)
    ctx.fill()

    // Happy mouth and blush.
    ctx.strokeStyle = '#6b2254'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(129, 139, 16, 0.15, Math.PI - 0.15)
    ctx.stroke()
    ctx.fillStyle = '#ff6f91'
    ctx.beginPath()
    ctx.ellipse(91, 139, 10, 5, 0, 0, Math.PI * 2)
    ctx.ellipse(167, 139, 10, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}
