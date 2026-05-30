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
} from '../lcu/extractor'
import type { LcuConnectionInfo, MatchData, MatchListData, GameRecord, GameDataCache, LcuSummoner } from '@shared/types'

export interface LcuHandlersContext {
  /** 当 check-connection 发现 LCU 时回调，用于缓存认证信息给 lcu-asset 协议代理 */
  onConnectionFound?: (conn: LcuConnectionInfo) => void
}

export function registerLcuHandlers(ctx: LcuHandlersContext = {}) {
  // 检查 LCU 连接状态（同时通知外部缓存认证信息）
  ipcMain.handle('lcu:check-connection', async (): Promise<LcuConnectionInfo | null> => {
    console.log('[LCU:MAIN] check-connection 被调用')
    const conn = await findLolClient()
    if (conn) {
      console.log(`[LCU:MAIN] 找到 LCU: port=${conn.port}, region=${conn.region}`)
      ctx.onConnectionFound?.(conn)
    } else {
      console.log('[LCU:MAIN] 未找到运行中的 LCU 客户端')
    }
    return conn
  })

  // 获取当前召唤师信息
  ipcMain.handle('lcu:current-summoner', async (): Promise<LcuSummoner> => {
    console.log('[LCU:MAIN] current-summoner 被调用')
    const conn = await findLolClient()
    if (!conn) throw new Error('未找到运行中的 LOL 客户端')
    const client = new LcuHttpClient(conn)
    return client.getCurrentSummoner()
  })

  // 拉取全部对局数据（旧版，较重）
  ipcMain.handle('lcu:fetch-matches', async (_event, gameCount: number): Promise<MatchData> => {
    const conn = await findLolClient()
    if (!conn) {
      throw new Error('未找到运行中的 LOL 客户端。请确保 League of Legends 客户端正在运行。')
    }
    const client = new LcuHttpClient(conn)
    const { matchData } = await fetchAllMatchData(client, gameCount)
    return matchData
  })

  // 按 ID 获取单局详情
  ipcMain.handle('lcu:fetch-game', async (_event, gameId: number): Promise<any> => {
    console.log(`[LCU:MAIN] fetch-game: gameId=${gameId}`)
    const conn = await findLolClient()
    if (!conn) {
      console.error(`[LCU:MAIN] fetch-game 失败：未找到 LCU 客户端`)
      throw new Error('未找到运行中的 LOL 客户端')
    }
    const client = new LcuHttpClient(conn)
    const detail = await client.getGameDetail(gameId)
    if (!detail) {
      console.warn(`[LCU:MAIN] fetch-game: 对局 #${gameId} 返回空数据`)
    }
    const identities: Record<number, any> = {}
    for (const pi of detail?.participantIdentities || []) {
      identities[pi.participantId] = pi.player || {}
    }
    return { detail, identities }
  })

  // 拉取对局列表（轻量，仅摘要，支持分页）
  ipcMain.handle(
    'lcu:fetch-match-list',
    async (_event, page: number, pageSize: number): Promise<MatchListData> => {
      console.log(`[LCU:MAIN] fetch-match-list 被调用: page=${page}, pageSize=${pageSize}`)
      const conn = await findLolClient()
      if (!conn) {
        console.error('[LCU:MAIN] fetch-match-list 失败：未找到 LCU 客户端')
        throw new Error('未找到运行中的 LOL 客户端。请确保 League of Legends 客户端正在运行。')
      }
      try {
        const client = new LcuHttpClient(conn)
        const data = await fetchMatchList(client, page, pageSize)
        console.log(`[LCU:MAIN] fetch-match-list 完成: ${data.games.length} 场对局`)
        return data
      } catch (err: any) {
        console.error(`[LCU:MAIN] fetch-match-list 异常: ${err.message || err}`)
        throw err
      }
    }
  )

  // 批量拉取对局详情（并发，用于分析）
  ipcMain.handle(
    'lcu:fetch-game-details',
    async (_event, gameIds: number[]): Promise<GameRecord[]> => {
      console.log(`[LCU:MAIN] fetch-game-details: ${gameIds.length} 场, ids=[${gameIds.slice(0, 5).join(',')}${gameIds.length > 5 ? '...' : ''}]`)
      const conn = await findLolClient()
      if (!conn) {
        console.error('[LCU:MAIN] fetch-game-details 失败：未找到 LCU 客户端')
        throw new Error('未找到运行中的 LOL 客户端')
      }
      const client = new LcuHttpClient(conn)
      const results = await fetchGameDetailsBatched(client, gameIds)
      console.log(`[LCU:MAIN] fetch-game-details 完成: ${results.length}/${gameIds.length} 场`)
      return results
    }
  )

  // 通过召唤师 ID/名字/PUUID 查询任意玩家
  ipcMain.handle(
    'lcu:lookup-summoner',
    async (_event, query: { summonerId?: number; name?: string; puuid?: string }): Promise<LcuSummoner> => {
      console.log(`[LCU:MAIN] lookup-summoner: ${query.summonerId ? `id=${query.summonerId}` : query.name ? `name=${query.name}` : `puuid=${query.puuid?.slice(0, 8)}…`}`)
      const conn = await findLolClient()
      if (!conn) throw new Error('未找到运行中的 LOL 客户端')
      const client = new LcuHttpClient(conn)
      if (query.summonerId) return client.getSummonerById(query.summonerId)
      if (query.name) return client.getSummonerByName(query.name)
      if (query.puuid) return client.getSummonerByPuuid(query.puuid)
      throw new Error('请提供 summonerId、name 或 puuid')
    }
  )

  // 以指定 PUUID 拉取对局列表（查询其他玩家）
  ipcMain.handle(
    'lcu:fetch-player-match-list',
    async (_event, targetPuuid: string, summonerName: string, profileIconId: number, summonerLevel: number, page: number, pageSize: number): Promise<MatchListData> => {
      console.log(`[LCU:MAIN] fetch-player-match-list: puuid=${targetPuuid.slice(0, 8)}… name=${summonerName}, page=${page}`)
      const conn = await findLolClient()
      if (!conn) throw new Error('未找到运行中的 LOL 客户端')
      const client = new LcuHttpClient(conn)
      return fetchMatchListForPlayer(client, targetPuuid, summonerName, profileIconId, summonerLevel, page, pageSize)
    }
  )

  // 拉取游戏基础数据（英雄、装备、技能、符文等，含 iconPath）
  ipcMain.handle('lcu:fetch-game-data', async (): Promise<GameDataCache> => {
    console.log('[LCU:MAIN] fetch-game-data 被调用')
    const conn = await findLolClient()
    if (!conn) {
      console.error('[LCU:MAIN] fetch-game-data 失败：未找到 LCU 客户端')
      throw new Error('未找到运行中的 LOL 客户端')
    }
    try {
      const client = new LcuHttpClient(conn)
      const data = await fetchGameData(client)
      console.log(`[LCU:MAIN] fetch-game-data 完成: ${Object.keys(data.champions).length} 英雄, ${Object.keys(data.items).length} 装备, ${Object.keys(data.summonerSpells).length} 技能, ${Object.keys(data.augments).length} 增幅`)
      return data
    } catch (err: any) {
      console.error(`[LCU:MAIN] fetch-game-data 异常: ${err.message || err}`)
      throw err
    }
  })
}
