import type { SpectatorGameModule } from '../../shared/module'
import { BubbleControls } from './BubbleControls'
import { BubbleGameView } from './BubbleGameView'

export const bubbleWarModule: SpectatorGameModule = {
  id: 'bubble-war',
  title: 'Bubble War',
  blurb: 'Inflate, shove, pop — last bubble standing.',
  available: true,
  visibility: 'studio',
  GameView: BubbleGameView,
  Controls: BubbleControls,
}
