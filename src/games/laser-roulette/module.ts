import type { SpectatorGameModule } from '../../shared/module'
import { LaserControls } from './LaserControls'
import { LaserGameView } from './LaserGameView'

export const laserRouletteModule: SpectatorGameModule = {
  id: 'laser-roulette',
  title: 'Laser Roulette',
  blurb: 'Dodge the beams. Last standing wins.',
  available: true,
  visibility: 'studio',
  GameView: LaserGameView,
  Controls: LaserControls,
}
