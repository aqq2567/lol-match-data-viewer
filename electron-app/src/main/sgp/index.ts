/**
 * SGP Manager — 单例，管理 SGP 通道的完整生命周期
 *
 * 职责:
 *   1. 获取并维护 entitlements token（含 401 自动续期）
 *   2. 判断 SGP 是否可用（token 是否就绪）
 *   3. 提供对局数据获取（一次调用出列表 + 详情）
 */
import { SgpClient } from './client'
import { fetchEntitlementsToken } from '../ipc/lcu-handlers'
import { extractGameSummary, extractGameRecord } from './extractor'
import type { GameSummary, GameRecord } from '@shared/types/app'
import type { SgpMatchHistory } from './types'

let _manager: SgpManager | null = null

export class SgpManager {
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
   * 拉取对局列表（含完整详情）。
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
}
