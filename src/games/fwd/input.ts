import type { FwdInput } from './types'

export type InputController = {
  get: () => FwdInput
  setTouch: (partial: Partial<FwdInput>) => void
  reset: () => void
  dispose: () => void
}

export function createInputController(target: HTMLElement): InputController {
  const keys = { left: false, right: false, jump: false }
  const touch = { left: false, right: false, jump: false }

  const onKeyDown = (e: KeyboardEvent) => {
    const captured =
      e.code === 'ArrowLeft' ||
      e.code === 'KeyA' ||
      e.code === 'ArrowRight' ||
      e.code === 'KeyD' ||
      e.code === 'ArrowUp' ||
      e.code === 'KeyW' ||
      e.code === 'Space'
    if (captured) e.preventDefault()
    if (e.repeat) return
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true
        break
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true
        break
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        keys.jump = true
        break
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false
        e.preventDefault()
        break
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        keys.jump = false
        e.preventDefault()
        break
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const reset = () => {
    keys.left = keys.right = keys.jump = false
    touch.left = touch.right = touch.jump = false
  }

  // Blur safety
  const onBlur = () => reset()
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
    reset,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    },
  }
}
