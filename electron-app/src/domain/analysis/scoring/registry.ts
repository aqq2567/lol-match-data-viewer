/**
 * 评分领域 — 模式注册表
 * 将 gameMode 映射到对应的评分函数
 */

import type { ModeScorer, PlayerScore, ScoringInput } from './types'
import { kiwiScorer } from './kiwi'

const registry = new Map<string, ModeScorer>()

/** 注册模式评分函数 */
export function registerScorer(gameMode: string, scorer: ModeScorer): void {
  registry.set(gameMode.toUpperCase(), scorer)
}

// ═══════════════════════════════════════════════════════════
// 启动时自动注册已实现的模式
// ═══════════════════════════════════════════════════════════

registerScorer('KIWI', kiwiScorer)

// ═══════════════════════════════════════════════════════════
// 对外接口
// ═══════════════════════════════════════════════════════════

/** 根据对局模式获取评分函数，未注册模式返回 null */
export function getScorer(gameMode: string): ModeScorer | null {
  return registry.get(gameMode.toUpperCase()) ?? null
}

/** 便捷方法：对一名玩家评分，未注册模式抛错 */
export function scorePlayer(input: ScoringInput): PlayerScore {
  const scorer = getScorer(input.game.game_mode)
  if (!scorer) {
    throw new Error(`未注册的评分模式: ${input.game.game_mode}`)
  }
  return scorer(input)
}
