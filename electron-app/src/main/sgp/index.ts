/**
 * SGP Manager — 单例，管理 SGP 通道的完整生命周期
 *
 * 职责:
 *   1. 获取并维护 entitlements token（含 401 自动续期）
 *   2. 判断 SGP 是否可用（token 是否就绪）
 *   3. 提供对局数据获取（单次请求 + 自动分页）
 *
 * 依赖方向: sgp/index.ts → sgp/token.ts → lcu/client.ts（单向，无循环）
 */
import { SgpClient } from './client'
import { fetchEntitlementsToken } from './token'
import { extractGameSummary, extractGameRecord } from './extractor'
import type { GameSummary, GameRecord } from '@shared/types/app'
import type { SgpMatchHistory } from './types'

let _manager: SgpManager | null = null

export class SgpManager {
  /** 单次请求最大场数（避免超过服务端限制，LeagueAkari 同样封顶 200） */
  static readonly PAGE_SIZE = 200
  /** 目标拉取上限（用户体验限制，非 API 硬限制） */
  static readonly MAX_GAMES = 500

  private _client: SgpClient | null = null
  private _available: boolean = false

  static get instance(): SgpManager {
    if (!_manager) _manager = new SgpManager()
    return _manager
  }

  get available(): boolean { return this._available }

  /** 初始化：获取 token，创建 client */
  async init(rsoPlatformId: string): Promise<boolean> {
    const token = await fetchEntitlementsToken()
    if (!token) {
      console.warn('[SGP] init failed — no entitlements token, falling back to LCU')
      this._available = false
      return false
    }

    this._client = new SgpClient(rsoPlatformId)
    this._client.setToken(token)
    this._client.onTokenExpired(async () => {
      console.log('[SGP] token expired, attempting refresh...')
      const newToken = await fetchEntitlementsToken()
      if (!newToken) {
        console.warn('[SGP] token refresh failed, falling back to LCU')
        this._available = false
      }
      return newToken
    })
    this._available = true
    console.log('[SGP] initialized successfully')
    return true
  }

  /** 销毁：清空 token + 标记不可用 */
  destroy(): void {
    this._client?.setToken(null)
    this._client = null
    this._available = false
  }

  /**
   * 拉取一页对局（含完整详情）。
   * SGP 一次调用返回完整 Participants，因此同时产出 GameSummary[] 和 GameRecord[]。
   */
  async fetchGames(puuid: string, start: number, count: number): Promise<{
    summaries: GameSummary[]
    records: GameRecord[]
    raw: SgpMatchHistory
  }> {
    if (!this._client || !this._available) {
      throw new Error('SGP not available')
    }

    const raw = await this._client.getMatchHistory(puuid, start, count)

    const games = raw.games || []
    const summaries: GameSummary[] = []
    const records: GameRecord[] = []

    for (const game of games) {
      if (!game.json) continue  // metadata-only entry, skip
      try {
        summaries.push(extractGameSummary(game, puuid))
        records.push(extractGameRecord(game))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[SGP] Failed to extract game #${game.json?.gameId}: ${msg}`)
      }
    }

    return { summaries, records, raw }
  }

  /**
   * 分页拉取对局，突破单次请求上限。
   * 循环请求直到达到 maxGames 或 SGP 返回空列表。
   * SGP 无 gameCount 字段，只能拉到空为止。
   */
  async fetchGamesPaginated(
    puuid: string,
    maxGames: number = SgpManager.MAX_GAMES,
  ): Promise<{ summaries: GameSummary[]; records: GameRecord[] }> {
    const allSummaries: GameSummary[] = []
    const allRecords: GameRecord[] = []
    let start = 0
    let page = 0

    while (allSummaries.length < maxGames) {
      page++
      const count = Math.min(SgpManager.PAGE_SIZE, maxGames - allSummaries.length)
      console.log(`[SGP:PAGE] 第 ${page} 页: startIndex=${start} count=${count}`)
      const { summaries, records } = await this.fetchGames(puuid, start, count)
      console.log(`[SGP:PAGE] 第 ${page} 页返回: ${summaries.length} 场 (累计 ${allSummaries.length + summaries.length})`)
      if (summaries.length === 0) break
      allSummaries.push(...summaries)
      allRecords.push(...records)
      start += count
      if (summaries.length < count) {
        console.log(`[SGP:PAGE] 返回 ${summaries.length} < 请求 ${count}，已到末页，停止分页`)
        break
      }
    }

    console.log(`[SGP:PAGE] 分页完成: ${page} 页共 ${allSummaries.length} 场`)
    return { summaries: allSummaries, records: allRecords }
  }
}
