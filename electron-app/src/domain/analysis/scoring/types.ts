/**
 * 评分领域类型定义
 * 各模式评分函数统一接口，纯计算，零外部依赖
 */

import type { PlayerData, GameRecord } from '@shared/types'

/** 单个玩家的评分结果 */
export interface PlayerScore {
  /** 最终评分（各模式自行决定量纲和范围） */
  total: number
  /** 该玩家所属队伍是否获胜 */
  win: boolean
  /** 各模式自定义的评分明细（后续 MVP 展示用） */
  breakdown: Record<string, number>
}

/** 单局评分输入 */
export interface ScoringInput {
  player: PlayerData
  /** 同队所有玩家（含自己） */
  team: PlayerData[]
  /** 对方队伍所有玩家 */
  enemy: PlayerData[]
  /** 对局上下文 */
  game: Pick<GameRecord, 'game_mode' | 'game_type' | 'game_duration_min'>
}

/**
 * 模式评分函数签名
 * 各模式自行定义维度、权重、归一化方式和分数范围
 */
export type ModeScorer = (input: ScoringInput) => PlayerScore
