import type { SpectatorGameModule } from '../../shared/module'
import { CascadeControls } from './CascadeControls'
import { CascadeGameView } from './CascadeGameView'

export const cascadeTycoonModule: SpectatorGameModule = {
  id: 'cascade-tycoon',
  title: 'Cascade Tycoon',
  blurb: 'Hit the goal before time runs out — bounce, cash out, grow.',
  idleHint: 'Tap Launch to start the run',
  available: true,
  visibility: 'studio',
  GameView: CascadeGameView,
  Controls: CascadeControls,
}
