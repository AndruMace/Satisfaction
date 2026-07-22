import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DEFAULT_PUBLIC_GAME_ID } from './catalog/games'
import { HomePage } from './site/HomePage'
import { LegacyGameRedirect } from './site/LegacyGameRedirect'
import { PlayPage } from './site/PlayPage'
import { StudioIndexRedirect, StudioPage } from './site/StudioPage'
import './App.css'
import './site/site.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path={`/${DEFAULT_PUBLIC_GAME_ID}`} element={<PlayPage />} />
        <Route path="/studio" element={<StudioIndexRedirect />} />
        <Route path="/studio/:gameId" element={<StudioPage />} />
        <Route path="/:gameId" element={<LegacyGameRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
