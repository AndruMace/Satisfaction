import { Link } from 'react-router-dom'
import { DEFAULT_PUBLIC_GAME_ID } from '../catalog/games'
import {
  HOME_HEADLINE,
  HOME_SUPPORT,
  PLAY_CTA_LABEL,
  SITE_NAME,
  SITE_TAGLINE,
} from './content'
import { HomeBackground } from './HomeBackground'
import { useDocumentTitle } from './useDocumentTitle'

export function HomePage() {
  useDocumentTitle(SITE_NAME)

  return (
    <div className="site site--home">
      <HomeBackground />
      <main className="home">
        <p className="home__tagline">{SITE_TAGLINE}</p>
        <h1 className="home__headline">{HOME_HEADLINE}</h1>
        <p className="home__support">{HOME_SUPPORT}</p>
        <Link to={`/${DEFAULT_PUBLIC_GAME_ID}`} className="home__cta btn btn--primary">
          {PLAY_CTA_LABEL}
        </Link>
      </main>
    </div>
  )
}
