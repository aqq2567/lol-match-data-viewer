/**
 * 评分领域 — 公共 API
 */

export type { PlayerScore, ScoringInput, ModeScorer } from './types'
export { registerScorer, getScorer, scorePlayer } from './registry'

import type { PlayerScore } from './types'
import type { GameRecord } from '@shared/types'
import { scorePlayer } from './registry'

/**
 * 对一局中的所有玩家评分，返回按 total 降序排列的结果
 */
export function scoreAllPlayers(game: GameRecord): PlayerScore[] {
  const context = {
    game_mode: game.game_mode,
    game_type: game.game_type,
    game_duration_min: game.game_duration_min,
  }

  const results: PlayerScore[] = []

  for (const p of game.blue_team.players) {
    results.push(
      scorePlayer({ player: p, team: game.blue_team.players, enemy: game.red_team.players, game: context }),
    )
  }
  for (const p of game.red_team.players) {
    results.push(
      scorePlayer({ player: p, team: game.red_team.players, enemy: game.blue_team.players, game: context }),
    )
  }

  return results.sort((a, b) => b.total - a.total)
}
