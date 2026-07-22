import type { SpectatorGameModule } from '../../shared/module'
import { DriftControls } from './DriftControls'
import { DriftGameView } from './DriftGameView'

export const driftTunnelModule: SpectatorGameModule = {
  id: 'drift-tunnel',
  title: 'Drift Tunnel',
  blurb: 'Auto-run a fractured space conduit. Flip gravity onto any face. Don’t fall into the void.',
  idleHint: 'Tap to launch',
  available: true,
  visibility: 'public',
  GameView: DriftGameView,
  Controls: DriftControls,
}
