import * as THREE from 'three'
import type { DominoCourse } from './types'

export type FollowCamera = {
  reset: (course: DominoCourse, camera: THREE.PerspectiveCamera) => void
  update: (
    camera: THREE.PerspectiveCamera,
    target: { x: number; y: number; z: number } | null,
    dt: number,
    mode: 'follow' | 'wide' | 'idle',
  ) => void
  punch: (amount?: number) => void
}

export function createFollowCamera(): FollowCamera {
  const desired = new THREE.Vector3()
  const look = new THREE.Vector3()
  const currentPos = new THREE.Vector3()
  const currentLook = new THREE.Vector3()
  let shake = 0
  let course: DominoCourse | null = null

  const offsetFollow = new THREE.Vector3(8.5, 7.2, 10)
  const offsetWide = new THREE.Vector3(20, 15, 22)

  function centerOf(c: DominoCourse) {
    return new THREE.Vector3(
      (c.bounds.minX + c.bounds.maxX) / 2,
      1.2,
      (c.bounds.minZ + c.bounds.maxZ) / 2,
    )
  }

  return {
    reset(next, camera) {
      course = next
      const c = centerOf(next)
      currentLook.copy(c)
      currentPos.set(c.x + 16, c.y + 12, c.z + 18)
      camera.position.copy(currentPos)
      camera.lookAt(currentLook)
      shake = 0
    },
    punch(amount = 0.25) {
      shake = Math.max(shake, amount)
    },
    update(camera, target, dt, mode) {
      if (!course) return

      const focus = target
        ? new THREE.Vector3(target.x, target.y, target.z)
        : centerOf(course)

      look.copy(focus)
      if (mode === 'wide' || mode === 'idle') {
        const c = centerOf(course)
        desired.set(c.x + offsetWide.x, c.y + offsetWide.y, c.z + offsetWide.z)
        look.copy(c)
      } else {
        // Side-angled chase — not top-down
        desired.set(
          focus.x + offsetFollow.x,
          focus.y + offsetFollow.y,
          focus.z + offsetFollow.z,
        )
      }

      const lerp = mode === 'follow' ? 1 - Math.pow(0.001, dt) : 1 - Math.pow(0.02, dt)
      currentPos.lerp(desired, Math.min(1, lerp * (mode === 'wide' ? 0.6 : 1.2)))
      currentLook.lerp(look, Math.min(1, lerp * 1.4))

      if (shake > 0) {
        currentPos.x += (Math.random() - 0.5) * shake
        currentPos.y += (Math.random() - 0.5) * shake * 0.5
        shake = Math.max(0, shake - dt * 1.8)
      }

      camera.position.copy(currentPos)
      camera.lookAt(currentLook)
    },
  }
}
