/**
 * LCU 数据提取与转换函数
 * 将 LCU 原始 JSON 转为 App 层类型，处理字段缺失和类型转换
 */
import { findLolClient, LcuHttpClient } from './client'
import type {
  PlayerStats,
  PlayerData,
  TeamData,
  GameRecord,
  RankedData,
  ChampionMastery,
  MatchData,
  MatchListData,
  GameSummary,
  ParticipantBrief,
  TeamStats,
  SummonerInfo,
  GameDataCache,
  PerkStyleData,
  PerkstylesData,
  QueueData,
  AugmentData,
} from '@shared/types/app'

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

function safeInt(v: any): number {
  return typeof v === 'number' ? v : 0
}

function mapById<T extends { id: number }>(arr: T[]): Record<number, T> {
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

// ═══════════════════════════════════════════════════════════
// 对局列表（分页拉取 + 详情补载）
// 对标 LeagueAkari：使用 begIndex/endIndex 分页查询，而非 gameId 递减追溯
// ═══════════════════════════════════════════════════════════

/** 单次 getMatchHistory 请求的游戏数量（每页 100 场） */
const PAGE_SIZE = 100
/** 目标拉取的对局总数上限（对齐 LeagueAkari） */
const MAX_FETCH_COUNT = 1000
/** 每次并行调用 getGameDetail 的数量 */
const DETAIL_CONCUR = 20

/** 拉取一页对局摘要，自动降级 begIndex → beginIndex（国服兼容） */
async function fetchMatchPage(
  client: LcuHttpClient,
  puuid: string,
  beg: number,
  end: number,
): Promise<{ meta: any; games: any[] }> {
  let page = await client.getMatchHistory(puuid, beg, end)
  let games: any[] = page?.games?.games || []
  if (games.length === 0) {
    page = await client.getMatchHistoryAlt(puuid, beg, end)
    games = page?.games?.games || []
    if (games.length > 0) {
      console.log(`[LCU:MAIN] beginIndex 兼容模式: beg=${beg} end=${end} → ${games.length} 场`)
    }
  }
  return { meta: page?.games || {}, games }
}

/** gameId 回溯参数 */
const MAX_BACKTRACK_STEPS = 500
const MAX_CONSECUTIVE_MISSES = 100

/**
 * gameId 回溯降级：从最小 gameId 递减逐个尝试 getGameDetail
 * 绕过 LCU match-history 缓存限制，发现更多历史对局
 * 回溯到的对局同时加入 allSummaries 和 detailMap（已持有完整详情）
 */
async function backtrackGameIds(
  client: LcuHttpClient,
  allSummaries: any[],
  detailMap: Map<number, any>,
  seenIds: Set<number>,
  targetCount: number,
): Promise<number> {
  if (allSummaries.length === 0) return 0

  let minGameId = Infinity
  for (const g of allSummaries) {
    if (g.gameId < minGameId) minGameId = g.gameId
  }

  let cursor = minGameId - 1
  let consecutiveMisses = 0
  let found = 0

  console.log(
    `[LCU:MAIN] gameId 回溯开始: 起始=${cursor} 已有=${allSummaries.length} target=${targetCount}`
  )

  for (
    let step = 0;
    step < MAX_BACKTRACK_STEPS &&
    allSummaries.length < targetCount &&
    consecutiveMisses < MAX_CONSECUTIVE_MISSES;
    step++
  ) {
    const detail = await client.getGameDetail(cursor).catch(() => null)

    if (detail && detail.gameId && !seenIds.has(detail.gameId)) {
      seenIds.add(detail.gameId)
      allSummaries.push(detail)
      detailMap.set(detail.gameId, detail)
      found++
      consecutiveMisses = 0
    } else {
      consecutiveMisses++
    }

    if (step > 0 && step % 100 === 0) {
      console.log(
        `[LCU:MAIN] 回溯进度: step=${step} found=${found} current=${cursor}`
      )
    }

    cursor--
  }

  console.log(
    `[LCU:MAIN] gameId 回溯结束: found=${found} total=${allSummaries.length} consecutiveMisses=${consecutiveMisses}`
  )
  return found
}

export async function fetchMatchList(
  client: LcuHttpClient,
  _page: number = 1,
  _pageSize: number = 20
): Promise<MatchListData> {
  const conn = findLolClient()
  if (!conn) throw new Error('未找到运行中的 LOL 客户端')

  const summoner = await client.getCurrentSummoner()
  const puuid = summoner.puuid

  // ═══ 第一步：拉取初始页 + 段位 ═══
  const ranked = await client.getRankedStats(puuid)

  const { meta: firstMeta, games: firstGames } = await fetchMatchPage(client, puuid, 0, PAGE_SIZE - 1)
  const totalGames: number = firstMeta.gameCount || 0
  // 不依赖 gameCount 作为硬上限（国服 gameCount 仅为缓存大小 ≈21），
  // 以 MAX_FETCH_COUNT 为安全阀，持续拉取直到 API 返回空或返回重复数据
  const targetCount = MAX_FETCH_COUNT

  console.log(
    `[LCU:MAIN] 初始分页: beg=0 end=${PAGE_SIZE - 1} → ` +
    `返回${firstGames.length}场 gameCount=${totalGames} target=${targetCount}`
  )

  // ═══ 第二步：分页拉取剩余的摘要数据 ═══
  const seenIds = new Set<number>()
  const allSummaries: any[] = []
  const detailMap = new Map<number, any>()

  for (const g of firstGames) {
    if (!seenIds.has(g.gameId)) {
      seenIds.add(g.gameId)
      allSummaries.push(g)
    }
  }

  let cursor = PAGE_SIZE // 下一页的 begIndex
  while (allSummaries.length < targetCount) {
    const beg = cursor
    const end = beg + PAGE_SIZE - 1
    console.log(`[LCU:MAIN] 继续分页: beg=${beg} end=${end}`)

    const { games: pageGames } = await fetchMatchPage(client, puuid, beg, end)
    if (pageGames.length === 0) {
      console.log(`[LCU:MAIN] 分页中断: beg=${beg} 返回空（LCU 无更多数据）`)
      break
    }

    let newCount = 0
    for (const g of pageGames) {
      if (!seenIds.has(g.gameId)) {
        seenIds.add(g.gameId)
        allSummaries.push(g)
        newCount++
      }
    }

    if (newCount === 0) {
      console.log(`[LCU:MAIN] 分页中断: beg=${beg} 返回全部重复（LCU 缓存已耗尽）`)
      break
    }

    cursor += PAGE_SIZE
  }

  console.log(`[LCU:MAIN] 分页完成: 共 ${allSummaries.length} 场摘要`)

  // ═══ 2.5：gameId 回溯 —— 绕过 LCU 缓存限制发现更多对局 ═══
  await backtrackGameIds(client, allSummaries, detailMap, seenIds, targetCount)

  // 按 gameCreation 降序排列（回溯的对局是更早的，排序后自然在末尾）
  allSummaries.sort((a, b) => {
    const ta = a.gameCreationDate ? new Date(a.gameCreationDate).getTime() : (a.gameCreation || 0)
    const tb = b.gameCreationDate ? new Date(b.gameCreationDate).getTime() : (b.gameCreation || 0)
    return tb - ta
  })

  // ═══ 第三步：并行补载对局详情（跳过回溯已持有的） ═══
  for (let i = 0; i < allSummaries.length; i += DETAIL_CONCUR) {
    const batch = allSummaries.slice(i, i + DETAIL_CONCUR)
    const needDetails = batch.filter(g => !detailMap.has(g.gameId))
    if (needDetails.length === 0) continue
    const results = await Promise.all(
      needDetails.map(g =>
        client.getGameDetail(g.gameId).catch((err: any) => {
          console.warn(`[LCU:MAIN] 详情 #${g.gameId} 加载失败: ${err.message || err}`)
          return null
        })
      )
    )
    for (const d of results) {
      if (d) detailMap.set(d.gameId, d)
    }
  }
  console.log(`[LCU:MAIN] 详情补载: ${detailMap.size}/${allSummaries.length} 场`)

  // 用详情增强摘要，缺失详情的保留原始摘要
  const rawGames = allSummaries.map(g => {
    const detail = detailMap.get(g.gameId)
    if (detail) {
      return {
        ...g,
        participants: detail.participants,
        participantIdentities: detail.participantIdentities,
        teams: detail.teams,
      }
    }
    return g
  })

  // 按 gameCreation 降序排列（最新的在前）
  rawGames.sort((a, b) => {
    const ta = a.gameCreationDate ? new Date(a.gameCreationDate).getTime() : (a.gameCreation || 0)
    const tb = b.gameCreationDate ? new Date(b.gameCreationDate).getTime() : (b.gameCreation || 0)
    return tb - ta
  })

  console.log(`[LCU:MAIN] fetch-match-list: 最终 ${rawGames.length} 场, totalGames=${totalGames}`)

  // ═══ 第四步：构建 GameSummary 列表 ═══
  const games: GameSummary[] = rawGames.map((g: any) => buildGameSummary(g, puuid))

  const summonerInfo: SummonerInfo = {
    puuid,
    name: summoner.displayName || '',
    level: summoner.summonerLevel || 0,
    region: conn.region,
    platform: conn.rsoPlatformId,
    profileIconId: (summoner as any).profileIconId || 0,
  }

  return {
    summoner: summonerInfo,
    ranked: extractRankedData(ranked),
    totalGames,
    pageSize: 0,
    games,
  }
}

/** 从单局数据（摘要或详情）构建 GameSummary */
function buildGameSummary(g: any, selfPuuid: string): GameSummary {
  const participants: any[] = g.participants || []
  const identities: any[] = g.participantIdentities || []

  // 构建参与者身份映射 participantId → player
  const idMap: Record<number, any> = {}
  for (const pi of identities) {
    idMap[pi.participantId] = pi.player || {}
  }

  // 找到当前召唤师对应的参与者
  const selfP =
    participants.find((p: any) => {
      const player = idMap[p.participantId]
      return player?.puuid === selfPuuid
    }) || participants[0] || {}

  const stats = selfP.stats || {}
  const kills = safeInt(stats.kills)
  const deaths = safeInt(stats.deaths)
  const assists = safeInt(stats.assists)

  /** 计算队伍统计（击杀参与率、伤害占比等） */
  function computeTeamStats(): TeamStats {
    const selfTeamId = selfP.teamId
    const teamPlayers = participants.filter((p: any) => p.teamId === selfTeamId)

    let teamKills = 0, teamDamage = 0, teamDamageTaken = 0, teamGold = 0
    let highestDamage = 0, highestDamageTaken = 0

    for (const p of teamPlayers) {
      const s = p.stats || {}
      teamKills += safeInt(s.kills)
      const dmg = safeInt(s.totalDamageDealtToChampions)
      const taken = safeInt(s.totalDamageTaken)
      const gold = safeInt(s.goldEarned)
      teamDamage += dmg
      teamDamageTaken += taken
      teamGold += gold
      if (dmg > highestDamage) highestDamage = dmg
      if (taken > highestDamageTaken) highestDamageTaken = taken
    }

    const playerDamage = safeInt(stats.totalDamageDealtToChampions)
    const playerDamageTaken = safeInt(stats.totalDamageTaken)
    const playerGold = safeInt(stats.goldEarned)

    return {
      killParticipation: teamKills > 0 ? Math.round((kills + assists) / teamKills * 100) : 0,
      damageShare: teamDamage > 0 ? Math.round(playerDamage / teamDamage * 100) : 0,
      damageTakenShare: teamDamageTaken > 0 ? Math.round(playerDamageTaken / teamDamageTaken * 100) : 0,
      goldShare: teamGold > 0 ? Math.round(playerGold / teamGold * 100) : 0,
      isHighestDamage: playerDamage > 0 && playerDamage === highestDamage,
      isHighestDamageTaken: playerDamageTaken > 0 && playerDamageTaken === highestDamageTaken,
    }
  }

  /** 构建队伍参与者简要列表（用于队友/对手统计） */
  function buildBrief(teamId: number): ParticipantBrief[] {
    return participants
      .filter((p: any) => p.teamId === teamId)
      .map((p: any) => {
        const player = idMap[p.participantId] || {}
        return {
          participantId: p.participantId,
          puuid: player.puuid || '',
          gameName: player.gameName || '',
          tagLine: player.tagLine || '',
          profileIconId: player.profileIcon || 0,
          summonerName: player.summonerName || player.gameName || '',
          championId: p.championId || 0,
          teamId: p.teamId,
        }
      })
  }

  // 从 teams 数组中获取真实队伍 ID（而非硬编码 100/200）
  const teamsArr: any[] = g.teams || []
  const blueTeamId = teamsArr.length >= 2
    ? (teamsArr[0].teamId === 100 ? 100 : teamsArr[1].teamId === 100 ? 100 : teamsArr[0].teamId)
    : 100
  const redTeamId = teamsArr.length >= 2
    ? (teamsArr[0].teamId === 200 ? 200 : teamsArr[1].teamId === 200 ? 200 : teamsArr[1].teamId)
    : 200

  return {
    gameId: g.gameId,
    gameMode: g.gameMode || '',
    queueId: g.queueId,
    mapId: g.mapId,
    gameCreation: g.gameCreationDate ? new Date(g.gameCreationDate).getTime() : (g.gameCreation || 0),
    gameDuration: g.gameDuration || 0,
    gameVersion: g.gameVersion || '',
    championId: selfP.championId || 0,
    win: stats.win || false,
    kills,
    deaths,
    assists,
    role: stats.teamPosition || selfP.role || '',
    spell1Id: selfP.spell1Id || 0,
    spell2Id: selfP.spell2Id || 0,
    perkPrimaryStyle: stats.perkPrimaryStyle || 0,
    perkSubStyle: stats.perkSubStyle || 0,
    perk0: stats.perk0 || 0,
    items: [0, 1, 2, 3, 4, 5, 6].map((i) => stats[`item${i}`] || 0),
    champLevel: stats.champLevel || 0,
    teamId: selfP.teamId || 0,
    kdaRatio: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    blueParticipants: buildBrief(blueTeamId),
    redParticipants: buildBrief(redTeamId),
    teamStats: computeTeamStats(),
  }
}

/** 以指定 PUUID 拉取对局列表（无需当前召唤师，用于查询其他玩家） */
export async function fetchMatchListForPlayer(
  client: LcuHttpClient,
  targetPuuid: string,
  summonerName: string,
  profileIconId: number,
  summonerLevel: number,
  _page: number = 1,
  _pageSize: number = 20
): Promise<MatchListData> {
  const conn = findLolClient()
  if (!conn) throw new Error('未找到运行中的 LOL 客户端')

  const puuid = targetPuuid

  const ranked = await client.getRankedStats(puuid)

  const { meta: firstMeta, games: firstGames } = await fetchMatchPage(client, puuid, 0, PAGE_SIZE - 1)
  const totalGames: number = firstMeta.gameCount || 0
  const targetCount = MAX_FETCH_COUNT

  console.log(
    `[LCU:MAIN] fetchMatchListForPlayer PUUID=${puuid.slice(0,8)}…: ` +
    `初始分页 beg=0 end=${PAGE_SIZE - 1} → ` +
    `返回${firstGames.length}场 gameCount=${totalGames} target=${targetCount}`
  )

  const seenIds = new Set<number>()
  const allSummaries: any[] = []

  for (const g of firstGames) {
    if (!seenIds.has(g.gameId)) {
      seenIds.add(g.gameId)
      allSummaries.push(g)
    }
  }

  let cursor = PAGE_SIZE
  while (allSummaries.length < targetCount) {
    const beg = cursor
    const end = beg + PAGE_SIZE - 1
    const { games: pageGames } = await fetchMatchPage(client, puuid, beg, end)
    if (pageGames.length === 0) break

    let newCount = 0
    for (const g of pageGames) {
      if (!seenIds.has(g.gameId)) {
        seenIds.add(g.gameId)
        allSummaries.push(g)
        newCount++
      }
    }

    if (newCount === 0) {
      console.log(`[LCU:MAIN] fetchMatchListForPlayer 分页中断: beg=${beg} 返回全部重复（LCU 缓存已耗尽）`)
      break
    }

    cursor += PAGE_SIZE
  }

  console.log(`[LCU:MAIN] fetchMatchListForPlayer 分页完成: 共 ${allSummaries.length} 场摘要`)

  const detailMap = new Map<number, any>()

  // ═══ gameId 回溯 —— 绕过 LCU 缓存限制发现更多对局 ═══
  await backtrackGameIds(client, allSummaries, detailMap, seenIds, targetCount)

  allSummaries.sort((a, b) => {
    const ta = a.gameCreationDate ? new Date(a.gameCreationDate).getTime() : (a.gameCreation || 0)
    const tb = b.gameCreationDate ? new Date(b.gameCreationDate).getTime() : (b.gameCreation || 0)
    return tb - ta
  })

  // 并行补载对局详情（跳过回溯已持有的）
  for (let i = 0; i < allSummaries.length; i += DETAIL_CONCUR) {
    const batch = allSummaries.slice(i, i + DETAIL_CONCUR)
    const needDetails = batch.filter(g => !detailMap.has(g.gameId))
    if (needDetails.length === 0) continue
    const results = await Promise.all(
      needDetails.map(g =>
        client.getGameDetail(g.gameId).catch((err: any) => {
          console.warn(`[LCU:MAIN] 详情 #${g.gameId} 加载失败: ${err.message || err}`)
          return null
        })
      )
    )
    for (const d of results) {
      if (d) detailMap.set(d.gameId, d)
    }
  }
  console.log(`[LCU:MAIN] fetchMatchListForPlayer 详情补载: ${detailMap.size}/${allSummaries.length} 场`)

  const rawGames = allSummaries.map(g => {
    const detail = detailMap.get(g.gameId)
    if (detail) {
      return { ...g, participants: detail.participants, participantIdentities: detail.participantIdentities, teams: detail.teams }
    }
    return g
  })

  rawGames.sort((a, b) => {
    const ta = a.gameCreationDate ? new Date(a.gameCreationDate).getTime() : (a.gameCreation || 0)
    const tb = b.gameCreationDate ? new Date(b.gameCreationDate).getTime() : (b.gameCreation || 0)
    return tb - ta
  })

  const games: GameSummary[] = rawGames.map((g: any) => buildGameSummary(g, puuid))

  const summonerInfo: SummonerInfo = {
    puuid,
    name: summonerName,
    level: summonerLevel,
    region: conn.region,
    platform: conn.rsoPlatformId,
    profileIconId,
  }

  return {
    summoner: summonerInfo,
    ranked: extractRankedData(ranked),
    totalGames,
    pageSize: 0,
    games,
  }
}

// ═══════════════════════════════════════════════════════════
// 批量拉取对局详情（并发，用于分析）
// ═══════════════════════════════════════════════════════════

export async function fetchGameDetailsBatched(
  client: LcuHttpClient,
  gameIds: number[]
): Promise<GameRecord[]> {
  const results = await Promise.all(
    gameIds.map(async (gameId) => {
      try {
        const detail = await client.getGameDetail(gameId)

        const identities: Record<number, any> = {}
        for (const pi of detail?.participantIdentities || []) {
          identities[pi.participantId] = pi.player || {}
        }

        const bluePlayers: PlayerData[] = []
        const redPlayers: PlayerData[] = []
        const usedChampionIds: number[] = []

        for (const p of detail?.participants || []) {
          const pid = p.participantId
          const playerInfo = identities[pid] || {}
          const cid = p.championId
          usedChampionIds.push(cid)

          const playerData: PlayerData = {
            ...extractPlayerIdentity(playerInfo),
            champion_id: cid,
            stats: extractStatsFull(p),
          }

          if (p.teamId === 100) {
            bluePlayers.push(playerData)
          } else {
            redPlayers.push(playerData)
          }
        }

        const teams = detail?.teams || []
        const blueTeamData = extractTeamData(
          teams.find((t: any) => t.teamId === 100) || {},
          bluePlayers
        )
        const redTeamData = extractTeamData(
          teams.find((t: any) => t.teamId === 200) || {},
          redPlayers
        )

        return {
          game_id: gameId,
          game_creation: detail?.gameCreationDate || '',
          game_duration_min:
            Math.round(((detail?.gameDuration || 0) / 60) * 10) / 10,
          game_mode: detail?.gameMode || '',
          game_type: detail?.gameType || '',
          queue_id: detail?.queueId || 0,
          map_id: detail?.mapId || 0,
          game_version: detail?.gameVersion || '',
          blue_team: blueTeamData,
          red_team: redTeamData,
          champion_mastery: {},
        }
      } catch (err: any) {
        console.warn(`[LCU:MAIN] 跳过对局 #${gameId}: ${err.message || err}`)
        return null
      }
    })
  )

  // 过滤掉拉取失败的对局，确保部分失败不影响整体分析
  const valid = results.filter(Boolean) as GameRecord[]
  if (valid.length < gameIds.length) {
    console.warn(`[LCU:MAIN] ${gameIds.length} 场中成功拉取 ${valid.length} 场, 跳过 ${gameIds.length - valid.length} 场`)
  }
  return valid
}

// ═══════════════════════════════════════════════════════════
// 游戏数据聚合拉取（供 Pinia store 初始化）
// ═══════════════════════════════════════════════════════════

export async function fetchGameData(client: LcuHttpClient): Promise<GameDataCache> {
  console.log('[LCU:MAIN] 开始拉取游戏基础数据（英雄/装备/技能/符文/队列/增幅）...')
  const [champions, items, spells, perks, perkstylesRaw, queuesRaw, augmentsRaw] = await Promise.all([
    client.getGameChampions().catch((err: any) => { console.error(`[LCU:MAIN] 英雄数据拉取失败: ${err.message || err}`); return [] }),
    client.getGameItems().catch((err: any) => { console.error(`[LCU:MAIN] 装备数据拉取失败: ${err.message || err}`); return [] }),
    client.getGameSummonerSpells().catch((err: any) => { console.error(`[LCU:MAIN] 技能数据拉取失败: ${err.message || err}`); return [] }),
    client.getGamePerks().catch((err: any) => { console.error(`[LCU:MAIN] 符文数据拉取失败: ${err.message || err}`); return [] }),
    client.getGamePerkstyles().catch((err: any) => { console.error(`[LCU:MAIN] 符文系数据拉取失败: ${err.message || err}`); return { schemaVersion: 0, styles: [] } }),
    client.getGameQueues().catch((err: any) => { console.error(`[LCU:MAIN] 队列数据拉取失败: ${err.message || err}`); return {} }),
    client.getGameAugments().catch((err: any) => { console.warn(`[LCU:MAIN] 增幅数据拉取失败（非斗魂模式可忽略）: ${err.message || err}`); return [] }),
  ])

  const perkstyles: PerkstylesData = {
    schemaVersion: perkstylesRaw.schemaVersion,
    styles: mapById(perkstylesRaw.styles) as Record<number, PerkStyleData>,
  }

  const queues: Record<number, QueueData> = {}
  for (const [key, val] of Object.entries(queuesRaw)) {
    queues[Number(key)] = val
  }

  return {
    champions: mapById(champions),
    items: mapById(items),
    summonerSpells: mapById(spells),
    perks: mapById(perks),
    perkstyles,
    queues,
    augments: mapById(augmentsRaw),
  }
}

// ═══════════════════════════════════════════════════════════
// 旧版批量拉取（保留兼容）
// ═══════════════════════════════════════════════════════════

/** @deprecated 使用 `fetchMatchList` 替代，该函数不支持分页且逐场串行请求 */
export async function fetchAllMatchData(
  client: LcuHttpClient,
  gameCount: number
): Promise<{ matchData: MatchData; connInfo: ReturnType<typeof findLolClient> }> {
  const conn = findLolClient()
  if (!conn) throw new Error('未找到运行中的 LOL 客户端')

  const summoner = await client.getCurrentSummoner()
  const puuid = summoner.puuid

  const [ranked, allMastery, history] = await Promise.all([
    client.getRankedStats(puuid),
    client.getChampionMastery(),
    client.getMatchHistory(puuid, 0, Math.max(gameCount - 1, 0)),
  ])

  const games = history?.games?.games || []
  const allGames: GameRecord[] = []

  for (const game of games) {
    const gameId = game.gameId
    const detail = await client.getGameDetail(gameId)

    const identities: Record<number, any> = {}
    for (const pi of detail?.participantIdentities || []) {
      identities[pi.participantId] = pi.player || {}
    }

    const bluePlayers: PlayerData[] = []
    const redPlayers: PlayerData[] = []
    const usedChampionIds: number[] = []

    for (const p of detail?.participants || []) {
      const pid = p.participantId
      const playerInfo = identities[pid] || {}
      const cid = p.championId
      usedChampionIds.push(cid)

      const playerData: PlayerData = {
        ...extractPlayerIdentity(playerInfo),
        champion_id: cid,
        stats: extractStatsFull(p),
      }

      if (p.teamId === 100) {
        bluePlayers.push(playerData)
      } else {
        redPlayers.push(playerData)
      }
    }

    const teams = detail?.teams || []
    const blueTeamData = extractTeamData(
      teams.find((t: any) => t.teamId === 100) || {},
      bluePlayers
    )
    const redTeamData = extractTeamData(
      teams.find((t: any) => t.teamId === 200) || {},
      redPlayers
    )

    const gameMastery = extractChampionMasteryForGame(allMastery, usedChampionIds)

    allGames.push({
      game_id: gameId,
      game_creation: game.gameCreationDate || '',
      game_duration_min: Math.round(((game.gameDuration || 0) / 60) * 10) / 10,
      game_mode: game.gameMode || '',
      game_type: game.gameType || '',
      queue_id: game.queueId,
      map_id: game.mapId,
      game_version: game.gameVersion || '',
      blue_team: blueTeamData,
      red_team: redTeamData,
      champion_mastery: gameMastery,
    })
  }

  const matchData: MatchData = {
    summoner: {
      puuid,
      name: summoner.displayName || '',
      level: summoner.summonerLevel || 0,
      region: conn.region,
      platform: conn.rsoPlatformId,
      profileIconId: (summoner as any).profileIconId || 0,
    },
    ranked: extractRankedData(ranked),
    champion_mastery_total: allMastery.length,
    games_count: allGames.length,
    games: allGames,
  }

  return { matchData, connInfo: conn }
}
