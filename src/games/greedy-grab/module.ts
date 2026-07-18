import type { SpectatorGameModule } from '../../shared/module'
import { GreedyControls } from './GreedyControls'
import { GreedyGameView } from './GreedyGameView'

export const greedyGrabModule: SpectatorGameModule = {
  id: 'greedy-grab',
  title: 'Greedy Grab',
  blurb: 'Vacuum coins until weight dooms you.',
  available: true,
  GameView: GreedyGameView,
  Controls: GreedyControls,
}
