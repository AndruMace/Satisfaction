import * as THREE from 'three'
import type { CascadeOverlay, DominoCourse } from './types'
import type { PhysicsPose } from './sim'
import { DOMINO } from './types'

const TABLE_COLOR = 0x3d5c4a
const FLOOR_COLOR = 0x4a6b58
const DOMINO_COLOR = 0xf7ecd4
const DOMINO_EDGE = 0xf0c14a
const VAULT_COLOR = 0xffd666
const CLEAR = 0xd8e8de
const FOG = 0xc5ddd0

export type DominoScene = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  roots: THREE.Group[]
  courseGroup: THREE.Group
  dispose: () => void
  setCourse: (course: DominoCourse) => void
  syncPoses: (poses: PhysicsPose[]) => void
  render: () => void
  setSize: (cssWidth: number, cssHeight: number, dpr: number) => void
  drawHud: (overlay: CascadeOverlay, phaseLabel?: string) => void
}

export function createDominoScene(canvas: HTMLCanvasElement): DominoScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  })
  renderer.setClearColor(CLEAR, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CLEAR)
  scene.fog = new THREE.Fog(FOG, 55, 140)

  const camera = new THREE.PerspectiveCamera(48, VIEW_ASPECT, 0.1, 160)
  camera.position.set(12, 10, 16)

  // Lights — airy daylight, warm key
  const ambient = new THREE.AmbientLight(0xf0fff6, 1.05)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xfff6e0, 2.1)
  key.position.set(6, 14, 4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 1
  key.shadow.camera.far = 50
  key.shadow.camera.left = -20
  key.shadow.camera.right = 20
  key.shadow.camera.top = 20
  key.shadow.camera.bottom = -20
  key.shadow.bias = -0.0002
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xa8e8d0, 0.85)
  fill.position.set(-8, 6, -4)
  scene.add(fill)
  const rim = new THREE.PointLight(0xffe08a, 1.2, 50)
  rim.position.set(0, 6, 0)
  scene.add(rim)
  const hemi = new THREE.HemisphereLight(0xeaf6f0, 0xb08a5a, 0.75)
  scene.add(hemi)

  const courseGroup = new THREE.Group()
  scene.add(courseGroup)

  // Face width × height × tip-thickness (thin edge tips along +Z)
  const dominoGeo = new THREE.BoxGeometry(DOMINO.face, DOMINO.h, DOMINO.thick)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: DOMINO_COLOR,
    roughness: 0.38,
    metalness: 0.08,
  })
  const edgeMat = new THREE.MeshStandardMaterial({
    color: DOMINO_EDGE,
    roughness: 0.28,
    metalness: 0.35,
    emissive: DOMINO_EDGE,
    emissiveIntensity: 0.08,
  })
  const pipMat = new THREE.MeshStandardMaterial({
    color: 0x2a352c,
    roughness: 0.75,
  })

  let roots: THREE.Group[] = []
  let hudCanvas: HTMLCanvasElement | null = null
  let hudTexture: THREE.CanvasTexture | null = null
  let hudSprite: THREE.Sprite | null = null

  function clearCourse() {
    while (courseGroup.children.length) {
      const child = courseGroup.children[0]
      courseGroup.remove(child)
    }
    roots = []
  }

  function buildFloor(course: DominoCourse) {
    const cx = (course.bounds.minX + course.bounds.maxX) / 2
    const cz = (course.bounds.minZ + course.bounds.maxZ) / 2
    const spanX = course.bounds.maxX - course.bounds.minX + 10
    const spanZ = course.bounds.maxZ - course.bounds.minZ + 10

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(spanX, spanZ),
      new THREE.MeshStandardMaterial({
        color: FLOOR_COLOR,
        roughness: 0.95,
        metalness: 0.05,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, -0.02, cz)
    floor.receiveShadow = true
    courseGroup.add(floor)

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(spanX * 0.92, 0.35, spanZ * 0.92),
      new THREE.MeshStandardMaterial({
        color: TABLE_COLOR,
        roughness: 0.7,
        metalness: 0.15,
      }),
    )
    table.position.set(cx, -0.2, cz)
    table.receiveShadow = true
    table.castShadow = true
    courseGroup.add(table)
  }

  function buildDomino(tileIndex: number, nearMiss: boolean, finale: boolean) {
    const root = new THREE.Group()

    const body = new THREE.Mesh(dominoGeo, nearMiss || finale ? edgeMat : bodyMat)
    body.castShadow = true
    body.receiveShadow = true
    root.add(body)

    const band = new THREE.Mesh(
      new THREE.BoxGeometry(DOMINO.face + 0.02, 0.08, DOMINO.thick + 0.02),
      edgeMat,
    )
    root.add(band)

    const pipGeo = new THREE.SphereGeometry(0.07, 8, 8)
    for (const py of [-0.32, 0.32]) {
      const pip = new THREE.Mesh(pipGeo, pipMat)
      pip.position.set(DOMINO.face * 0.52, py * DOMINO.h * 0.35, 0)
      root.add(pip)
    }

    if (finale) {
      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshStandardMaterial({
          color: VAULT_COLOR,
          emissive: VAULT_COLOR,
          emissiveIntensity: 0.45,
          metalness: 0.6,
          roughness: 0.25,
        }),
      )
      jewel.position.set(0, DOMINO.h * 0.15, DOMINO.thick * 0.35)
      root.add(jewel)
    }

    root.userData.tileIndex = tileIndex
    return root
  }

  function buildProps(course: DominoCourse) {
    for (const prop of course.props) {
      if (prop.kind === 'vault') {
        const vault = new THREE.Group()
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 2.8, 0.35),
          new THREE.MeshStandardMaterial({
            color: 0x3a5245,
            metalness: 0.35,
            roughness: 0.4,
          }),
        )
        frame.castShadow = true
        vault.add(frame)
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 2.0, 0.2),
          new THREE.MeshStandardMaterial({
            color: VAULT_COLOR,
            metalness: 0.55,
            roughness: 0.28,
            emissive: VAULT_COLOR,
            emissiveIntensity: 0.28,
          }),
        )
        door.position.z = 0.15
        vault.add(door)
        const dial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.12, 24),
          new THREE.MeshStandardMaterial({
            color: 0xf0e6c8,
            metalness: 0.7,
            roughness: 0.25,
          }),
        )
        dial.rotation.x = Math.PI / 2
        dial.position.set(0, 0.1, 0.28)
        vault.add(dial)
        vault.position.set(prop.x, prop.y + 1.4, prop.z)
        vault.rotation.y = prop.yaw
        vault.scale.setScalar(prop.scale ?? 1)
        courseGroup.add(vault)
      } else if (prop.kind === 'pillar') {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 3.2, 10),
          new THREE.MeshStandardMaterial({
            color: 0x4a6354,
            roughness: 0.75,
          }),
        )
        pillar.position.set(prop.x, 1.6, prop.z)
        pillar.castShadow = true
        courseGroup.add(pillar)
      } else if (prop.kind === 'rail') {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.7, 2.2),
          new THREE.MeshStandardMaterial({
            color: 0x8a7348,
            metalness: 0.4,
            roughness: 0.45,
          }),
        )
        rail.position.set(prop.x, prop.y + 0.35, prop.z)
        rail.rotation.y = prop.yaw
        rail.castShadow = true
        courseGroup.add(rail)
      } else if (prop.kind === 'crack') {
        const crack = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4 * (prop.scale ?? 1), 0.35),
          new THREE.MeshStandardMaterial({
            color: 0x050806,
            roughness: 1,
            transparent: true,
            opacity: 0.85,
          }),
        )
        crack.rotation.x = -Math.PI / 2
        crack.position.set(prop.x, prop.y + 0.01, prop.z)
        crack.rotation.z = prop.yaw
        courseGroup.add(crack)
      }
    }
  }

  function ensureHud() {
    if (hudCanvas) return
    hudCanvas = document.createElement('canvas')
    hudCanvas.width = 1024
    hudCanvas.height = 280
    hudTexture = new THREE.CanvasTexture(hudCanvas)
    const mat = new THREE.SpriteMaterial({
      map: hudTexture,
      transparent: true,
      depthTest: false,
    })
    hudSprite = new THREE.Sprite(mat)
    // Keep world size inside a typical FOV frustum with margin
    hudSprite.scale.set(4.6, 1.25, 1)
    hudSprite.position.set(0, 4, 0)
    hudSprite.visible = false
    scene.add(hudSprite)
  }

  const api: DominoScene = {
    renderer,
    scene,
    camera,
    get roots() {
      return roots
    },
    courseGroup,
    setCourse(course: DominoCourse) {
      clearCourse()
      buildFloor(course)
      buildProps(course)
      for (const tile of course.tiles) {
        const root = buildDomino(
          tile.index,
          tile.nearMiss,
          tile.kind === 'finale',
        )
        // Matches cannon body center (standing on floor/pedestal)
        root.position.set(tile.x, tile.y + DOMINO.h / 2, tile.z)
        root.rotation.y = tile.yaw
        courseGroup.add(root)
        roots.push(root)

        if (tile.y > 0.08) {
          const pedestal = new THREE.Mesh(
            new THREE.BoxGeometry(
              DOMINO.face * 1.05,
              Math.max(0.08, tile.y),
              DOMINO.thick * 1.2,
            ),
            new THREE.MeshStandardMaterial({
              color: 0x5a7a66,
              roughness: 0.7,
              metalness: 0.08,
            }),
          )
          pedestal.position.set(tile.x, tile.y / 2 - 0.02, tile.z)
          pedestal.rotation.y = tile.yaw
          pedestal.castShadow = true
          pedestal.receiveShadow = true
          courseGroup.add(pedestal)
        }
      }
      rim.position.set(
        (course.bounds.minX + course.bounds.maxX) / 2,
        4,
        (course.bounds.minZ + course.bounds.maxZ) / 2,
      )
    },
    syncPoses(poses: PhysicsPose[]) {
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i]
        const pose = poses[i]
        if (!root || !pose) continue
        root.position.set(pose.x, pose.y, pose.z)
        root.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw)
      }
    },
    render() {
      renderer.render(scene, camera)
    },
    setSize(cssWidth: number, cssHeight: number, dpr: number) {
      renderer.setPixelRatio(dpr)
      renderer.setSize(cssWidth, cssHeight, false)
      camera.aspect = cssWidth / cssHeight
      camera.updateProjectionMatrix()
    },
    drawHud(overlay: CascadeOverlay) {
      ensureHud()
      if (!hudCanvas || !hudTexture || !hudSprite) return
      const ctx = hudCanvas.getContext('2d')
      if (!ctx) return
      const w = hudCanvas.width
      const h = hudCanvas.height
      ctx.clearRect(0, 0, w, h)

      const text =
        overlay.countdownValue !== null
          ? overlay.countdownValue <= 0
            ? 'GO'
            : String(overlay.countdownValue)
          : overlay.banner

      if (!text) {
        hudSprite.visible = false
        return
      }

      hudSprite.visible = true
      const isCountdown = overlay.countdownValue !== null
      const padX = 48
      const boxW = w - padX * 2
      const boxH = isCountdown ? 140 : 100
      const boxY = (h - boxH) / 2

      ctx.fillStyle = 'rgba(5,12,8,0.72)'
      roundRect2d(ctx, padX, boxY, boxW, boxH, 14)
      ctx.fill()
      ctx.strokeStyle = 'rgba(232,197,71,0.45)'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#f0e6c8'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      let fontSize = isCountdown ? 96 : 52
      const fontWeight = isCountdown ? 800 : 700
      const maxTextW = boxW - 56
      do {
        ctx.font = `${fontWeight} ${fontSize}px Cinzel, Georgia, serif`
        if (ctx.measureText(text).width <= maxTextW) break
        fontSize -= 2
      } while (fontSize > 22)

      ctx.fillText(text, w / 2, h / 2)
      hudTexture.needsUpdate = true

      // Keep sprite in front of camera, sized to stay on-screen
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      const dist = 7.5
      hudSprite.position.copy(camera.position).add(forward.multiplyScalar(dist))
      hudSprite.position.y += 0.35
      hudSprite.quaternion.copy(camera.quaternion)

      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
      const viewH = 2 * Math.tan(halfFov) * dist
      const viewW = viewH * camera.aspect
      const bannerW = Math.min(viewW * 0.72, 5.2)
      const bannerH = bannerW * (h / w)
      hudSprite.scale.set(bannerW, bannerH, 1)
    },
    dispose() {
      clearCourse()
      dominoGeo.dispose()
      bodyMat.dispose()
      edgeMat.dispose()
      pipMat.dispose()
      if (hudTexture) hudTexture.dispose()
      renderer.dispose()
    },
  }

  return api
}

const VIEW_ASPECT = 540 / 960

function roundRect2d(
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
