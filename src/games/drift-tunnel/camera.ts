import * as THREE from 'three'
import { playerWorldPos, type DriftWorld } from './sim'
import { FACE_OUTWARD, type FaceIndex } from './types'

export type DriftCamera = {
  camera: THREE.PerspectiveCamera
  update: (world: DriftWorld, dt: number) => void
  reset: (world: DriftWorld) => void
}

function faceUp(face: FaceIndex, out: THREE.Vector3) {
  const o = FACE_OUTWARD[face]!
  out.set(-o[0]!, -o[1]!, -o[2]!)
}

export function createDriftCamera(): DriftCamera {
  const camera = new THREE.PerspectiveCamera(58, 540 / 960, 0.08, 140)
  const desiredPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const desiredUp = new THREE.Vector3()

  function compute(world: DriftWorld) {
    const p = playerWorldPos(world)
    faceUp(world.face, desiredUp)

    desiredPos.set(p.x, p.y, p.z)
    desiredPos.addScaledVector(desiredUp, 1.6)
    desiredPos.z -= 3.5

    look.set(p.x, p.y, p.z)
    look.addScaledVector(desiredUp, 0.4)
    look.z += 7
  }

  function applyLook() {
    camera.up.copy(up)
    camera.lookAt(look)
  }

  return {
    camera,
    reset(world) {
      compute(world)
      camera.position.copy(desiredPos)
      up.copy(desiredUp)
      applyLook()
    },
    update(world, dt) {
      compute(world)
      const a = 1 - Math.exp(-9 * dt)
      const b = 1 - Math.exp(-8 * dt)
      camera.position.lerp(desiredPos, a)
      up.lerp(desiredUp, b).normalize()
      applyLook()
    },
  }
}
