/**
 * 分析领域 — 高阶指标计算
 * 角色率（6 种）+ 伤害比（5 种），纯计算，可直接单元测试
 */

import type { GameRecord } from '@shared/types'
import type { MetricRankEntry } from '@domain/analysis/types'

/** 角色率指标 key → 角色标签 */
const ROLE_RATE_KEYS = new Set([
  'fighterRate', 'tankRate', 'mageRate',
  'assassinRate', 'marksmanRate', 'supportRate',
])

const ROLE_TAG: Record<string, string> = {
  fighterRate: 'Fighter', tankRate: 'Tank', mageRate: 'Mage',
  assassinRate: 'Assassin', marksmanRate: 'Marksman', supportRate: 'Support',
}

/** 伤害比指标 key 集合 */
const DMG_RATIO_KEYS = new Set([
  'dmgPerGold', 'dmgPerKill', 'dmgPerDeath', 'dmgShare', 'dmgTakenShare',
])

/**
 * 按高阶指标 key 计算玩家排名
 * @param championRoles 根据 championId 返回角色标签列表（如 ['Fighter', 'Tank']）
 */
export function computeAdvancedMetricRanking(
  games: GameRecord[],
  key: string,
  championRoles: (championId: number) => string[],
  getRoleName: (tag: string) => string,
): MetricRankEntry[] {
  if (ROLE_RATE_KEYS.has(key)) {
    return computeRoleRateRanking(games, key, championRoles, getRoleName)
  }
  if (DMG_RATIO_KEYS.has(key)) {
    return computeDamageRatioRanking(games, key)
  }
  return []
}

// ═══════════════════════════════════════════════════════════
// 角色率
// ═══════════════════════════════════════════════════════════

function computeRoleRateRanking(
  games: GameRecord[],
  key: string,
  championRoles: (championId: number) => string[],
  getRoleName: (tag: string) => string,
): MetricRankEntry[] {
  const targetTag = ROLE_TAG[key]
  const playerData = new Map<
    string,
    { profileIconId: number; roleCount: number; gameCount: number; winCount: number }
  >()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerData.has(name)) {
        playerData.set(name, {
          profileIconId: p.profile_icon_id,
          roleCount: 0,
          gameCount: 0,
          winCount: 0,
        })
      }
      const d = playerData.get(name)!
      d.gameCount++
      if (p.stats.win) d.winCount++
      const roles = championRoles(p.champion_id)
      if (roles.some(r => r.toLowerCase() === targetTag.toLowerCase())) d.roleCount++
    }
  }

  return Array.from(playerData.entries())
    .map(([name, d]) => ({
      playerName: name,
      profileIconId: d.profileIconId,
      total: d.gameCount > 0 ? d.roleCount / d.gameCount : 0,
      average: d.gameCount > 0 ? d.roleCount / d.gameCount : 0,
      gameCount: d.gameCount,
      winCount: d.winCount,
      winRate: d.gameCount > 0 ? (d.winCount / d.gameCount) * 100 : 0,
      raw: [
        { label: getRoleName(targetTag) + '局数', value: d.roleCount },
        { label: '总局数', value: d.gameCount },
      ],
    }))
    .sort((a, b) => b.total - a.total)
}

// ═══════════════════════════════════════════════════════════
// 伤害比
// ═══════════════════════════════════════════════════════════

interface DamageAgg {
  totalDmg: number
  totalGold: number
  totalKills: number
  totalDeaths: number
  totalTeamDmg: number
  totalDmgTaken: number
  totalTeamDmgTaken: number
  profileIconId: number
  gameCount: number
  winCount: number
}

function computeDamageRatioRanking(
  games: GameRecord[],
  key: string,
): MetricRankEntry[] {
  const playerData = new Map<string, DamageAgg>()

  for (const g of games) {
    const blueDmg = g.blue_team.players.reduce(
      (s, p) => s + p.stats.damage.total_to_champs, 0,
    )
    const redDmg = g.red_team.players.reduce(
      (s, p) => s + p.stats.damage.total_to_champs, 0,
    )
    const blueTaken = g.blue_team.players.reduce(
      (s, p) => s + p.stats.damage.total_taken, 0,
    )
    const redTaken = g.red_team.players.reduce(
      (s, p) => s + p.stats.damage.total_taken, 0,
    )

    for (const p of g.blue_team.players) {
      const d = ensureEntry(playerData, p.summoner_name, p.profile_icon_id)
      d.totalDmg += p.stats.damage.total_to_champs
      d.totalGold += p.stats.economy.gold_earned
      d.totalKills += p.stats.kills
      d.totalDeaths += p.stats.deaths
      d.totalTeamDmg += blueDmg
      d.totalDmgTaken += p.stats.damage.total_taken
      d.totalTeamDmgTaken += blueTaken
      d.gameCount++
      if (p.stats.win) d.winCount++
    }
    for (const p of g.red_team.players) {
      const d = ensureEntry(playerData, p.summoner_name, p.profile_icon_id)
      d.totalDmg += p.stats.damage.total_to_champs
      d.totalGold += p.stats.economy.gold_earned
      d.totalKills += p.stats.kills
      d.totalDeaths += p.stats.deaths
      d.totalTeamDmg += redDmg
      d.totalDmgTaken += p.stats.damage.total_taken
      d.totalTeamDmgTaken += redTaken
      d.gameCount++
      if (p.stats.win) d.winCount++
    }
  }

  return Array.from(playerData.entries())
    .map(([name, d]) => {
      const { ratio, raw } = computeRatio(key, d)
      return {
        playerName: name,
        profileIconId: d.profileIconId,
        total: ratio,
        average: ratio,
        gameCount: d.gameCount,
        winCount: d.winCount,
        winRate: (d.winCount / d.gameCount) * 100,
        raw,
      }
    })
    .sort((a, b) => b.total - a.total)
}

function ensureEntry(
  map: Map<string, DamageAgg>,
  name: string,
  profileIconId: number,
): DamageAgg {
  if (!map.has(name)) {
    map.set(name, {
      totalDmg: 0, totalGold: 0, totalKills: 0, totalDeaths: 0,
      totalTeamDmg: 0, totalDmgTaken: 0, totalTeamDmgTaken: 0,
      profileIconId, gameCount: 0, winCount: 0,
    })
  }
  return map.get(name)!
}

function computeRatio(
  key: string,
  d: DamageAgg,
): { ratio: number; raw: { label: string; value: number }[] } {
  switch (key) {
    case 'dmgPerGold':
      return {
        ratio: d.totalGold > 0 ? d.totalDmg / d.totalGold : 0,
        raw: [
          { label: '总伤害', value: d.totalDmg },
          { label: '总经济', value: d.totalGold },
        ],
      }
    case 'dmgPerKill':
      return {
        ratio: d.totalKills > 0 ? d.totalDmg / d.totalKills : 0,
        raw: [
          { label: '总伤害', value: d.totalDmg },
          { label: '总击杀', value: d.totalKills },
        ],
      }
    case 'dmgPerDeath':
      return {
        ratio: d.totalDeaths > 0 ? d.totalDmg / d.totalDeaths : 0,
        raw: [
          { label: '总伤害', value: d.totalDmg },
          { label: '总死亡', value: d.totalDeaths },
        ],
      }
    case 'dmgShare':
      return {
        ratio: d.totalTeamDmg > 0 ? d.totalDmg / d.totalTeamDmg : 0,
        raw: [
          { label: '个人总伤害', value: d.totalDmg },
          { label: '队伍总伤害', value: d.totalTeamDmg },
        ],
      }
    case 'dmgTakenShare':
      return {
        ratio: d.totalTeamDmgTaken > 0 ? d.totalDmgTaken / d.totalTeamDmgTaken : 0,
        raw: [
          { label: '个人总承伤', value: d.totalDmgTaken },
          { label: '队伍总承伤', value: d.totalTeamDmgTaken },
        ],
      }
    default:
      return { ratio: 0, raw: [] }
  }
}
