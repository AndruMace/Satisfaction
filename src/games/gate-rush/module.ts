import type { SpectatorGameModule } from '../../shared/module'
import { GateControls } from './GateControls'
import { GateGameView } from './GateGameView'

export const gateRushModule: SpectatorGameModule = {
  id: 'gate-rush',
  title: 'Gate Rush',
  blurb: 'Pick the math. Grow the army. Smash the boss.',
  idleHint: 'Tap to run — drag to steer',
  available: true,
  visibility: 'studio',
  GameView: GateGameView,
  Controls: GateControls,
}
