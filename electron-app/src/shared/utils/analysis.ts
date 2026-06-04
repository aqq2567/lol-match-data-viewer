/**
 * 数据分析层 —— 纯函数算法
 * 不依赖 DOM / Electron / Vue，仅接收数据输入返回计算结果
 * 主进程和渲染进程均可使用
 */
import type { GameSummary, TeamStats, ParticipantBrief } from '@shared/types/app'

// ═══════════════════════════════════════════════════════════
// 综合统计
// ═══════════════════════════════════════════════════════════

/** 计算平均 KDA */
export function computeAvgKda(games: Pick<GameSummary, 'kdaRatio'>[]): string {
  if (games.length === 0) return '-'
  const sum = games.reduce((s, g) => s + g.kdaRatio, 0)
  return (sum / games.length).toFixed(2)
}

/** 计算胜率 */
export function computeWinRate(games: Pick<GameSummary, 'win' | 'gameMode'>[]): {
  wins: number
  losses: number
  ratePercent: string
} {
  const wins = games.filter(g => g.win).length
  const losses = games.filter(g => !g.win && g.gameMode !== 'PRACTICETOOL').length
  const total = wins + losses
  return {
    wins,
    losses,
    ratePercent: total === 0 ? '0' : ((wins / total) * 100).toFixed(0),
  }
}

// ═══════════════════════════════════════════════════════════
// 英雄频次分析
// ═══════════════════════════════════════════════════════════

export interface ChampionFreq {
  championId: number
  count: number
}

/** 计算常用英雄（按 championId 频次降序，取 topN） */
export function computeFrequentChampions(
  games: Pick<GameSummary, 'championId'>[],
  topN: number = 5
): ChampionFreq[] {
  const map: Record<number, number> = {}
  for (const g of games) {
    map[g.championId] = (map[g.championId] || 0) + 1
  }
  return Object.entries(map)
    .map(([id, count]) => ({ championId: Number(id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

// ═══════════════════════════════════════════════════════════
// 玩家关系分析（队友 / 对手）
// ═══════════════════════════════════════════════════════════

export interface PlayerFreq {
  puuid: string
  gameName: string
  summonerName: string
  profileIconId: number
  count: number
}

/** 计算近期队友 / 对手频次（仅返回出现 ≥ minCount 次的玩家，取 topN） */
export function computeFrequentPlayers(
  games: GameSummary[],
  selfPuuid: string,
  role: 'teammate' | 'opponent',
  minCount: number = 2,
  topN: number = 5
): PlayerFreq[] {
  const map = new Map<string, PlayerFreq>()

  for (const g of games) {
    const selfTeam = g.blueParticipants.some(p => p.puuid === selfPuuid)
      ? g.blueParticipants
      : g.redParticipants

    const targetList: ParticipantBrief[] =
      role === 'teammate'
        ? selfTeam.filter(p => p.puuid !== selfPuuid)
        : (selfTeam === g.blueParticipants ? g.redParticipants : g.blueParticipants)

    for (const p of targetList) {
      if (p.puuid === selfPuuid) continue
      const existing = map.get(p.puuid)
      if (existing) {
        existing.count++
      } else {
        map.set(p.puuid, {
          puuid: p.puuid,
          gameName: p.gameName,
          summonerName: p.summonerName,
          profileIconId: p.profileIconId,
          count: 1,
        })
      }
    }
  }

  return Array.from(map.values())
    .filter(f => f.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

// ═══════════════════════════════════════════════════════════
// 队伍数据计算（击杀参与率、伤害/承伤/经济占比）
// ═══════════════════════════════════════════════════════════

interface RawParticipant {
  teamId: number
  stats: {
    kills: number
    totalDamageDealtToChampions: number
    totalDamageTaken: number
    goldEarned: number
    [key: string]: any
  }
}

/** 计算队伍统计数据 */
export function computeTeamStats(
  participants: RawParticipant[],
  selfTeamId: number,
  selfStats: { kills: number; assists: number; totalDamageDealtToChampions: number; totalDamageTaken: number; goldEarned: number }
): TeamStats {
  const teamPlayers = participants.filter(p => p.teamId === selfTeamId)

  let teamKills = 0
  let teamDamage = 0
  let teamDamageTaken = 0
  let teamGold = 0
  let highestDamage = 0
  let highestDamageTaken = 0

  for (const p of teamPlayers) {
    const s = p.stats || {}
    teamKills += s.kills || 0
    const dmg = s.totalDamageDealtToChampions || 0
    const taken = s.totalDamageTaken || 0
    const gold = s.goldEarned || 0
    teamDamage += dmg
    teamDamageTaken += taken
    teamGold += gold
    if (dmg > highestDamage) highestDamage = dmg
    if (taken > highestDamageTaken) highestDamageTaken = taken
  }

  const playerDamage = selfStats.totalDamageDealtToChampions || 0
  const playerDamageTaken = selfStats.totalDamageTaken || 0
  const playerGold = selfStats.goldEarned || 0
  const killsPlusAssists = (selfStats.kills || 0) + (selfStats.assists || 0)

  return {
    killParticipation: teamKills > 0 ? Math.round(killsPlusAssists / teamKills * 100) : 0,
    damageShare: teamDamage > 0 ? Math.round(playerDamage / teamDamage * 100) : 0,
    damageTakenShare: teamDamageTaken > 0 ? Math.round(playerDamageTaken / teamDamageTaken * 100) : 0,
    goldShare: teamGold > 0 ? Math.round(playerGold / teamGold * 100) : 0,
    isHighestDamage: playerDamage > 0 && playerDamage === highestDamage,
    isHighestDamageTaken: playerDamageTaken > 0 && playerDamageTaken === highestDamageTaken,
  }
}

// ═══════════════════════════════════════════════════════════
// 分页辅助
// ═══════════════════════════════════════════════════════════

/** 计算总场次的展示文本 */
export function formatTotalGamesDisplay(
  totalGames: number,
  gamesLength: number,
  currentPage: number,
  pageSize: number
): string {
  if (totalGames > 0 && totalGames > gamesLength) {
    return `${totalGames} 场`
  }
  if (gamesLength < pageSize) {
    return `${(currentPage - 1) * pageSize + gamesLength} 场`
  }
  return `${(currentPage - 1) * pageSize + gamesLength}+ 场`
}
