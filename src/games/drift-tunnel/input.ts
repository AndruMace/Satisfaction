import type { DriftInput } from './types'

export type InputController = {
  get: () => DriftInput
  setTouch: (partial: Partial<DriftInput>) => void
  dispose: () => void
}

export function createInputController(target: HTMLElement): InputController {
  const keys = { left: false, right: false, jump: false }
  const touch = { left: false, right: false, jump: false }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true
        e.preventDefault()
        break
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        keys.jump = true
        e.preventDefault()
        break
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false
        break
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false
        break
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        keys.jump = false
        break
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // Blur safety
  const onBlur = () => {
    keys.left = keys.right = keys.jump = false
  }
  window.addEventListener('blur', onBlur)

  void target

  return {
    get: () => ({
      left: keys.left || touch.left,
      right: keys.right || touch.right,
      jump: keys.jump || touch.jump,
    }),
    setTouch(partial) {
      if (partial.left !== undefined) touch.left = partial.left
      if (partial.right !== undefined) touch.right = partial.right
      if (partial.jump !== undefined) touch.jump = partial.jump
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    },
  }
}
