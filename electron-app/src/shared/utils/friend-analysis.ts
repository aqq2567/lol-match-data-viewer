/**
 * 好友分析 —— 纯函数算法
 * 接受任意 puuid 作为分析主体，不硬编码"当前用户"
 */
import type { GameSummary, ParticipantBrief } from '@shared/types/app'

/** 收集者 item ID */
const COLLECTOR_ID = 6676
/** 心之钢 item ID */
const HEARTSTEEL_ID = 3084

export interface FriendStats {
  puuid: string
  name: string
  profileIconId: number
  gamesTogether: number
  winsTogether: number
  winRate: number
  soloWinRate: number
  lastPlayedTime: number
  gameIds: number[]
  /** 装备中包含收集者的场次 */
  collectorGames: number
  /** 装备中包含心之钢的场次 */
  heartsteelGames: number
}

/** 从 GameSummary 列表中分析所有队友频次与胜率 */
export function analyzeFriends(games: GameSummary[], targetPuuid: string): FriendStats[] {
  const map = new Map<string, FriendStats>()

  // 仅统计有效对局
  const validGames = games.filter(g => g.gameMode !== 'PRACTICETOOL')
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
          name: friendDisplayName(p),
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

  const result = Array.from(map.values())
    .filter(f => f.gamesTogether >= 3)
    .sort((a, b) => b.gamesTogether - a.gamesTogether)

  const gamesMissingTeammates = validGames.filter(g => {
    const t = g.teamId === 100 ? g.blueParticipants : g.redParticipants
    return t.length <= 1
  }).length

  console.log(
    `[FRIEND] analyzeFriends: ${validGames.length} 有效对局 → ${map.size} 个不同队友 → ${result.length} 个达标(≥3场)` +
    (gamesMissingTeammates > 0 ? ` ⚠️ ${gamesMissingTeammates} 场队友数据不完整` : '')
  )

  return result
}

function friendDisplayName(p: ParticipantBrief): string {
  if (p.gameName) {
    return p.tagLine ? `${p.gameName}#${p.tagLine}` : p.gameName
  }
  return p.summonerName || '?'
}

export interface FriendSummary {
  totalFriends: number
  mostPlayed: { name: string; count: number } | null
  bestWinRate: { name: string; rate: number } | null
  totalGames: number
  bestCollector: { name: string; ratio: number; games: number } | null
  bestHeartsteel: { name: string; ratio: number; games: number } | null
}

export function computeFriendSummary(friends: FriendStats[], totalGames: number): FriendSummary {
  if (friends.length === 0) {
    return { totalFriends: 0, mostPlayed: null, bestWinRate: null, totalGames, bestCollector: null, bestHeartsteel: null }
  }

  const mostPlayed = friends[0]
  const bestWR = friends.reduce((best, f) =>
    f.winRate > best.winRate && f.gamesTogether >= 5 ? f : best
  , friends[0])

  const bestCollector = friends
    .filter(f => f.collectorGames > 0 && f.gamesTogether >= 3)
    .reduce((best, f) => f.collectorGames / f.gamesTogether > best.collectorGames / best.gamesTogether ? f : best
    , friends.filter(f => f.collectorGames > 0 && f.gamesTogether >= 3)[0] || null)

  const bestHeartsteel = friends
    .filter(f => f.heartsteelGames > 0 && f.gamesTogether >= 3)
    .reduce((best, f) => f.heartsteelGames / f.gamesTogether > best.heartsteelGames / best.gamesTogether ? f : best
    , friends.filter(f => f.heartsteelGames > 0 && f.gamesTogether >= 3)[0] || null)

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
