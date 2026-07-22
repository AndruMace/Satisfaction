import { Navigate, useParams } from 'react-router-dom'
import { DEFAULT_PUBLIC_GAME_ID, isStudioOnlyGameId } from '../catalog/games'

/** Soft legacy: root studio game ids redirect into /studio. Unknown slugs go home. */
export function LegacyGameRedirect() {
  const { gameId = '' } = useParams<{ gameId: string }>()

  if (gameId === 'drift-tunnel') {
    return <Navigate to={`/${DEFAULT_PUBLIC_GAME_ID}`} replace />
  }

  if (isStudioOnlyGameId(gameId)) {
    return <Navigate to={`/studio/${gameId}`} replace />
  }

  return <Navigate to="/" replace />
}
