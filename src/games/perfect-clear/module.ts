import type { SpectatorGameModule } from '../../shared/module'
import { ClearControls } from './ClearControls'
import { ClearGameView } from './ClearGameView'

export const perfectClearModule: SpectatorGameModule = {
  id: 'perfect-clear',
  title: 'Perfect Clear',
  blurb: 'One spark. One cascade. 100% wipe.',
  idleHint: 'Tap to ignite',
  available: true,
  GameView: ClearGameView,
  Controls: ClearControls,
}
