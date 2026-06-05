/**
 * 分析领域 — 聚合函数
 * 纯计算，不依赖 Vue/Electron，可直接单元测试
 */

import type { GameRecord, PlayerAnalysis, PlayerStats } from '@shared/types'
import type { MetricRankEntry, PlayerFullAgg, PodiumEntry } from '@domain/analysis/types'

/** 按玩家聚合对局基本数据（击杀/死亡/助攻/胜场） */
export function buildPlayerAggMap(games: GameRecord[]): Map<string, PlayerFullAgg> {
  const map = new Map<string, PlayerFullAgg>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!map.has(name)) {
        map.set(name, {
          profileIconId: p.profile_icon_id,
          gameCount: 0,
          winCount: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
        })
      }
      const agg = map.get(name)!
      agg.gameCount++
      if (p.stats.win) agg.winCount++
      agg.totalKills += p.stats.kills
      agg.totalDeaths += p.stats.deaths
      agg.totalAssists += p.stats.assists
    }
  }
  return map
}

/** 按指标 getter 计算玩家排名（总计降序） */
export function computeMetricRanking(
  games: GameRecord[],
  getter: (stats: PlayerStats) => number,
): MetricRankEntry[] {
  const playerMap = new Map<
    string,
    { total: number; count: number; profileIconId: number; winCount: number }
  >()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = getter(p.stats)
      if (!playerMap.has(name)) {
        playerMap.set(name, {
          total: 0,
          count: 0,
          profileIconId: p.profile_icon_id,
          winCount: 0,
        })
      }
      const entry = playerMap.get(name)!
      entry.total += val
      entry.count++
      if (p.stats.win) entry.winCount++
    }
  }

  return Array.from(playerMap.entries())
    .map(([name, e]) => ({
      playerName: name,
      profileIconId: e.profileIconId,
      total: e.total,
      average: e.total / e.count,
      gameCount: e.count,
      winCount: e.winCount,
      winRate: (e.winCount / e.count) * 100,
    }))
    .sort((a, b) => b.total - a.total)
}

/** 计算领奖台 TOP 3 */
export function computePodium(
  games: GameRecord[],
  aggMap: Map<string, PlayerFullAgg>,
  getter: (stats: PlayerStats) => number,
  fmt: (v: number) => string,
): PodiumEntry[] {
  const playerAgg = new Map<string, { total: number; count: number }>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = getter(p.stats)
      if (!playerAgg.has(name)) {
        playerAgg.set(name, { total: 0, count: 0 })
      }
      const entry = playerAgg.get(name)!
      entry.total += val
      entry.count++
    }
  }

  return Array.from(playerAgg.entries())
    .map(([name, agg]) => {
      const full = aggMap.get(name)!
      const kda =
        full.totalDeaths > 0
          ? ((full.totalKills + full.totalAssists) / full.totalDeaths).toFixed(2)
          : (full.totalKills + full.totalAssists).toFixed(1)
      return {
        playerName: name,
        profileIconId: full.profileIconId,
        totalValue: agg.total,
        displayValue: fmt(agg.total),
        gameCount: full.gameCount,
        winCount: full.winCount,
        totalKills: full.totalKills,
        totalDeaths: full.totalDeaths,
        totalAssists: full.totalAssists,
        avgKda: kda,
      }
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 3)
}

/** 计算某一统计量的全队最大值 */
export function findBestStat<T extends { stats: PlayerStats }>(
  players: T[],
  getter: (stats: PlayerStats) => number,
): number {
  if (players.length === 0) return 0
  return Math.max(...players.map((p) => getter(p.stats)))
}

/** 找出统计量最高的玩家（若最大值 ≤ 0 返回 null） */
export function findBestPlayer<T extends { stats: PlayerStats }>(
  players: T[],
  getter: (stats: PlayerStats) => number,
): T | null {
  if (players.length === 0) return null
  let best: T = players[0]
  let max = -Infinity
  for (const p of players) {
    const v = getter(p.stats)
    if (v > max) {
      max = v
      best = p
    }
  }
  return max > 0 ? best : null
}

/** 计算领奖台条目的胜率百分比 */
export function computePodiumWinRate(e: PodiumEntry): string {
  return e.gameCount > 0 ? ((e.winCount / e.gameCount) * 100).toFixed(0) : '0'
}

/** 从对局列表计算玩家分析（按 puuid 聚合，计算平均值） */
export function computePlayerAnalysis(games: GameRecord[]): PlayerAnalysis[] {
  const playerMap = new Map<
    string,
    { puuid: string; summonerName: string; statsList: PlayerStats[]; wins: number }
  >()

  for (const game of games) {
    for (const p of [...game.blue_team.players, ...game.red_team.players]) {
      const key = p.puuid || p.summoner_name
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          puuid: key,
          summonerName: p.summoner_name,
          statsList: [],
          wins: 0,
        })
      }
      const entry = playerMap.get(key)!
      entry.statsList.push(p.stats)
      if (p.stats.win) entry.wins++
    }
  }

  return Array.from(playerMap.values())
    .map((e) => {
      const n = e.statsList.length
      const avg = (getter: (s: PlayerStats) => number) =>
        e.statsList.reduce((sum, s) => sum + getter(s), 0) / n

      return {
        puuid: e.puuid,
        summonerName: e.summonerName,
        gameCount: n,
        winCount: e.wins,
        loseCount: n - e.wins,
        winRate: (e.wins / n) * 100,
        avgKills: avg((s) => s.kills),
        avgDeaths: avg((s) => s.deaths),
        avgAssists: avg((s) => s.assists),
        avgKda: avg((s) => (s.kills + s.assists) / Math.max(s.deaths, 1)),
        avgDamageDealt: avg((s) => s.damage.total_to_champs),
        avgDamageTaken: avg((s) => s.damage.total_taken),
        avgTotalHeal: avg((s) => s.survival.total_heal),
        avgCs: avg((s) => s.cs.total),
        avgGold: avg((s) => s.economy.gold_earned),
        avgVisionScore: avg((s) => s.vision.score),
        avgCcTime: avg((s) => s.cc.total_cc_dealt),
      }
    })
    .sort((a, b) => b.gameCount - a.gameCount)
}
