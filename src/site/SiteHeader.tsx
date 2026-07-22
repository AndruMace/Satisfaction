import { Link } from 'react-router-dom'
import { DEFAULT_PUBLIC_GAME_ID } from '../catalog/games'
import { SITE_NAME } from './content'

type SiteHeaderProps = {
  /** Show the public Drift link (home + play). Studio never links here from public chrome. */
  showPlayLink?: boolean
}

export function SiteHeader({ showPlayLink = true }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        {SITE_NAME}
      </Link>
      {showPlayLink && (
        <nav className="site-header__nav" aria-label="Site">
          <Link to={`/${DEFAULT_PUBLIC_GAME_ID}`} className="site-header__link">
            Play
          </Link>
        </nav>
      )}
    </header>
  )
}
