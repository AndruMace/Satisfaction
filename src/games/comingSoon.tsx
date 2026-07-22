import type {
  GameControlsProps,
  GameViewProps,
  SpectatorGameModule,
} from '../shared/module'

function ComingSoonView(_props: GameViewProps) {
  return (
    <div className="coming-soon" role="status">
      <span>Coming soon</span>
    </div>
  )
}

function ComingSoonControls(_props: GameControlsProps) {
  return null
}

export function createComingSoonModule(
  id: string,
  title: string,
  blurb: string,
): SpectatorGameModule {
  return {
    id,
    title,
    blurb,
    available: false,
    visibility: 'studio',
    GameView: ComingSoonView,
    Controls: ComingSoonControls,
  }
}
