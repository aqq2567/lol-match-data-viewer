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

/**
 * 单次 getMatchHistory 请求的 endIndex 范围。
 * endIndex 必须 ≥499 才能触发 LCU 从服务端懒加载（否则仅命中本地缓存 ≈20 场）。
 * 服务端实际返回上限 ≈200 场，超出部分由分页去重逻辑自动跳过。
 */
const PAGE_SIZE = 500
/** 目标拉取的对局总数上限（安全阀，分页在 LCU 返回空时自动停止） */
const MAX_FETCH_COUNT = 1000
/** 详情并发数：LCU localhost 实测 200 并发会触发 ECONNREFUSED，30 为安全值 */
const DETAIL_CONCUR = 30

/**
 * 拉取一页对局摘要
 * 国服 (TENCENT) 使用 begIndex（缩写），Riot 服可能使用 beginIndex（完整拼写）
 * 先用 begIndex，返回空/报错时降级 beginIndex
 */
async function fetchMatchPage(
  client: LcuHttpClient,
  puuid: string,
  beg: number,
  end: number,
): Promise<{ meta: any; games: any[] }> {
  let page: any
  let games: any[] = []

  try {
    page = await client.getMatchHistory(puuid, beg, end)
    games = page?.games?.games || []
  } catch (err: any) {
    console.warn(`[LCU:MAIN] begIndex 请求失败 (${err.message || err}), 尝试 beginIndex 降级`)
  }

  if (games.length === 0) {
    page = await client.getMatchHistoryAlt(puuid, beg, end)
    games = page?.games?.games || []
    if (games.length > 0) {
      console.log(`[LCU:MAIN] beginIndex 降级兼容: beg=${beg} end=${end} → ${games.length} 场`)
    }
  }
  return { meta: page?.games || {}, games }
}

/**
 * 分页拉取指定玩家全部对局摘要（含去重）。
 * 先从第一页获取 gameCount，按需串行追加后续分页。
 * LCU 单玩家上限 ~200，PAGE_SIZE=500 一页即可覆盖，后续分页为安全阀。
 */
async function fetchAllSummaries(
  client: LcuHttpClient,
  puuid: string,
): Promise<{ summaries: any[]; totalGames: number }> {
  const { meta: firstMeta, games: firstGames } = await fetchMatchPage(client, puuid, 0, PAGE_SIZE - 1)
  const totalGames: number = firstMeta.gameCount || 0
  const seenIds = new Set<number>()
  const allSummaries: any[] = []

  for (const g of firstGames) {
    if (!seenIds.has(g.gameId)) {
      seenIds.add(g.gameId)
      allSummaries.push(g)
    }
  }

  // 仅当第一页未覆盖全部 gameCount 时才追页（安全阀，实际极少触发）
  let cursor = PAGE_SIZE
  while (allSummaries.length < totalGames && allSummaries.length < MAX_FETCH_COUNT) {
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

    if (newCount === 0) break
    cursor += PAGE_SIZE
  }

  return { summaries: allSummaries, totalGames }
}

/** 会话级详情缓存：gameId → detail，跨玩家共享，避免重复拉取 */
const gameDetailCache = new Map<number, any>()

/**
 * 批量加载对局详情，返回 gameId → detail 映射。
 * 先查全局缓存，未命中的分批并行拉取（避免并发过高触发 ECONNREFUSED）。
 */
async function loadDetailMap(
  client: LcuHttpClient,
  gameIds: number[],
  label: string,
): Promise<Map<number, any>> {
  const result = new Map<number, any>()
  const uncached: number[] = []

  for (const gid of gameIds) {
    if (gameDetailCache.has(gid)) {
      result.set(gid, gameDetailCache.get(gid)!)
    } else {
      uncached.push(gid)
    }
  }

  const cacheHits = gameIds.length - uncached.length
  let fetchedCount = 0

  for (let i = 0; i < uncached.length; i += DETAIL_CONCUR) {
    const batch = uncached.slice(i, i + DETAIL_CONCUR)
    const fetched = await Promise.all(
      batch.map(gid =>
        client.getGameDetail(gid).catch((err: any) => {
          console.warn(`[LCU:MAIN] 详情 #${gid} 加载失败: ${err.message || err}`)
          return null
        })
      )
    )
    for (const d of fetched) {
      if (d) {
        gameDetailCache.set(d.gameId, d)
        result.set(d.gameId, d)
        fetchedCount++
      }
    }
  }

  console.log(
    `[LCU:MAIN] ${label}: ${result.size}/${gameIds.length} 场 ` +
    `(缓存命中 ${cacheHits}, 新拉取 ${fetchedCount}/${uncached.length}, 缓存池 ${gameDetailCache.size})`
  )
  return result
}

/**
 * 将摘要列表 + 详情映射 + 召唤师信息组装为 MatchListData
 */
function buildMatchListData(
  allSummaries: any[],
  detailMap: Map<number, any>,
  puuid: string,
  summonerInfo: SummonerInfo,
  ranked: RankedData,
  totalGames: number,
): MatchListData {
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

  const withDetail = rawGames.filter(g => g.participants?.length > 0).length
  const withoutDetail = rawGames.length - withDetail
  if (withoutDetail > 0) {
    console.warn(`[LCU:MAIN] buildMatchListData: ${withoutDetail}/${rawGames.length} 场缺少详情数据，好友分析将不完整`)
  }

  rawGames.sort((a, b) => {
    const ta = a.gameCreationDate ? new Date(a.gameCreationDate).getTime() : (a.gameCreation || 0)
    const tb = b.gameCreationDate ? new Date(b.gameCreationDate).getTime() : (b.gameCreation || 0)
    return tb - ta
  })

  const games: GameSummary[] = rawGames.map((g: any) => buildGameSummary(g, puuid))

  return {
    summoner: summonerInfo,
    ranked,
    totalGames: games.length,
    pageSize: 0,
    games,
  }
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

  const [ranked, { summaries, totalGames }] = await Promise.all([
    client.getRankedStats(puuid),
    fetchAllSummaries(client, puuid),
  ])

  console.log(
    `[LCU:MAIN] fetch-match-list: 分页完成 共 ${summaries.length} 场摘要 (API gameCount=${totalGames})`
  )

  const detailMap = await loadDetailMap(client, summaries.map(g => g.gameId), '详情补载')

  const summonerInfo: SummonerInfo = {
    puuid,
    name: summoner.displayName || '',
    level: summoner.summonerLevel || 0,
    region: conn.region,
    platform: conn.rsoPlatformId,
    profileIconId: (summoner as any).profileIconId || 0,
  }

  const result = buildMatchListData(summaries, detailMap, puuid, summonerInfo, extractRankedData(ranked), totalGames)
  console.log(`[LCU:MAIN] fetch-match-list: 最终 ${result.games.length} 场 (API gameCount=${totalGames})`)
  return result
}

/** 从单局数据（摘要或详情）构建 GameSummary */
function buildGameSummary(g: any, selfPuuid: string): GameSummary {
  const participants: any[] = g.participants || []
  const identities: any[] = g.participantIdentities || []

  if (participants.length === 0) {
    console.warn(`[LCU:MAIN] buildGameSummary: gameId=${g.gameId} 无 participants 数据，跳过队友提取`)
  }

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
          items: [0, 1, 2, 3, 4, 5, 6].map((i) => (p.stats || {})[`item${i}`] || 0),
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

  const [ranked, { summaries, totalGames }] = await Promise.all([
    client.getRankedStats(targetPuuid),
    fetchAllSummaries(client, targetPuuid),
  ])

  console.log(
    `[LCU:MAIN] fetchMatchListForPlayer ${summonerName}: ` +
    `分页完成 共 ${summaries.length} 场摘要 gameCount=${totalGames}`
  )

  const detailMap = await loadDetailMap(client, summaries.map(g => g.gameId), `详情补载 (${summonerName})`)

  const summonerInfo: SummonerInfo = {
    puuid: targetPuuid,
    name: summonerName,
    level: summonerLevel,
    region: conn.region,
    platform: conn.rsoPlatformId,
    profileIconId,
  }

  return buildMatchListData(summaries, detailMap, targetPuuid, summonerInfo, extractRankedData(ranked), totalGames)
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
