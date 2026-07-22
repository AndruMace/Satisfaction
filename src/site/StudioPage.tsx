import { Link, Navigate, useParams } from 'react-router-dom'
import {
  DEFAULT_STUDIO_GAME_ID,
  getGameById,
  getStudioGames,
} from '../catalog/games'
import { GameShell } from '../shell/GameShell'
import { SITE_NAME } from './content'
import { useDocumentTitle } from './useDocumentTitle'

export function StudioIndexRedirect() {
  return <Navigate to={`/studio/${DEFAULT_STUDIO_GAME_ID}`} replace />
}

export function StudioPage() {
  const { gameId = DEFAULT_STUDIO_GAME_ID } = useParams<{ gameId: string }>()
  const games = getStudioGames()
  const active = getGameById(gameId)

  useDocumentTitle(active ? `Studio · ${active.title} · ${SITE_NAME}` : `Studio · ${SITE_NAME}`)

  if (!active) {
    return <Navigate to={`/studio/${DEFAULT_STUDIO_GAME_ID}`} replace />
  }

  return (
    <div className={`suite suite--studio suite--${active.id}`}>
      <nav className="game-nav" aria-label="Studio games">
        {games.map((game) => (
          <Link
            key={game.id}
            to={`/studio/${game.id}`}
            className={`game-nav__tab ${game.id === active.id ? 'game-nav__tab--active' : ''} ${!game.available ? 'game-nav__tab--soon' : ''}`}
            aria-current={game.id === active.id ? 'page' : undefined}
          >
            {game.title}
            {!game.available && <span className="game-nav__soon">Soon</span>}
          </Link>
        ))}
      </nav>

      <GameShell key={active.id} module={active} />
    </div>
  )
}
