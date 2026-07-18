import type { SpectatorGameModule } from '../../shared/module'
import { DominoControls } from './DominoControls'
import { DominoGameView } from './DominoGameView'

export const dominoHeistModule: SpectatorGameModule = {
  id: 'domino-heist',
  title: 'Domino Heist',
  blurb: 'Tip race — first gold vault piece down wins. Gaps stall you out.',
  idleHint: 'First to tip the gold vault piece wins',
  available: true,
  GameView: DominoGameView,
  Controls: DominoControls,
}
