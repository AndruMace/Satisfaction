import type { SpectatorGameModule } from '../../shared/module'
import { BounceControls } from './BounceControls'
import { BounceGameView } from './BounceGameView'

export const bounceRaceModule: SpectatorGameModule = {
  id: 'bounce-race',
  title: 'Bounce Race',
  blurb: 'Two to six racers — launch and watch.',
  available: true,
  visibility: 'studio',
  GameView: BounceGameView,
  Controls: BounceControls,
}
