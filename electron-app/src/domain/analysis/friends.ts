/**
 * 分析领域 — 好友分析
 * 纯计算，不依赖 Vue/Electron，可直接单元测试
 */

import type { GameSummary, ParticipantBrief } from '@shared/types'
import type { FriendMetricDef, FriendPodiumEntry, FriendStats, FriendSummary } from '@domain/analysis/types'

// ═══════════════════════════════════════════════════════════
// 核心分析函数
// ═══════════════════════════════════════════════════════════

const COLLECTOR_ID = 6676
const HEARTSTEEL_ID = 3084

/** 从 GameSummary 列表中分析所有队友频次与胜率 */
export function analyzeFriends(
  games: GameSummary[],
  targetPuuid: string,
  getDisplayName: (p: ParticipantBrief) => string,
): FriendStats[] {
  const map = new Map<string, FriendStats>()

  const validGames = games.filter((g) => g.gameMode !== 'PRACTICETOOL')
  if (validGames.length === 0) return []

  let totalWins = 0

  for (const g of validGames) {
    if (g.win) totalWins++

    const teammates =
      g.teamId === 100 ? g.blueParticipants : g.redParticipants

    for (const p of teammates) {
      if (p.puuid === targetPuuid) continue

      const hasCollector = p.items.includes(COLLECTOR_ID)
      const hasHeartsteel = p.items.includes(HEARTSTEEL_ID)

      const existing = map.get(p.puuid)
      if (existing) {
        existing.gamesTogether++
        if (g.win) existing.winsTogether++
        if (hasCollector) existing.collectorGames++
        if (hasHeartsteel) existing.heartsteelGames++
        if (g.gameCreation > existing.lastPlayedTime) {
          existing.lastPlayedTime = g.gameCreation
        }
        existing.gameIds.push(g.gameId)
      } else {
        map.set(p.puuid, {
          puuid: p.puuid,
          name: getDisplayName(p),
          profileIconId: p.profileIconId,
          gamesTogether: 1,
          winsTogether: g.win ? 1 : 0,
          winRate: 0,
          soloWinRate: 0,
          lastPlayedTime: g.gameCreation,
          gameIds: [g.gameId],
          collectorGames: hasCollector ? 1 : 0,
          heartsteelGames: hasHeartsteel ? 1 : 0,
        })
      }
    }
  }

  const totalGames = validGames.length

  for (const f of map.values()) {
    f.winRate = f.gamesTogether > 0 ? f.winsTogether / f.gamesTogether : 0
    const soloTotal = totalGames - f.gamesTogether
    const soloWins = totalWins - f.winsTogether
    f.soloWinRate = soloTotal > 0 ? soloWins / soloTotal : 0
  }

  return Array.from(map.values())
    .filter((f) => f.gamesTogether >= 3)
    .sort((a, b) => b.gamesTogether - a.gamesTogether)
}

/** 从好友统计数据中计算概览摘要 */
export function computeFriendSummary(friends: FriendStats[], totalGames: number): FriendSummary {
  if (friends.length === 0) {
    return { totalFriends: 0, mostPlayed: null, bestWinRate: null, totalGames, bestCollector: null, bestHeartsteel: null }
  }

  const mostPlayed = friends[0]
  const bestWR = friends.reduce((best, f) =>
    f.winRate > best.winRate && f.gamesTogether >= 5 ? f : best,
  friends[0])

  const bestCollector = friends
    .filter((f) => f.collectorGames > 0 && f.gamesTogether >= 3)
    .reduce((best, f) => f.collectorGames / f.gamesTogether > best.collectorGames / best.gamesTogether ? f : best,
    friends.filter((f) => f.collectorGames > 0 && f.gamesTogether >= 3)[0] || null)

  const bestHeartsteel = friends
    .filter((f) => f.heartsteelGames > 0 && f.gamesTogether >= 3)
    .reduce((best, f) => f.heartsteelGames / f.gamesTogether > best.heartsteelGames / best.gamesTogether ? f : best,
    friends.filter((f) => f.heartsteelGames > 0 && f.gamesTogether >= 3)[0] || null)

  return {
    totalFriends: friends.length,
    mostPlayed: { name: mostPlayed.name, count: mostPlayed.gamesTogether },
    bestWinRate: bestWR.winRate > 0
      ? { name: bestWR.name, rate: bestWR.winRate }
      : null,
    totalGames,
    bestCollector: bestCollector
      ? { name: bestCollector.name, ratio: bestCollector.collectorGames / bestCollector.gamesTogether, games: bestCollector.collectorGames }
      : null,
    bestHeartsteel: bestHeartsteel
      ? { name: bestHeartsteel.name, ratio: bestHeartsteel.heartsteelGames / bestHeartsteel.gamesTogether, games: bestHeartsteel.heartsteelGames }
      : null,
  }
}

// ═══════════════════════════════════════════════════════════
// 展示层辅助（排序、领奖台、称号）
// ═══════════════════════════════════════════════════════════

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
