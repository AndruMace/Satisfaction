import RAPIER from '@dimforge/rapier3d-compat'
import type { DominoTune } from './settings'
import { DEFAULT_TUNE } from './settings'
import type { DominoCourse, TipImpact } from './types'
import { DOMINO } from './types'

export type PhysicsPose = {
  x: number
  y: number
  z: number
  qx: number
  qy: number
  qz: number
  qw: number
}

export type DominoPhysics = {
  poses: PhysicsPose[]
  frontIndex: number
  done: boolean
  failed: boolean
  timeScale: number
  tips: number
  nearMissesCleared: number
  clutchHang: boolean
  setTune: (tune: DominoTune) => void
  reset: (course: DominoCourse) => void
  kickstart: () => void
  step: (dt: number) => TipImpact[]
  activePosition: () => { x: number; y: number; z: number } | null
  dispose: () => void
}

const TILT_TIPPED = 0.3
const TILT_FLAT = 0.82
const STALL_SEC = 5
const SETTLE_SPEED = 0.45
/** Collider smaller than the mesh so contacts don't look like meshing. */
const COL_SCALE = 0.9
/** How many tiles ahead of the front stay simulated. */
const AHEAD = 3
/** Keep this many fallen tiles live so contact finishes naturally. */
const BEHIND = 2

let rapierInit: Promise<void> | null = null

/** Must be awaited once before creating a physics world. */
export function initDominoPhysics(): Promise<void> {
  if (!rapierInit) {
    rapierInit = RAPIER.init().then(() => undefined)
  }
  return rapierInit
}

function tipAxisWorld(yaw: number) {
  return { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
}

function tipDirWorld(yaw: number) {
  return { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }
}

function yawQuat(yaw: number) {
  const half = yaw * 0.5
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
}

function uprightTilt(rotation: { x: number; y: number; z: number; w: number }) {
  // 1 - localUp.y after rotating (0,1,0)
  return Math.max(0, Math.min(1, 2 * (rotation.x * rotation.x + rotation.z * rotation.z)))
}

export function createDominoPhysics(): DominoPhysics {
  let world: RAPIER.World | null = null
  let bodies: RAPIER.RigidBody[] = []
  let pedestals: (RAPIER.RigidBody | null)[] = []
  let enabled: boolean[] = []
  let course: DominoCourse | null = null
  let tune: DominoTune = { ...DEFAULT_TUNE }
  let tipped: boolean[] = []
  let poses: PhysicsPose[] = []
  let frontIndex = -1
  let done = false
  let failed = false
  let timeScale = 1
  let tips = 0
  let nearMissesCleared = 0
  let clutchHang = false
  let stallTimer = 0
  let settleTimer = 0
  let raceTime = 0
  let dramaTimer = 0
  let kickFramesLeft = 0
  let hx = DOMINO.face * 0.5 * COL_SCALE
  let hy = DOMINO.h * 0.5 * COL_SCALE
  let hz = DOMINO.thick * 0.5 * COL_SCALE

  function clearWorld() {
    if (world) {
      world.free()
    }
    world = null
    bodies = []
    pedestals = []
    enabled = []
    tipped = []
    poses = []
  }

  function syncPoses() {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]
      if (!body || !enabled[i]) continue
      const t = body.translation()
      const r = body.rotation()
      poses[i] = {
        x: t.x,
        y: t.y,
        z: t.z,
        qx: r.x,
        qy: r.y,
        qz: r.z,
        qw: r.w,
      }
    }
  }

  function setEnabled(i: number, on: boolean) {
    if (!bodies[i] || enabled[i] === on) return
    bodies[i].setEnabled(on)
    enabled[i] = on
    if (on) bodies[i].wakeUp()
    const ped = pedestals[i]
    if (ped) ped.setEnabled(on)
  }

  function buildWorld(next: DominoCourse) {
    clearWorld()
    world = new RAPIER.World({ x: 0, y: -tune.gravity, z: 0 })
    world.timestep = 1 / 120

    hx = DOMINO.face * 0.5 * COL_SCALE
    hy = DOMINO.h * 0.5 * COL_SCALE
    hz = DOMINO.thick * 0.5 * COL_SCALE

    const cx = (next.bounds.minX + next.bounds.maxX) / 2
    const cz = (next.bounds.minZ + next.bounds.maxZ) / 2
    const spanX = next.bounds.maxX - next.bounds.minX + 16
    const spanZ = next.bounds.maxZ - next.bounds.minZ + 16

    const ground = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, -0.5, cz),
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(spanX / 2, 0.5, spanZ / 2)
        .setFriction(tune.groundFriction)
        .setRestitution(0),
      ground,
    )

    for (const tile of next.tiles) {
      let ped: RAPIER.RigidBody | null = null
      if (tile.y > 0.08) {
        const ph = tile.y
        ped = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(tile.x, ph / 2 - 0.01, tile.z)
            .setRotation(yawQuat(tile.yaw)),
        )
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            DOMINO.face * 0.36,
            ph / 2,
            DOMINO.thick * 0.38,
          )
            .setFriction(tune.groundFriction)
            .setRestitution(0),
          ped,
        )
        ped.setEnabled(false)
      }
      pedestals.push(ped)

      const y = tile.y + hy + 0.002
      const q = yawQuat(tile.yaw)
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(tile.x, y, tile.z)
          .setRotation(q)
          .setLinearDamping(tune.linearDamping)
          .setAngularDamping(tune.angularDamping)
          .setCanSleep(true),
      )
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setFriction(tune.dominoFriction)
          .setRestitution(Math.min(0.02, tune.restitution))
          .setDensity(Math.max(0.4, tune.mass)),
        body,
      )
      body.setEnabled(false)
      bodies.push(body)
      enabled.push(false)
      poses.push({
        x: tile.x,
        y,
        z: tile.z,
        qx: q.x,
        qy: q.y,
        qz: q.z,
        qw: q.w,
      })
    }

    tipped = bodies.map(() => false)

    // Only the first few tiles start in the solver — many simultaneous
    // upright bodies (even sleeping) destabilize long curved runs.
    for (let i = 0; i < Math.min(3, bodies.length); i++) setEnabled(i, true)
    syncPoses()
  }

  function maintainWindow() {
    const front = Math.max(0, frontIndex)
    const lo = Math.max(0, front - BEHIND)
    const hi = Math.min(bodies.length - 1, front + AHEAD)

    for (let i = 0; i < bodies.length; i++) {
      if (i >= lo && i <= hi) {
        setEnabled(i, true)
      } else if (enabled[i]) {
        // Freeze finished tiles in their fallen pose; keep upcoming ones out.
        const rot = bodies[i].rotation()
        const flat = tipped[i] && uprightTilt(rot) >= TILT_FLAT
        const still = (() => {
          const v = bodies[i].linvel()
          const w = bodies[i].angvel()
          return Math.hypot(v.x, v.y, v.z) + Math.hypot(w.x, w.y, w.z) < SETTLE_SPEED
        })()
        if (i < lo && (flat || (tipped[i] && still))) {
          syncPoses() // capture pose before disable
          const t = bodies[i].translation()
          const r = bodies[i].rotation()
          poses[i] = { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w }
          setEnabled(i, false)
        } else if (i > hi && !tipped[i]) {
          setEnabled(i, false)
        }
      }
    }
  }

  const api: DominoPhysics = {
    get poses() {
      return poses
    },
    get frontIndex() {
      return frontIndex
    },
    get done() {
      return done
    },
    get failed() {
      return failed
    },
    get timeScale() {
      return timeScale
    },
    set timeScale(v: number) {
      timeScale = v
    },
    get tips() {
      return tips
    },
    get nearMissesCleared() {
      return nearMissesCleared
    },
    get clutchHang() {
      return clutchHang
    },
    setTune(next: DominoTune) {
      tune = { ...next }
    },
    reset(next: DominoCourse) {
      course = next
      frontIndex = -1
      done = false
      failed = false
      timeScale = 1
      tips = 0
      nearMissesCleared = 0
      clutchHang = false
      stallTimer = 0
      settleTimer = 0
      raceTime = 0
      dramaTimer = 0
      kickFramesLeft = 0
      buildWorld(next)
    },
    kickstart() {
      if (!bodies[0] || !course || !world) return
      setEnabled(0, true)
      if (bodies[1]) setEnabled(1, true)
      if (bodies[2]) setEnabled(2, true)
      // Brief physical kick only — cascade continues via collisions.
      kickFramesLeft = 10
      frontIndex = 0
    },
    step(dt: number) {
      const impacts: TipImpact[] = []
      if (!world || !course || done || failed) {
        syncPoses()
        return impacts
      }

      if (dramaTimer > 0) {
        dramaTimer = Math.max(0, dramaTimer - dt)
        if (dramaTimer <= 0) timeScale = 1
      }

      raceTime += dt
      maintainWindow()

      if (kickFramesLeft > 0 && bodies[0] && course) {
        const yaw = course.tiles[0].yaw
        const axis = tipAxisWorld(yaw)
        const dir = tipDirWorld(yaw)
        const spin = Math.min(3.2, tune.pushSpin)
        bodies[0].wakeUp()
        bodies[0].setAngvel(
          { x: axis.x * spin, y: 0, z: axis.z * spin },
          true,
        )
        if (kickFramesLeft === 10) {
          const imp = Math.min(0.9, tune.pushPower * 0.45)
          bodies[0].applyImpulse(
            { x: dir.x * imp, y: 0.03, z: dir.z * imp },
            true,
          )
        }
        kickFramesLeft -= 1
      }

      const pace = Math.max(0.25, Math.min(1.15, tune.simSpeed))
      const frameSteps = Math.max(1, Math.round((dt * timeScale * pace) / world.timestep))
      for (let s = 0; s < Math.min(8, frameSteps); s++) {
        // Keep the tip neighborhood awake so collisions resolve.
        const front = Math.max(0, frontIndex)
        for (let i = Math.max(0, front - 1); i <= Math.min(bodies.length - 1, front + AHEAD); i++) {
          if (enabled[i] && bodies[i].isSleeping()) bodies[i].wakeUp()
        }
        world.step()
      }

      let anyNewTip = false
      let maxAliveFront = frontIndex
      clutchHang = false
      const tipThresh = Math.max(TILT_TIPPED, tune.tipThreshold)

      for (let i = 0; i < bodies.length; i++) {
        if (!enabled[i] && !tipped[i]) continue
        if (!enabled[i]) continue
        const tilt = uprightTilt(bodies[i].rotation())

        if (!tipped[i] && tilt >= tipThresh) {
          tipped[i] = true
          tips += 1
          anyNewTip = true
          maxAliveFront = Math.max(maxAliveFront, i)
          // Enable the next few so they can receive a real collision.
          for (let j = i + 1; j <= Math.min(bodies.length - 1, i + AHEAD); j++) {
            setEnabled(j, true)
          }

          const tile = course.tiles[i]
          const w = bodies[i].angvel()
          const speed = Math.hypot(w.x, w.y, w.z)
          if (tile.nearMiss) {
            nearMissesCleared += 1
            timeScale = 0.42
            dramaTimer = 0.65
            impacts.push({ kind: 'gap', index: i, speed })
          } else if (tile.kind === 'finale' || i === bodies.length - 1) {
            impacts.push({ kind: 'finale', index: i, speed })
          } else {
            impacts.push({ kind: 'tip', index: i, speed })
          }
        }

        if (
          i + 1 < bodies.length &&
          course.tiles[i + 1].nearMiss &&
          tipped[i] &&
          !tipped[i + 1] &&
          tilt > tipThresh + 0.1 &&
          tilt < TILT_FLAT
        ) {
          clutchHang = true
        }

        if (tipped[i]) maxAliveFront = Math.max(maxAliveFront, i)
      }

      frontIndex = maxAliveFront
      maintainWindow()
      syncPoses()

      const last = bodies.length - 1
      const lastTipped = last >= 0 && tipped[last]
      const lastTilt =
        last >= 0 && enabled[last] ? uprightTilt(bodies[last].rotation()) : lastTipped ? 1 : 0

      if (lastTipped) {
        let moving = 0
        for (let i = 0; i < bodies.length; i++) {
          if (!enabled[i]) continue
          const v = bodies[i].linvel()
          const w = bodies[i].angvel()
          if (Math.hypot(v.x, v.y, v.z) + Math.hypot(w.x, w.y, w.z) > SETTLE_SPEED) {
            moving += 1
          }
        }
        if (moving === 0 || lastTilt >= TILT_FLAT) {
          settleTimer += dt
          if (settleTimer > 0.5 || lastTilt >= TILT_FLAT) {
            done = true
            impacts.push({ kind: 'finale', index: last, speed: 1 })
          }
        } else {
          settleTimer = 0
        }
      } else if (raceTime > 1.4) {
        if (anyNewTip) stallTimer = 0
        else stallTimer += dt
        if (stallTimer >= STALL_SEC && frontIndex < last - 1) {
          failed = true
          done = true
        }
        if (stallTimer >= STALL_SEC * 1.35 && frontIndex >= 0) {
          failed = true
          done = true
        }
      }

      return impacts
    },
    activePosition() {
      if (!poses.length) return null
      const idx = Math.max(0, frontIndex)
      const p = poses[idx] ?? poses[0]
      return { x: p.x, y: p.y, z: p.z }
    },
    dispose() {
      clearWorld()
      course = null
    },
  }

  return api
}
