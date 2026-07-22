import type { SpectatorGameModule } from '../../shared/module'
import { CascadeControls } from './CascadeControls'
import { CascadeGameView } from './CascadeGameView'

export const cascadeTycoonModule: SpectatorGameModule = {
  id: 'cascade-tycoon',
  title: 'Cascade Tycoon',
  blurb: 'Drop, bounce, cash out — grow the peg empire.',
  idleHint: 'Balls drop automatically',
  available: true,
  visibility: 'studio',
  GameView: CascadeGameView,
  Controls: CascadeControls,
}
