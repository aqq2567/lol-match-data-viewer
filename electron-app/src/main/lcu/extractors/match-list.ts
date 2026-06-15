/**
 * 对局列表：分页拉取、详情缓存、摘要组装
 *
 * 两阶段流程:
 *   1. fetchAllSummaries() — 分页拉取对局摘要（去重）
 *   2. loadDetailMap()     — 先查会话级缓存，未命中分批并行拉取
 *   3. buildMatchListData() — 组装为 MatchListData
 */
import { LcuHttpClient } from '../client'
import { DETAIL_CONCUR } from '../concurrency'
import { saveGameSummaries, getRecentGameSummaries } from '../../db/games'
import type {
  MatchListData,
  GameSummary,
  ParticipantBrief,
  TeamStats,
  SummonerInfo,
  RankedData,
} from '@shared/types/app'
import type {
  Game,
  Games,
  Participant,
  ParticipantIdentity,
  Player,
  Stats,
} from '@shared/types/lcu-api'
import { safeInt, extractRankedData } from './extractors'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ═══════════════════════════════════════════════════════════
// 分页常量
// ═══════════════════════════════════════════════════════════

/**
 * 单次 getMatchHistory 请求的 endIndex 范围。
 * endIndex 必须 ≥499 才能触发 LCU 从服务端懒加载（否则仅命中本地缓存 ≈20 场）。
 * 服务端实际返回上限 ≈200 场，超出部分由分页去重逻辑自动跳过。
 */
const PAGE_SIZE = 500
/** 目标拉取的对局总数上限（安全阀，分页在 LCU 返回空时自动停止） */
const MAX_FETCH_COUNT = 1000

// ═══════════════════════════════════════════════════════════
// 分页拉取
// ═══════════════════════════════════════════════════════════

/**
 * 拉取一页对局摘要
 * 国服 (TENCENT) 使用 begIndex（缩写），Riot 服可能使用 beginIndex（完整拼写）
 * begIndex 有时只命中 LCU 本地缓存（~20 场），beginIndex 可触发服务端拉取（~200 场）
 * 因此两者都试，取结果更多的一方。
 */
async function fetchMatchPage(
  client: LcuHttpClient,
  puuid: string,
  beg: number,
  end: number,
): Promise<{ meta: Games; games: Game[] }> {
  let bestMeta: Games = {} as Games
  let bestGames: Game[] = []

  // begIndex（国服缩写参数）—— 国际服也兼容此参数
  const doFetch = () => client.getMatchHistory(puuid, beg, end)

  try {
    const page = await doFetch()
    bestGames = page?.games?.games || []
    bestMeta = page?.games || ({} as Games)
  } catch (err: unknown) {
    const msg = errMsg(err)
    if (/status code 5\d\d/.test(msg)) {
      console.warn(`[LCU:MAIN] begIndex 请求失败 (${msg}), 等待 3 秒后重试...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
      try {
        const page = await doFetch()
        bestGames = page?.games?.games || []
        bestMeta = page?.games || ({} as Games)
        console.log(`[LCU:MAIN] begIndex 重试成功: ${bestGames.length} 场`)
      } catch (retryErr: unknown) {
        console.warn(`[LCU:MAIN] begIndex 重试失败 (${errMsg(retryErr)})`)
      }
    } else {
      console.warn(`[LCU:MAIN] begIndex 请求失败 (${msg})`)
    }
  }

  return { meta: bestMeta, games: bestGames }
}

/**
 * 分页拉取指定玩家全部对局摘要（含去重）。
 * 先从第一页获取 gameCount，按需串行追加后续分页。
 * LCU 单玩家上限 ~200，PAGE_SIZE=500 一页即可覆盖，后续分页为安全阀。
 */
async function fetchAllSummaries(
  client: LcuHttpClient,
  puuid: string,
): Promise<{ summaries: Game[]; totalGames: number }> {
  // beginIndex 请求触发 LCU 服务端懒加载（国服返回 400 但副作用生效），
  // begIndex 请求拿数据。两者并行——暖缓存下 begIndex 直接返回完整数据，无额外延迟。
  const [firstResult] = await Promise.all([
    fetchMatchPage(client, puuid, 0, PAGE_SIZE - 1),
    client.triggerServerSync(puuid, 0, PAGE_SIZE - 1),
  ])
  let { meta: firstMeta, games: firstGames } = firstResult

  // 首次拉取仅返回本地缓存（实测 ~21 场），等待后台同步完成后重试
  if (firstGames.length > 0 && firstGames.length < 50) {
    const prevCount = firstGames.length
    console.warn(
      `[LCU:MAIN] 第一页仅 ${prevCount} 场 (gameCount=${firstMeta.gameCount})，` +
      `等待 LCU 服务端同步 (3s)...`
    )
    await new Promise(resolve => setTimeout(resolve, 3000))
    const retry = await fetchMatchPage(client, puuid, 0, PAGE_SIZE - 1)
    if (retry.games.length > firstGames.length) {
      console.log(
        `[LCU:MAIN] 第一页重试成功: ${retry.games.length} 场 (之前 ${prevCount} 场, gameCount=${retry.meta.gameCount})`
      )
      firstMeta = retry.meta
      firstGames = retry.games
    }
  }

  const totalGames: number = firstMeta.gameCount || 0
  const seenIds = new Set<number>()
  const allSummaries: Game[] = []

  for (const g of firstGames) {
    if (!seenIds.has(g.gameId)) {
      seenIds.add(g.gameId)
      allSummaries.push(g)
    }
  }

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

// ═══════════════════════════════════════════════════════════
// 详情缓存
// ═══════════════════════════════════════════════════════════

const MAX_CACHE_SIZE = 500

/** 会话级详情缓存：gameId → detail，跨玩家共享，避免重复拉取。超出上限时驱逐最旧条目 */
const gameDetailCache = new Map<number, Game>()

/**
 * 批量加载对局详情，返回 gameId → detail 映射。
 * 先查全局缓存，未命中的分批并行拉取（避免并发过高触发 ECONNREFUSED）。
 */
async function loadDetailMap(
  client: LcuHttpClient,
  gameIds: number[],
  label: string,
): Promise<Map<number, Game>> {
  const result = new Map<number, Game>()
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
        client.getGameDetail(gid).catch((err: unknown) => {
          console.warn(`[LCU:MAIN] 详情 #${gid} 加载失败: ${errMsg(err)}`)
          return null
        })
      )
    )
    for (const d of fetched) {
      if (d) {
        gameDetailCache.set(d.gameId, d)
        if (gameDetailCache.size > MAX_CACHE_SIZE) {
          gameDetailCache.delete(gameDetailCache.keys().next().value)
        }
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

// ═══════════════════════════════════════════════════════════
// GameSummary 构建
// ═══════════════════════════════════════════════════════════

/** 从单局数据（摘要或详情）构建 GameSummary */
function buildGameSummary(g: Game, selfPuuid: string): GameSummary {
  const participants: Participant[] = g.participants || []
  const identities: ParticipantIdentity[] = g.participantIdentities || []

  if (participants.length === 0) {
    console.warn(`[LCU:MAIN] buildGameSummary: gameId=${g.gameId} 无 participants 数据，跳过队友提取`)
  }

  // 构建参与者身份映射 participantId → player
  const idMap: Record<number, Player> = {}
  for (const pi of identities) {
    idMap[pi.participantId] = pi.player || ({} as Player)
  }

  // 找到当前召唤师对应的参与者
  const selfP =
    participants.find((p: Participant) => {
      const player = idMap[p.participantId]
      return player?.puuid === selfPuuid
    }) || participants[0] || ({} as Participant)

  const stats = selfP.stats || {}
  const kills = safeInt(stats.kills)
  const deaths = safeInt(stats.deaths)
  const assists = safeInt(stats.assists)

  const teamStats = computeTeamStats(participants, selfP, stats, kills, assists)

  // 从 teams 数组中获取真实队伍 ID
  const teamsArr = g.teams || []
  const blueTeamId = teamsArr.length >= 2
    ? (teamsArr[0].teamId === 100 ? 100 : teamsArr[1].teamId === 100 ? 100 : teamsArr[0].teamId)
    : 100
  const redTeamId = teamsArr.length >= 2
    ? (teamsArr[0].teamId === 200 ? 200 : teamsArr[1].teamId === 200 ? 200 : teamsArr[1].teamId)
    : 200

  return {
    gameId: g.gameId,
    gameMode: g.gameMode || '',
    gameType: g.gameType || '',
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
    blueParticipants: buildBrief(participants, idMap, blueTeamId),
    redParticipants: buildBrief(participants, idMap, redTeamId),
    teamStats,
  }
}

function computeTeamStats(
  participants: Participant[],
  selfP: Participant,
  stats: Stats,
  kills: number,
  assists: number,
): TeamStats {
  const selfTeamId = selfP.teamId
  const teamPlayers = participants.filter((p: Participant) => p.teamId === selfTeamId)

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

function buildBrief(
  participants: Participant[],
  idMap: Record<number, Player>,
  teamId: number,
): ParticipantBrief[] {
  return participants
    .filter((p: Participant) => p.teamId === teamId)
    .map((p: Participant) => {
      const player = idMap[p.participantId] || ({} as Player)
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

// ═══════════════════════════════════════════════════════════
// 组装 + 公开 API
// ═══════════════════════════════════════════════════════════

function buildMatchListData(
  allSummaries: Game[],
  detailMap: Map<number, Game>,
  puuid: string,
  summonerInfo: SummonerInfo,
  ranked: RankedData,
  totalGames: number,
): MatchListData {
  const rawGames = allSummaries.map(g => {
    const detail = detailMap.get(g.gameId)
    if (detail) {
      const sType = g.gameType || '(空)'
      const dType = detail.gameType || '(空)'
      if (sType !== dType && (dType === 'CUSTOM_GAME' || sType === 'CUSTOM_GAME')) {
        console.log(
          `[LCU:MAIN] DIAG gameType 差异 #${g.gameId}: ` +
          `摘要=[${sType}] 详情=[${dType}] gameMode=[${detail.gameMode || g.gameMode}]`
        )
      }
      return {
        ...g,
        gameType: detail.gameType || g.gameType || '',
        gameMode: detail.gameMode || g.gameMode || '',
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

  const games: GameSummary[] = rawGames.map((g: Game) => buildGameSummary(g, puuid))

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
    region: client.region,
    platform: client.rsoPlatformId,
    profileIconId: summoner.profileIconId || 0,
  }

  const result = buildMatchListData(summaries, detailMap, puuid, summonerInfo, extractRankedData(ranked), totalGames)
  console.log(`[LCU:MAIN] fetch-match-list: 最终 ${result.games.length} 场 (API gameCount=${totalGames})`)

  try { saveGameSummaries(puuid, result.games) } catch { /* 写入失败静默降级 */ }

  return result
}

export async function fetchMatchListForPlayer(
  client: LcuHttpClient,
  targetPuuid: string,
  summonerName: string,
  profileIconId: number,
  summonerLevel: number,
  _page: number = 1,
  _pageSize: number = 20
): Promise<MatchListData> {
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
    region: client.region,
    platform: client.rsoPlatformId,
    profileIconId,
  }

  const result = buildMatchListData(summaries, detailMap, targetPuuid, summonerInfo, extractRankedData(ranked), totalGames)

  // LCU 摘要 API 对不同玩家返回的对局可能不一致（非当前玩家可能缺失部分对局）。
  // 从共享详情缓存中查找目标玩家参与但未出现在摘要中的对局，补入结果。
  {
    const existingIds = new Set(result.games.map(g => g.gameId))
    let injected = 0
    for (const [gameId, detail] of gameDetailCache) {
      if (existingIds.has(gameId)) continue
      const identities: Record<number, Player> = {}
      for (const pi of detail.participantIdentities || []) {
        identities[pi.participantId] = pi.player || ({} as Player)
      }
      const isParticipant = (detail.participants || []).some((p: Participant) => {
        const player = identities[p.participantId]
        return player?.puuid === targetPuuid
      })
      if (isParticipant) {
        result.games.push(buildGameSummary(detail, targetPuuid))
        injected++
      }
    }
    if (injected > 0) {
      result.games.sort((a, b) => b.gameCreation - a.gameCreation)
      const MAX_GAMES = 200
      if (result.games.length > MAX_GAMES) {
        const trimmed = result.games.length - MAX_GAMES
        result.games = result.games.slice(0, MAX_GAMES)
        result.totalGames = MAX_GAMES
        console.log(
          `[LCU:MAIN] fetchMatchListForPlayer ${summonerName}: ` +
          `从缓存注入 ${injected} 场, 截断 ${trimmed} 场, 最终 ${MAX_GAMES} 场`
        )
      } else {
        result.totalGames = result.games.length
        console.log(
          `[LCU:MAIN] fetchMatchListForPlayer ${summonerName}: ` +
          `从缓存注入 ${injected} 场, 最终 ${result.games.length} 场`
        )
      }
    }
  }

  // 持久化：写入本地 DB
  try {
    saveGameSummaries(targetPuuid, result.games)
  } catch {
    // 写入失败静默降级——数据已在内存中，不影响当前显示
  }

  return result
}
