import { Navigate } from 'react-router-dom'
import { DEFAULT_PUBLIC_GAME_ID, getGameById } from '../catalog/games'
import { GameShell } from '../shell/GameShell'
import { SITE_NAME } from './content'
import { SiteHeader } from './SiteHeader'
import { useDocumentTitle } from './useDocumentTitle'

export function PlayPage() {
  const game = getGameById(DEFAULT_PUBLIC_GAME_ID)
  useDocumentTitle(game ? `${game.title} · ${SITE_NAME}` : SITE_NAME)

  if (!game || game.visibility !== 'public') {
    return <Navigate to="/" replace />
  }

  return (
    <div className={`site site--play suite suite--${game.id}`}>
      <SiteHeader />
      <GameShell key={game.id} module={game} />
    </div>
  )
}
