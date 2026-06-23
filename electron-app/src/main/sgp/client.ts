/**
 * SGP HTTP 客户端
 *
 * 封装对 Riot SGP API 的 HTTPS 请求。
 * 使用 axios，需要运行时注入 entitlements token（Bearer auth）。
 * 参考 LeagueAkari LeagueSgpApi 实现。
 */

import axios, { AxiosInstance } from 'axios'
import { resolveSgpBaseUrl, getSgpSubId } from './config'
import type { SgpMatchHistory } from './types'

export class SgpClient {
  static USER_AGENT = 'LeagueOfLegendsClient/14.13.596.7996 (rcp-be-lol-match-history)'
  static TIMEOUT = 12500

  private _baseUrl: string
  private _subId: string
  private _token: string | null = null
  private _http: AxiosInstance
  private _onTokenExpired: (() => Promise<string | null>) | null = null

  constructor(rsoPlatformId: string) {
    this._baseUrl = resolveSgpBaseUrl(rsoPlatformId)
    this._subId = getSgpSubId(rsoPlatformId)

    this._http = axios.create({
      headers: { 'User-Agent': SgpClient.USER_AGENT },
      timeout: SgpClient.TIMEOUT,
    })
  }

  get baseUrl(): string { return this._baseUrl }
  get hasToken(): boolean { return this._token !== null }

  setToken(token: string | null): void {
    this._token = token
  }

  /** 注册 token 过期回调 — 返回新 token 或 null（续期失败） */
  onTokenExpired(fn: () => Promise<string | null>): void {
    this._onTokenExpired = fn
  }

  /** 拉取对局历史（含完整详情，一次调用出列表+全部参与者数据） */
  async getMatchHistory(puuid: string, start: number, count: number): Promise<SgpMatchHistory> {
    if (!this._token) throw new Error('SGP token not set')

    return this._request<SgpMatchHistory>(() =>
      this._http.get<SgpMatchHistory>(
        `/match-history-query/v1/products/lol/player/${puuid}/SUMMARY`,
        {
          baseURL: this._baseUrl,
          headers: { Authorization: `Bearer ${this._token}` },
          params: { startIndex: start, count },
        }
      )
    )
  }

  /** 统一请求包装：401 自动续期重试 1 次 */
  private async _request<T>(fn: () => Promise<{ data: T; status: number }>): Promise<T> {
    try {
      const resp = await fn()
      return resp.data
    } catch (err: any) {
      const status = err?.response?.status || 0
      if (status === 401 && this._onTokenExpired) {
        const newToken = await this._onTokenExpired()
        if (newToken) {
          this._token = newToken
          const retryResp = await fn()
          return retryResp.data
        }
      }
      throw err
    }
  }
}
