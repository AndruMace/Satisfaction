import type { SpectatorGameModule } from '../../shared/module'
import { FwdControls } from './FwdControls'
import { FwdGameView } from './FwdGameView'

export const fwdModule: SpectatorGameModule = {
  id: 'fwd',
  title: 'Fwd',
  blurb: 'Auto-run a fractured space conduit. Flip gravity onto any face. Don’t fall into the void.',
  idleHint: 'Tap to launch',
  available: true,
  visibility: 'public',
  GameView: FwdGameView,
  Controls: FwdControls,
}
