import type { SpectatorGameModule } from '../../shared/module'
import { SquishControls } from './SquishControls'
import { SquishGameView } from './SquishGameView'

export const squishFitModule: SpectatorGameModule = {
  id: 'squish-fit',
  title: 'Squish Fit',
  blurb: 'Soft gel shapes. One jar. 100% volume.',
  idleHint: 'Shapes drop automatically',
  available: true,
  GameView: SquishGameView,
  Controls: SquishControls,
}
