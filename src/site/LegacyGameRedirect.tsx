import { Navigate, useParams } from 'react-router-dom'
import { isStudioOnlyGameId } from '../catalog/games'

/** Soft legacy: root studio game ids redirect into /studio. Unknown slugs go home. */
export function LegacyGameRedirect() {
  const { gameId = '' } = useParams<{ gameId: string }>()

  if (isStudioOnlyGameId(gameId)) {
    return <Navigate to={`/studio/${gameId}`} replace />
  }

  return <Navigate to="/" replace />
}
