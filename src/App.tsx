import { useEffect, useState } from 'react'
import { bounceRaceModule } from './games/bounce-race/module'
import { bubbleWarModule } from './games/bubble-war/module'
import { cascadeTycoonModule } from './games/cascade-tycoon/module'
import { dominoHeistModule } from './games/domino-heist/module'
import { driftTunnelModule } from './games/drift-tunnel/module'
import { laserRouletteModule } from './games/laser-roulette/module'
import { perfectClearModule } from './games/perfect-clear/module'
import { squishFitModule } from './games/squish-fit/module'
import type { SpectatorGameModule } from './shared/module'
import { GameShell } from './shell/GameShell'
import './App.css'

const GAME_MODULES: SpectatorGameModule[] = [
  bounceRaceModule,
  dominoHeistModule,
  laserRouletteModule,
  bubbleWarModule,
  cascadeTycoonModule,
  perfectClearModule,
  squishFitModule,
  driftTunnelModule,
]

function gameIdFromPath(pathname: string): string {
  const slug = pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? ''
  return GAME_MODULES.some((game) => game.id === slug) ? slug : bounceRaceModule.id
}

function pathForGame(id: string): string {
  return `/${id}`
}

function App() {
  const [activeId, setActiveId] = useState(() => gameIdFromPath(window.location.pathname))
  const active = GAME_MODULES.find((game) => game.id === activeId) ?? bounceRaceModule

  useEffect(() => {
    const expected = pathForGame(activeId)
    if (window.location.pathname !== expected) {
      window.history.replaceState(null, '', expected)
    }
  }, [activeId])

  useEffect(() => {
    const onPopState = () => {
      setActiveId(gameIdFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const selectGame = (id: string) => {
    if (id === activeId) return
    window.history.pushState(null, '', pathForGame(id))
    setActiveId(id)
  }

  return (
    <div className={`suite suite--${active.id}`}>
      <nav className="game-nav" aria-label="Games">
        {GAME_MODULES.map((game) => (
          <button
            key={game.id}
            type="button"
            className={`game-nav__tab ${game.id === active.id ? 'game-nav__tab--active' : ''} ${!game.available ? 'game-nav__tab--soon' : ''}`}
            aria-current={game.id === active.id ? 'page' : undefined}
            onClick={() => selectGame(game.id)}
          >
            {game.title}
            {!game.available && <span className="game-nav__soon">Soon</span>}
          </button>
        ))}
      </nav>

      {/* key unmounts prior loop + recorder on game switch */}
      <GameShell key={active.id} module={active} />
    </div>
  )
}

export default App
