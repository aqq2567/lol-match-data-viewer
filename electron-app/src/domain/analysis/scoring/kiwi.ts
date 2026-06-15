/**
 * 评分领域 — 海克斯大乱斗（KIWI）评分函数
 *
 * 模式特征：嚎哭深渊单线、无视野/补刀/防御塔、海克斯增幅、持续团战
 * gameMode=KIWI，gameType 不限（MATCHED_GAME / CUSTOM_GAME 共享）
 *
 * TODO: 待定维度与权重
 */

import type { ModeScorer } from './types'

export const kiwiScorer: ModeScorer = (_input) => {
  // TODO: 实现 KIWI 模式评分算法
  return {
    total: 0,
    win: _input.player.stats.win,
    breakdown: {},
  }
}
