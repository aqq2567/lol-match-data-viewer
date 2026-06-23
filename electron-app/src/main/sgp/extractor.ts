/**
 * SGP 原始 JSON → 应用层类型提取器
 *
 * 纯函数，无副作用。直接从 SGP 响应提取到 GameSummary / GameRecord，
 * 不经过 LCU 中间格式。SGP 一次调用返回完整数据（列表+详情一体），
 * 因此一次提取产出摘要和详情两种类型。
 */
import type {
  GameSummary,
  GameRecord,
  PlayerStats,
  PlayerData,
  TeamData,
  TeamStats,
  ParticipantBrief,
  CherrySubteamData,
} from '@shared/types/app'
import type { SgpGame, SgpParticipant } from './types'

// ── 工具 ──

function safeInt(v: any): number {
  return typeof v === 'number' ? v : 0
}

// ── 符文集展平 ──

function flattenPerks(p: SgpParticipant): {
  primary_style: number
  sub_style: number
  perks: number[]
  perk_vars: Record<string, number[]>
} {
  let primaryStyle = 0
  let subStyle = 0
  const selections: { perk: number; var1: number; var2: number; var3: number }[] = []

  for (const style of p.perks.styles) {
    if (style.description === 'primaryStyle') primaryStyle = style.style
    else if (style.description === 'subStyle') subStyle = style.style
    for (const sel of style.selections) {
      selections.push(sel)
    }
  }

  const perks = selections.map(s => s.perk)
  // pad to 6
  while (perks.length < 6) perks.push(0)

  const perkVars: Record<string, number[]> = {}
  selections.forEach((s, i) => {
    perkVars[`perk${i}`] = [s.var1, s.var2, s.var3]
  })

  return { primary_style: primaryStyle, sub_style: subStyle, perks, perk_vars: perkVars }
}

// ── PlayerStats 提取（全 110 字段） ──

export function extractPlayerStats(p: SgpParticipant): PlayerStats {
  const kills = safeInt(p.kills)
  const deaths = safeInt(p.deaths)
  const assists = safeInt(p.assists)

  return {
    kills,
    deaths,
    assists,
    kda: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    kda_ratio: `${kills}/${deaths}/${assists}`,
    largest_multi_kill: safeInt(p.largestMultiKill),
    largest_killing_spree: safeInt(p.largestKillingSpree),
    killing_sprees: safeInt(p.killingSprees),
    double_kills: safeInt(p.doubleKills),
    triple_kills: safeInt(p.tripleKills),
    quadra_kills: safeInt(p.quadraKills),
    penta_kills: safeInt(p.pentaKills),
    unreal_kills: safeInt(p.unrealKills),
    damage: {
      total_to_champs: safeInt(p.totalDamageDealtToChampions),
      total_dealt: safeInt(p.totalDamageDealt),
      total_taken: safeInt(p.totalDamageTaken),
      physical_to_champs: safeInt(p.physicalDamageDealtToChampions),
      physical_dealt: safeInt(p.physicalDamageDealt),
      physical_taken: safeInt(p.physicalDamageTaken),
      magic_to_champs: safeInt(p.magicDamageDealtToChampions),
      magic_dealt: safeInt(p.magicDamageDealt),
      magic_taken: safeInt(p.magicDamageTaken),
      true_to_champs: safeInt(p.trueDamageDealtToChampions),
      true_dealt: safeInt(p.trueDamageDealt),
      true_taken: safeInt(p.trueDamageTaken),
      largest_critical_strike: safeInt(p.largestCriticalStrike),
    },
    economy: {
      gold_earned: safeInt(p.goldEarned),
      gold_spent: safeInt(p.goldSpent),
    },
    cs: {
      total: safeInt(p.totalMinionsKilled) + safeInt(p.neutralMinionsKilled),
      minions: safeInt(p.totalMinionsKilled),
      neutral_total: safeInt(p.neutralMinionsKilled),
      neutral_enemy_jungle: safeInt(p.totalEnemyJungleMinionsKilled),
      neutral_team_jungle: safeInt(p.totalAllyJungleMinionsKilled),
    },
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    runes: flattenPerks(p),
    vision: {
      score: safeInt(p.visionScore),
      wards_placed: safeInt(p.wardsPlaced),
      wards_killed: safeInt(p.wardsKilled),
      sight_wards_bought: safeInt(p.sightWardsBoughtInGame),
      vision_wards_bought: safeInt(p.visionWardsBoughtInGame),
    },
    objectives: {
      turret_kills: safeInt(p.turretKills),
      inhibitor_kills: safeInt(p.inhibitorKills),
      damage_to_turrets: safeInt(p.damageDealtToTurrets),
      damage_to_objectives: safeInt(p.damageDealtToObjectives),
    },
    cc: {
      time_cc_others: safeInt(p.timeCCingOthers),
      total_cc_dealt: safeInt(p.totalTimeCCDealt),
    },
    survival: {
      longest_time_living: safeInt(p.longestTimeSpentLiving),
      damage_self_mitigated: safeInt(p.damageSelfMitigated),
      total_heal: safeInt(p.totalHeal),
      total_units_healed: safeInt(p.totalUnitsHealed),
    },
    champ_level: safeInt(p.champLevel),
    firsts: {
      first_blood_kill: p.firstBloodKill ?? false,
      first_blood_assist: p.firstBloodAssist ?? false,
      first_tower_kill: p.firstTowerKill ?? false,
      first_tower_assist: p.firstTowerAssist ?? false,
      first_inhibitor_kill: false,  // SGP 无此字段
      first_inhibitor_assist: false,
    },
    summoner_spells: {
      spell1: p.spell1Id ?? null,
      spell2: p.spell2Id ?? null,
    },
    position: {
      individual_position: p.individualPosition || '',
      team_position: p.teamPosition || '',
      lane: p.lane || '',
    },
    surrender: {
      game_ended_in_surrender: p.gameEndedInSurrender ?? false,
      game_ended_in_early_surrender: p.gameEndedInEarlySurrender ?? false,
      game_ended_in_ignb_surrender: false,
      team_early_surrendered: p.teamEarlySurrendered ?? false,
      caused_early_surrender: false,
      caused_game_end_from_ignb_surrender: false,
      early_surrender_accomplice: false,
    },
    arena: {
      subteam_placement: safeInt(p.subteamPlacement),
      player_subteam_id: safeInt(p.playerSubteamId),
      player_augments: [
        p.playerAugment1, p.playerAugment2, p.playerAugment3,
        p.playerAugment4, p.playerAugment5, p.playerAugment6,
      ],
    },
    scores: {
      combat: 0,    // SGP missions 中有 PlayerScore0-11 但结构不同，暂不映射
      objective: 0,
      total: 0,
      rank: safeInt(p.placement),
      details: [],
    },
    role_bound_item: 0,
    was_severe_transgressor: false,
    win: p.win ?? false,

    // ── SGP 独有 ──
    spell_casts: {
      q: safeInt(p.spell1Casts),
      w: safeInt(p.spell2Casts),
      e: safeInt(p.spell3Casts),
      r: safeInt(p.spell4Casts),
    },
    summoner_casts: {
      d: safeInt(p.summoner1Casts),
      f: safeInt(p.summoner2Casts),
    },
    pings: {
      all_in: safeInt(p.allInPings),
      assist: safeInt(p.assistMePings),
      bait: safeInt(p.basicPings),              // 语义最近似
      basic: safeInt(p.basicPings),
      command: safeInt(p.commandPings),
      danger: safeInt(p.dangerPings),
      enemy_missing: safeInt(p.enemyMissingPings),
      enemy_vision: safeInt(p.enemyVisionPings),
      get_back: safeInt(p.getBackPings),
      hold: safeInt(p.holdPings),
      need_vision: safeInt(p.needVisionPings),
      on_my_way: safeInt(p.onMyWayPings),
      push: safeInt(p.pushPings),
      vision_cleared: safeInt(p.visionClearedPings),
    },
    team_contribution: {
      damage_shielded: safeInt(p.totalDamageShieldedOnTeammates),
      heals_on_teammates: safeInt(p.totalHealsOnTeammates),
      objectives_stolen: safeInt(p.objectivesStolen),
      objectives_stolen_assists: safeInt(p.objectivesStolenAssists),
    },
    time_breakdown: {
      total_time_dead: safeInt(p.totalTimeSpentDead),
      time_played: safeInt(p.timePlayed),
    },
    items_purchased: safeInt(p.itemsPurchased),
    consumables_purchased: safeInt(p.consumablesPurchased),
    detector_wards_placed: safeInt(p.detectorWardsPlaced),
    bounty_level: safeInt(p.bountyLevel),
    champ_experience: safeInt(p.champExperience),
  }
}

// ── PlayerData ──

export function extractPlayerData(p: SgpParticipant): PlayerData {
  return {
    puuid: p.puuid || '',
    summoner_name: p.summonerName || p.riotIdGameName
      ? `${p.riotIdGameName}#${p.riotIdTagline}`
      : '',
    profile_icon_id: safeInt(p.profileIcon),
    summoner_id: safeInt(p.summonerId),
    champion_id: safeInt(p.championId),
    stats: extractPlayerStats(p),
  }
}

// ── TeamData ──

export function extractTeamData(
  team: { teamId: number; win: boolean },
  players: PlayerData[],
  allParticipants: SgpParticipant[],
): TeamData {
  const firstBloodTeamId = allParticipants.find(p2 => p2.firstBloodKill)?.teamId
  return {
    team_id: team.teamId,
    win: team.win,
    bans: [],
    baron_kills: 0,
    dragon_kills: 0,
    rift_herald_kills: 0,
    vilemaw_kills: 0,
    horde_kills: 0,
    tower_kills: 0,
    inhibitor_kills: 0,
    first_blood: firstBloodTeamId === team.teamId,
    first_tower: false,  // 可从 participants firstTowerKill 推导，简化处理
    first_inhibitor: false,
    first_baron: false,
    first_dragon: false,
    players,
  }
}

// ── Cherry 子队 ──

export function extractCherrySubteams(participants: SgpParticipant[]): CherrySubteamData[] | undefined {
  const subteamMap = new Map<number, { placement: number; players: PlayerData[] }>()

  for (const p of participants) {
    const sid = safeInt(p.playerSubteamId)
    if (!sid) continue
    if (!subteamMap.has(sid)) {
      subteamMap.set(sid, { placement: safeInt(p.subteamPlacement), players: [] })
    }
    subteamMap.get(sid)!.players.push(extractPlayerData(p))
  }

  if (subteamMap.size === 0) return undefined

  return Array.from(subteamMap.entries())
    .sort(([, a], [, b]) => a.placement - b.placement)
    .map(([id, data]) => ({
      subteam_id: id,
      placement: data.placement,
      players: data.players,
    }))
}

// ── GameSummary ──

export function extractGameSummary(game: SgpGame, selfPuuid: string): GameSummary {
  const json = game.json
  const participants = json.participants

  const selfP = participants.find(p => p.puuid === selfPuuid) || participants[0]
  if (!selfP) throw new Error(`Player ${selfPuuid} not found in game ${json.gameId}`)

  const kills = safeInt(selfP.kills)
  const deaths = safeInt(selfP.deaths)
  const assists = safeInt(selfP.assists)

  // 队伍统计
  const teamIds = [...new Set(participants.map(p => p.teamId))].sort()
  const blueTeamId = teamIds[0] || 100
  const redTeamId = teamIds[1] || 200

  // Cherry team ID 修正 — SGP 有时返回特殊情况
  const isCherry = json.gameMode === 'CHERRY' || json.queueId === 1750

  function buildBrief(teamId: number): ParticipantBrief[] {
    return participants
      .filter(p => p.teamId === teamId)
      .map(p => ({
        participantId: p.participantId,
        puuid: p.puuid,
        gameName: p.riotIdGameName || '',
        tagLine: p.riotIdTagline || '',
        profileIconId: safeInt(p.profileIcon),
        summonerName: p.summonerName || p.riotIdGameName || '',
        championId: safeInt(p.championId),
        teamId: p.teamId,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      }))
  }

  let blueParticipants = buildBrief(blueTeamId)
  let redParticipants = buildBrief(redTeamId)

  // Cherry: 每边最多 5 人，包含用户子队
  if (isCherry) {
    const selfSubteamId = safeInt(selfP.playerSubteamId)
    if (selfSubteamId) {
      const subteamPids = new Set(
        participants
          .filter(p => safeInt(p.playerSubteamId) === selfSubteamId)
          .map(p => p.participantId)
      )
      const trim = (briefs: ParticipantBrief[]) => {
        if (briefs.length <= 5) return briefs
        const sub = briefs.filter(b => subteamPids.has(b.participantId))
        const rest = briefs.filter(b => !subteamPids.has(b.participantId))
        return [...sub, ...rest].slice(0, 5)
      }
      blueParticipants = trim(blueParticipants)
      redParticipants = trim(redParticipants)
    }
  }

  // 团队统计
  const selfTeamId = selfP.teamId
  const teamPlayers = participants.filter(p => p.teamId === selfTeamId)
  let teamKills = 0, teamDamage = 0, teamDamageTaken = 0, teamGold = 0
  let highestDamage = 0, highestDamageTaken = 0

  for (const p of teamPlayers) {
    teamKills += safeInt(p.kills)
    const dmg = safeInt(p.totalDamageDealtToChampions)
    const taken = safeInt(p.totalDamageTaken)
    const gold = safeInt(p.goldEarned)
    teamDamage += dmg
    teamDamageTaken += taken
    teamGold += gold
    if (dmg > highestDamage) highestDamage = dmg
    if (taken > highestDamageTaken) highestDamageTaken = taken
  }

  const playerDamage = safeInt(selfP.totalDamageDealtToChampions)
  const playerDamageTaken = safeInt(selfP.totalDamageTaken)
  const playerGold = safeInt(selfP.goldEarned)

  const teamStats: TeamStats = {
    killParticipation: teamKills > 0 ? Math.round((kills + assists) / teamKills * 100) : 0,
    damageShare: teamDamage > 0 ? Math.round(playerDamage / teamDamage * 100) : 0,
    damageTakenShare: teamDamageTaken > 0 ? Math.round(playerDamageTaken / teamDamageTaken * 100) : 0,
    goldShare: teamGold > 0 ? Math.round(playerGold / teamGold * 100) : 0,
    isHighestDamage: playerDamage > 0 && playerDamage === highestDamage,
    isHighestDamageTaken: playerDamageTaken > 0 && playerDamageTaken === highestDamageTaken,
  }

  return {
    gameId: json.gameId,
    gameMode: json.gameMode || '',
    gameType: json.gameType || '',
    queueId: json.queueId,
    mapId: json.mapId,
    gameCreation: json.gameCreation || 0,
    gameDuration: json.gameDuration || 0,
    gameVersion: json.gameVersion || '',
    championId: safeInt(selfP.championId),
    win: selfP.win ?? false,
    kills,
    deaths,
    assists,
    role: selfP.teamPosition || selfP.role || '',
    spell1Id: selfP.spell1Id || 0,
    spell2Id: selfP.spell2Id || 0,
    perkPrimaryStyle: flattenPerks(selfP).primary_style,
    perkSubStyle: flattenPerks(selfP).sub_style,
    perk0: flattenPerks(selfP).perks[0] || 0,
    items: [selfP.item0, selfP.item1, selfP.item2, selfP.item3, selfP.item4, selfP.item5, selfP.item6],
    champLevel: safeInt(selfP.champLevel),
    teamId: selfP.teamId,
    kdaRatio: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    blueParticipants,
    redParticipants,
    teamStats,
  }
}

// ── GameRecord ──

export function extractGameRecord(game: SgpGame): GameRecord {
  const json = game.json
  const participants = json.participants

  const teamIds = [...new Set(participants.map(p => p.teamId))].sort()
  const blueTeamId = teamIds[0] || 100
  const redTeamId = teamIds[1] || 200

  const bluePlayers = participants
    .filter(p => p.teamId === blueTeamId)
    .map(p => extractPlayerData(p))

  const redPlayers = participants
    .filter(p => p.teamId === redTeamId)
    .map(p => extractPlayerData(p))

  return {
    game_id: json.gameId,
    game_creation: new Date(json.gameCreation).toISOString(),
    game_duration_min: Math.round((json.gameDuration || 0) / 60),
    game_mode: json.gameMode || '',
    game_type: json.gameType || '',
    queue_id: json.queueId,
    map_id: json.mapId,
    game_version: json.gameVersion || '',
    blue_team: extractTeamData(
      { teamId: blueTeamId, win: bluePlayers[0]?.stats.win ?? false },
      bluePlayers,
      participants,
    ),
    red_team: extractTeamData(
      { teamId: redTeamId, win: redPlayers[0]?.stats.win ?? false },
      redPlayers,
      participants,
    ),
    champion_mastery: {},
    cherry_subteams: json.gameMode === 'CHERRY' || json.queueId === 1750
      ? extractCherrySubteams(participants)
      : undefined,
  }
}
