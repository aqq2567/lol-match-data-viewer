/**
 * LCU 原始 JSON → 应用层类型的纯数据提取函数
 * 所有函数均为同步、无副作用，接收 raw JSON 返回强类型结果
 */
import type {
  PlayerStats,
  PlayerData,
  TeamData,
  RankedData,
  ChampionMastery,
} from '@shared/types/app'

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

export function safeInt(v: any): number {
  return typeof v === 'number' ? v : 0
}

export function mapById<T extends { id: number }>(arr: T[]): Record<number, T> {
  const map: Record<number, T> = {}
  for (const item of arr) {
    map[item.id] = item
  }
  return map
}

// ═══════════════════════════════════════════════════════════
// 身份 / 统计 / 队伍 / 段位 提取
// ═══════════════════════════════════════════════════════════

export function extractPlayerIdentity(playerInfo: any) {
  const rawName = playerInfo?.summonerName || ''
  const gameName = playerInfo?.gameName || ''
  const tagLine = playerInfo?.tagLine || ''
  return {
    puuid: playerInfo?.puuid || '',
    summoner_name: rawName || (gameName ? `${gameName}#${tagLine}` : ''),
    profile_icon_id: playerInfo?.profileIcon || 0,
    summoner_id: playerInfo?.summonerId || 0,
  }
}

export function extractStatsFull(participant: any): PlayerStats {
  const stats = participant?.stats || {}
  const kills = safeInt(stats.kills)
  const deaths = safeInt(stats.deaths)
  const assists = safeInt(stats.assists)

  return {
    kills,
    deaths,
    assists,
    kda: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    kda_ratio: `${kills}/${deaths}/${assists}`,
    largest_multi_kill: stats.largestMultiKill,
    largest_killing_spree: stats.largestKillingSpree,
    killing_sprees: stats.killingSprees,
    double_kills: stats.doubleKills,
    triple_kills: stats.tripleKills,
    quadra_kills: stats.quadraKills,
    penta_kills: stats.pentaKills,
    unreal_kills: stats.unrealKills,
    damage: {
      total_to_champs: stats.totalDamageDealtToChampions,
      total_dealt: stats.totalDamageDealt,
      total_taken: stats.totalDamageTaken,
      physical_to_champs: stats.physicalDamageDealtToChampions,
      physical_dealt: stats.physicalDamageDealt,
      physical_taken: stats.physicalDamageTaken,
      magic_to_champs: stats.magicDamageDealtToChampions,
      magic_dealt: stats.magicDamageDealt,
      magic_taken: stats.magicalDamageTaken,
      true_to_champs: stats.trueDamageDealtToChampions,
      true_dealt: stats.trueDamageDealt,
      true_taken: stats.trueDamageTaken,
      largest_critical_strike: stats.largestCriticalStrike,
    },
    economy: {
      gold_earned: stats.goldEarned,
      gold_spent: stats.goldSpent,
    },
    cs: {
      total: safeInt(stats.totalMinionsKilled) + safeInt(stats.neutralMinionsKilled),
      minions: stats.totalMinionsKilled,
      neutral_total: stats.neutralMinionsKilled,
      neutral_enemy_jungle: stats.neutralMinionsKilledEnemyJungle,
      neutral_team_jungle: stats.neutralMinionsKilledTeamJungle,
    },
    items: Array.from({ length: 7 }, (_, i) => stats[`item${i}`]),
    runes: {
      primary_style: stats.perkPrimaryStyle,
      sub_style: stats.perkSubStyle,
      perks: Array.from({ length: 6 }, (_, i) => stats[`perk${i}`]),
      perk_vars: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [
          `perk${i}`,
          [stats[`perk${i}Var1`], stats[`perk${i}Var2`], stats[`perk${i}Var3`]],
        ])
      ),
    },
    vision: {
      score: stats.visionScore,
      wards_placed: stats.wardsPlaced,
      wards_killed: stats.wardsKilled,
      sight_wards_bought: stats.sightWardsBoughtInGame,
      vision_wards_bought: stats.visionWardsBoughtInGame,
    },
    objectives: {
      turret_kills: stats.turretKills,
      inhibitor_kills: stats.inhibitorKills,
      damage_to_turrets: stats.damageDealtToTurrets,
      damage_to_objectives: stats.damageDealtToObjectives,
    },
    cc: {
      time_cc_others: stats.timeCCingOthers,
      total_cc_dealt: stats.totalTimeCrowdControlDealt,
    },
    survival: {
      longest_time_living: stats.longestTimeSpentLiving,
      damage_self_mitigated: stats.damageSelfMitigated,
      total_heal: stats.totalHeal,
      total_units_healed: stats.totalUnitsHealed,
    },
    champ_level: stats.champLevel,
    firsts: {
      first_blood_kill: stats.firstBloodKill || false,
      first_blood_assist: stats.firstBloodAssist || false,
      first_tower_kill: stats.firstTowerKill || false,
      first_tower_assist: stats.firstTowerAssist || false,
      first_inhibitor_kill: stats.firstInhibitorKill || false,
      first_inhibitor_assist: stats.firstInhibitorAssist || false,
    },
    summoner_spells: {
      spell1: participant?.spell1Id ?? null,
      spell2: participant?.spell2Id ?? null,
    },
    position: {
      individual_position: stats.individualPosition || '',
      team_position: stats.teamPosition || '',
      lane: stats.lane || '',
    },
    surrender: {
      game_ended_in_surrender: stats.gameEndedInSurrender || false,
      game_ended_in_early_surrender: stats.gameEndedInEarlySurrender || false,
      game_ended_in_ignb_surrender: stats.gameEndedInIGNBSurrender || false,
      team_early_surrendered: stats.teamEarlySurrendered || false,
      caused_early_surrender: stats.causedEarlySurrender || false,
      caused_game_end_from_ignb_surrender: stats.causedGameEndFromIGNBSurrender || false,
      early_surrender_accomplice: stats.earlySurrenderAccomplice || false,
    },
    arena: {
      subteam_placement: stats.subteamPlacement,
      player_subteam_id: stats.playerSubteamId,
      player_augments: Array.from({ length: 6 }, (_, i) => stats[`playerAugment${i + 1}`]),
    },
    scores: {
      combat: stats.combatPlayerScore,
      objective: stats.objectivePlayerScore,
      total: stats.totalPlayerScore,
      rank: stats.totalScoreRank,
      details: Array.from({ length: 10 }, (_, i) => stats[`playerScore${i}`]),
    },
    role_bound_item: stats.roleBoundItem,
    was_severe_transgressor: stats.wasSevereTransgressor || false,
    win: stats.win || false,
    // SGP 独有字段 — LCU 降级时填默认值
    spell_casts: { q: 0, w: 0, e: 0, r: 0 },
    summoner_casts: { d: 0, f: 0 },
    pings: {
      all_in: 0, assist: 0, bait: 0, basic: 0, command: 0,
      danger: 0, enemy_missing: 0, enemy_vision: 0, get_back: 0,
      hold: 0, need_vision: 0, on_my_way: 0, push: 0, vision_cleared: 0,
    },
    team_contribution: {
      damage_shielded: 0, heals_on_teammates: 0,
      objectives_stolen: 0, objectives_stolen_assists: 0,
    },
    time_breakdown: { total_time_dead: 0, time_played: 0 },
    items_purchased: 0,
    consumables_purchased: 0,
    detector_wards_placed: 0,
    bounty_level: 0,
    champ_experience: 0,
  }
}

export function extractTeamData(team: any, players: PlayerData[]): TeamData {
  return {
    team_id: team?.teamId,
    win: team?.win === 'Win',
    bans: team?.bans || [],
    baron_kills: team?.baronKills || 0,
    dragon_kills: team?.dragonKills || 0,
    rift_herald_kills: team?.riftHeraldKills || 0,
    vilemaw_kills: team?.vilemawKills || 0,
    horde_kills: team?.hordeKills || 0,
    tower_kills: team?.towerKills || 0,
    inhibitor_kills: team?.inhibitorKills || 0,
    first_blood: team?.firstBlood || false,
    first_tower: team?.firstTower || false,
    first_inhibitor: team?.firstInhibitor || false,
    first_baron: team?.firstBaron || false,
    first_dragon: team?.firstDargon || false,
    players,
  }
}

export function extractRankedData(rankedStats: any): RankedData {
  const queues = rankedStats?.queues || []
  const result: Record<string, any> = {}
  for (const q of queues) {
    const qt = q.queueType || 'UNKNOWN'
    const wins = q.wins || 0
    const losses = q.losses || 0
    const total = wins + losses
    result[qt] = {
      tier: q.tier || '',
      division: q.division || '',
      league_points: q.leaguePoints || 0,
      wins,
      losses,
      win_rate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
    }
  }
  return {
    highest_current_tier: rankedStats?.highestCurrentSeasonReachedTierSR || '',
    highest_previous_tier: rankedStats?.highestPreviousSeasonEndTier || '',
    queues: result,
  }
}

/** @deprecated 新代码请直接构建所需数据，勿使用此聚合函数 */
export function extractChampionMasteryForGame(
  masteryList: any[],
  playedChampionIds: number[]
): Record<string, ChampionMastery> {
  const result: Record<string, ChampionMastery> = {}
  for (const m of masteryList) {
    const cid = m.championId
    if (playedChampionIds.includes(cid)) {
      result[String(cid)] = {
        level: m.championLevel,
        points: m.championPoints,
        highest_grade: m.highestGrade || '',
        last_play_time: m.lastPlayTime,
      }
    }
  }
  return result
}
