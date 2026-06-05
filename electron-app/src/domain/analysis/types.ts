/**
 * 分析领域类型定义
 * 这些类型原本散落在各 Vue 组件的 <script> 中，统一提取到领域层
 */

// ═══════════════════════════════════════════════════════════
// 领奖台 & 玩家聚合
// ═══════════════════════════════════════════════════════════

/** 领奖台单条数据（TOP N 展示） */
export interface PodiumEntry {
  playerName: string
  profileIconId: number
  totalValue: number
  displayValue: string
  gameCount: number
  winCount: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  avgKda: string
}

/** 玩家全维度聚合（击杀/死亡/助攻/胜场） */
export interface PlayerFullAgg {
  profileIconId: number
  gameCount: number
  winCount: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
}

// ═══════════════════════════════════════════════════════════
// 指标排名
// ═══════════════════════════════════════════════════════════

/** 指标排名条目（基础指标 + 高阶指标共用） */
export interface MetricRankEntry {
  playerName: string
  profileIconId: number
  total: number
  average: number
  gameCount: number
  winCount: number
  winRate: number
  /** 高阶指标原始数据（可选） */
  raw?: { label: string; value: number }[]
}

// ═══════════════════════════════════════════════════════════
// 英雄维度
// ═══════════════════════════════════════════════════════════

/** 全局英雄选取频率 */
export interface GlobalChampFreq {
  championId: number
  count: number
  name: string
}

/** 玩家英雄池 */
export interface PlayerChampionPool {
  playerName: string
  profileIconId: number
  uniqueChampions: number
  mostPlayedChampionId: number
  mostPlayedChampionCount: number
  favChampWins: number
  totalGames: number
  winCount: number
}

// ═══════════════════════════════════════════════════════════
// 装备维度
// ═══════════════════════════════════════════════════════════

/** 全局装备频率 */
export interface GlobalItemFreq {
  itemId: number
  count: number
  name: string
  iconPath: string
}

/** 玩家最爱装备 */
export interface PlayerFavItem {
  playerName: string
  profileIconId: number
  itemId: number
  itemName: string
  iconPath: string
  count: number
  totalGames: number
}

// ═══════════════════════════════════════════════════════════
// 增幅维度（斗魂竞技场 / 海克斯大乱斗）
// ═══════════════════════════════════════════════════════════

/** 全局增幅频率 */
export interface GlobalAugmentFreq {
  id: number
  count: number
  name: string
  iconPath: string
  rarity: string
}

/** 玩家最爱增幅 */
export interface PlayerFavAug {
  playerName: string
  profileIconId: number
  augmentId: number
  augmentName: string
  iconPath: string
  rarity: string
  count: number
  totalGames: number
}

// ═══════════════════════════════════════════════════════════
// 好友分析
// ═══════════════════════════════════════════════════════════

/** 好友指标定义（与 MetricDef 不同，增加了 minGames 门槛） */
export interface FriendMetricDef {
  key: string
  label: string
  colorClass: string
  getter: (f: import('@shared/utils/friend-analysis').FriendStats) => number
  fmt: (v: number) => string
  /** 该指标要求的最低一起场次（胜率类指标需更多样本） */
  minGames: number
}

/** 好友领奖台 TOP 3 */
export interface FriendPodiumEntry {
  name: string
  profileIconId: number
  totalValue: number
  displayValue: string
  gamesTogether: number
  winRate: number
  soloWinRate: number
  collectorGames: number
  heartsteelGames: number
}
