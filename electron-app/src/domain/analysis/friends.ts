/**
 * 分析领域 — 好友分析
 * 纯计算，不依赖 Vue/Electron，可直接单元测试
 */

import type { FriendStats } from '@shared/utils/friend-analysis'
import type { FriendMetricDef, FriendPodiumEntry } from '@domain/analysis/types'

/** 好友指标定义 */
export const FRIEND_METRICS: FriendMetricDef[] = [
  {
    key: 'gamesTogether',
    label: '一起场次',
    colorClass: 'cat-blue',
    getter: (f) => f.gamesTogether,
    fmt: (v) => String(Math.round(v)),
    minGames: 3,
  },
  {
    key: 'winRate',
    label: '一起时胜率',
    colorClass: 'cat-green',
    getter: (f) => f.winRate,
    fmt: (v) => (v * 100).toFixed(0) + '%',
    minGames: 5,
  },
  {
    key: 'winDelta',
    label: '胜率提升',
    colorClass: 'cat-purple',
    getter: (f) => f.winRate - f.soloWinRate,
    fmt: (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%',
    minGames: 5,
  },
  {
    key: 'collectorRatio',
    label: '收集者率',
    colorClass: 'cat-red',
    getter: (f) => f.gamesTogether > 0 ? f.collectorGames / f.gamesTogether : 0,
    fmt: (v) => (v * 100).toFixed(0) + '%',
    minGames: 3,
  },
  {
    key: 'heartsteelRatio',
    label: '心之钢率',
    colorClass: 'cat-orange',
    getter: (f) => f.gamesTogether > 0 ? f.heartsteelGames / f.gamesTogether : 0,
    fmt: (v) => (v * 100).toFixed(0) + '%',
    minGames: 3,
  },
]

/** 按选中指标降序排列，并应用最低场次门槛 */
export function computeSortedByMetric(
  friends: FriendStats[],
  cat: FriendMetricDef | null,
): FriendStats[] {
  if (!cat) return [...friends]
  return [...friends]
    .filter((f) => f.gamesTogether >= cat.minGames)
    .sort((a, b) => cat.getter(b) - cat.getter(a))
}

/** 好友领奖台 TOP 3 */
export function computeFriendPodium(
  sorted: FriendStats[],
  cat: FriendMetricDef,
): FriendPodiumEntry[] {
  return sorted.slice(0, 3).map((f) => ({
    name: f.name,
    profileIconId: f.profileIconId,
    totalValue: cat.getter(f),
    displayValue: cat.fmt(cat.getter(f)),
    gamesTogether: f.gamesTogether,
    winRate: f.winRate,
    soloWinRate: f.soloWinRate,
    collectorGames: f.collectorGames,
    heartsteelGames: f.heartsteelGames,
  }))
}

/** 榜首称号映射 */
const FIRST_PLACE_TITLES: Record<string, string> = {
  gamesTogether: '最佳拍档',
  winRate: '天选搭档',
  winDelta: '团队催化剂',
  collectorRatio: '最爱收集者之人',
  heartsteelRatio: '最爱心之钢之人',
}

export function getFirstPlaceTitle(key: string | null): string {
  return key ? (FIRST_PLACE_TITLES[key] || '') : ''
}
