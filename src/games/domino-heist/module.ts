import type { SpectatorGameModule } from '../../shared/module'
import { DominoControls } from './DominoControls'
import { DominoGameView } from './DominoGameView'

export const dominoHeistModule: SpectatorGameModule = {
  id: 'domino-heist',
  title: 'Domino Heist',
  blurb: 'Real physics cascade — spaced to look doomed, forced by nothing.',
  idleHint: 'Launch and let gravity do the heist',
  available: true,
  visibility: 'studio',
  GameView: DominoGameView,
  Controls: DominoControls,
}
