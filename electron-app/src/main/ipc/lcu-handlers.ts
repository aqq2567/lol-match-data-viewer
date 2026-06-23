/**
 * LCU 相关 IPC 处理器注册
 * 从 main/index.ts 中提取，保持 index.ts 仅负责应用入口和生命周期
 */
import { ipcMain } from 'electron'
import { findLolClient, LcuHttpClient } from '../lcu/client'
import {
  fetchAllMatchData,
  fetchMatchList,
  fetchMatchListForPlayer,
  fetchGameDetailsBatched,
  fetchGameData,
} from '../lcu/extractors'
import type { LcuConnectionInfo, MatchData, MatchListData, GameRecord, GameDataCache, LcuSummoner } from '@shared/types'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 获取 SGP entitlements token (JWT) 用于后续 SGP API 调用的 Bearer 认证
 */
export async function fetchEntitlementsToken(): Promise<string | null> {
  try {
    const conn = await findLolClient()
    if (!conn) {
      console.warn('[SGP] No LCU connection — cannot fetch entitlements token')
      return null
    }

    const client = new LcuHttpClient(conn)
    const resp = await client.get<{ accessToken: string; token: string; subject: string }>(
      '/entitlements/v1/token'
    )
    const token = resp?.accessToken || ''
    if (token) {
      console.log('[SGP] entitlements token acquired')
    } else {
      console.warn('[SGP] entitlements token response had no accessToken field')
    }
    return token || null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[SGP] Failed to fetch entitlements token: ${msg}`)
    return null
  }
}

export interface LcuHandlersContext {
  /** 保留空接口便于后续扩展 */
}

export function registerLcuHandlers(ctx: LcuHandlersContext = {}) {
  const ERR_NO_CLIENT = '未找到运行中的 LOL 客户端。请确保 League of Legends 客户端正在运行。'

  /** 自动连接 → 创建客户端 → 执行业务逻辑，失败时统一抛出 */
  async function withClient<T>(fn: (client: LcuHttpClient) => Promise<T>): Promise<T> {
    const conn = await findLolClient()
    if (!conn) throw new Error(ERR_NO_CLIENT)
    return fn(new LcuHttpClient(conn))
  }

  // 检查 LCU 连接状态（特殊：不抛异常，返回 null）
  ipcMain.handle('lcu:check-connection', async (): Promise<LcuConnectionInfo | null> => {
    console.log('[LCU:MAIN] check-connection 被调用')
    const conn = await findLolClient()
    if (conn) {
      console.log(`[LCU:MAIN] 找到 LCU: port=${conn.port}, region=${conn.region}`)
    } else {
      console.log('[LCU:MAIN] 未找到运行中的 LCU 客户端')
    }
    return conn
  })

  // 获取当前召唤师信息
  ipcMain.handle('lcu:current-summoner', async (): Promise<LcuSummoner> => {
    console.log('[LCU:MAIN] current-summoner 被调用')
    return withClient(client => client.getCurrentSummoner())
  })

  // 拉取全部对局数据（旧版，较重）
  ipcMain.handle('lcu:fetch-matches', async (_event, gameCount: number): Promise<MatchData> =>
    withClient(client => fetchAllMatchData(client, gameCount))
  )

  // 按 ID 获取单局详情
  ipcMain.handle('lcu:fetch-game', async (_event, gameId: number): Promise<any> =>
    withClient(async client => {
      console.log(`[LCU:MAIN] fetch-game: gameId=${gameId}`)
      const detail = await client.getGameDetail(gameId)
      if (!detail) console.warn(`[LCU:MAIN] fetch-game: 对局 #${gameId} 返回空数据`)
      const identities: Record<number, any> = {}
      for (const pi of detail?.participantIdentities || []) {
        identities[pi.participantId] = pi.player || {}
      }
      return { detail, identities }
    })
  )

  // 拉取对局列表（轻量，仅摘要，支持分页）
  ipcMain.handle(
    'lcu:fetch-match-list',
    async (_event, page: number, pageSize: number): Promise<MatchListData> => {
      console.log(`[LCU:MAIN] fetch-match-list 被调用: page=${page}, pageSize=${pageSize}`)
      try {
        const data = await withClient(client => fetchMatchList(client, page, pageSize))
        console.log(`[LCU:MAIN] fetch-match-list 完成: ${data.games.length} 场对局`)
        return data
      } catch (err: unknown) {
        console.error(`[LCU:MAIN] fetch-match-list 异常: ${errMsg(err)}`)
        throw err
      }
    }
  )

  // 批量拉取对局详情（并发，用于分析）
  ipcMain.handle(
    'lcu:fetch-game-details',
    async (_event, gameIds: number[]): Promise<GameRecord[]> => {
      console.log(`[LCU:MAIN] fetch-game-details: ${gameIds.length} 场, ids=[${gameIds.slice(0, 5).join(',')}${gameIds.length > 5 ? '...' : ''}]`)
      const results = await withClient(client => fetchGameDetailsBatched(client, gameIds))
      console.log(`[LCU:MAIN] fetch-game-details 完成: ${results.length}/${gameIds.length} 场`)
      return results
    }
  )

  // 通过召唤师 ID/名字/PUUID 查询任意玩家
  ipcMain.handle(
    'lcu:lookup-summoner',
    async (_event, query: { summonerId?: number; name?: string; puuid?: string }): Promise<LcuSummoner> => {
      console.log(`[LCU:MAIN] lookup-summoner: ${query.summonerId ? `id=${query.summonerId}` : query.name ? `name=${query.name}` : `puuid=${query.puuid?.slice(0, 8)}…`}`)
      return withClient(client => {
        if (query.summonerId) return client.getSummonerById(query.summonerId)
        if (query.name) return client.getSummonerByName(query.name)
        if (query.puuid) return client.getSummonerByPuuid(query.puuid)
        throw new Error('请提供 summonerId、name 或 puuid')
      })
    }
  )

  // 以指定 PUUID 拉取对局列表（查询其他玩家）
  ipcMain.handle(
    'lcu:fetch-player-match-list',
    async (_event, targetPuuid: string, summonerName: string, profileIconId: number, summonerLevel: number, page: number, pageSize: number): Promise<MatchListData> => {
      console.log(`[LCU:MAIN] fetch-player-match-list: puuid=${targetPuuid.slice(0, 8)}… name=${summonerName}, page=${page}`)
      return withClient(client => fetchMatchListForPlayer(client, targetPuuid, summonerName, profileIconId, summonerLevel, page, pageSize))
    }
  )

  // 拉取游戏基础数据（英雄、装备、技能、符文等，含 iconPath）
  ipcMain.handle('lcu:fetch-game-data', async (): Promise<GameDataCache> => {
    console.log('[LCU:MAIN] fetch-game-data 被调用')
    try {
      const data = await withClient(client => fetchGameData(client))
      console.log(`[LCU:MAIN] fetch-game-data 完成: ${Object.keys(data.champions).length} 英雄, ${Object.keys(data.items).length} 装备, ${Object.keys(data.summonerSpells).length} 技能, ${Object.keys(data.augments).length} 增幅`)
      return data
    } catch (err: unknown) {
      console.error(`[LCU:MAIN] fetch-game-data 异常: ${errMsg(err)}`)
      throw err
    }
  })

  // 获取 SGP entitlements token（JWT Bearer 凭证）
  ipcMain.handle('sgp:entitlements-token', async (): Promise<string | null> => {
    return fetchEntitlementsToken()
  })

  // After LCU connection is established, try to init SGP
  ipcMain.handle('sgp:init', async (_event, rsoPlatformId: string): Promise<boolean> => {
    const { SgpManager } = await import('../sgp')
    return SgpManager.instance.init(rsoPlatformId)
  })

  ipcMain.handle('sgp:destroy', async (): Promise<void> => {
    const { SgpManager } = await import('../sgp')
    SgpManager.instance.destroy()
  })

  // ═══════════════════════════════════════════════════════════
  // DB 持久化 IPC
  // ═══════════════════════════════════════════════════════════

  ipcMain.handle('db:recent-games', async (_event, puuid: string, limit: number) => {
    const { getRecentGameSummaries } = await import('../db/games')
    return getRecentGameSummaries(puuid, limit)
  })

  ipcMain.handle('db:game-detail', async (_event, gameId: number) => {
    const { getGameDetail } = await import('../db/games')
    return getGameDetail(gameId)
  })

  ipcMain.handle('db:save-game-detail', async (_event, gameId: number, detail: any) => {
    const { saveGameDetail } = await import('../db/games')
    saveGameDetail(gameId, detail)
  })

  ipcMain.handle('db:game-count', async (_event, puuid: string) => {
    const { getGameSummaryCount } = await import('../db/games')
    return getGameSummaryCount(puuid)
  })

  ipcMain.handle('db:daily-games', async (_event, puuid: string, date: string) => {
    const { getDailyGames } = await import('../db/games')
    return getDailyGames(puuid, date)
  })

  ipcMain.handle('db:recent-dates', async (_event, puuid: string, limit: number) => {
    const { getRecentDates } = await import('../db/games')
    return getRecentDates(puuid, limit)
  })
}
