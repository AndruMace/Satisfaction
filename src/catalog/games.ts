import { bounceRaceModule } from '../games/bounce-race/module'
import { bubbleWarModule } from '../games/bubble-war/module'
import { cascadeTycoonModule } from '../games/cascade-tycoon/module'
import { dominoHeistModule } from '../games/domino-heist/module'
import { fwdModule } from '../games/fwd/module'
import { laserRouletteModule } from '../games/laser-roulette/module'
import { perfectClearModule } from '../games/perfect-clear/module'
import { squishFitModule } from '../games/squish-fit/module'
import type { SpectatorGameModule } from '../shared/module'

export const GAME_MODULES: SpectatorGameModule[] = [
  bounceRaceModule,
  dominoHeistModule,
  laserRouletteModule,
  bubbleWarModule,
  cascadeTycoonModule,
  perfectClearModule,
  squishFitModule,
  fwdModule,
]

export const DEFAULT_PUBLIC_GAME_ID = fwdModule.id
export const DEFAULT_STUDIO_GAME_ID = fwdModule.id

export function getGameById(id: string): SpectatorGameModule | undefined {
  return GAME_MODULES.find((game) => game.id === id)
}

export function getPublicGames(): SpectatorGameModule[] {
  return GAME_MODULES.filter((game) => game.visibility === 'public')
}

export function getStudioGames(): SpectatorGameModule[] {
  return GAME_MODULES
}

export function isStudioOnlyGameId(id: string): boolean {
  const game = getGameById(id)
  return game?.visibility === 'studio'
}

export function isKnownGameId(id: string): boolean {
  return GAME_MODULES.some((game) => game.id === id)
}
