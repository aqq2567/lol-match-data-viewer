/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** LCU API 桥接对象（由 preload 注入） */
interface LcuApi {
  log(level: 'log' | 'warn' | 'error', ...args: any[]): void
  checkConnection(): Promise<import('@shared/types').LcuConnectionInfo | null>
  getCurrentSummoner(): Promise<import('@shared/types').LcuSummoner>
  fetchMatchList(page?: number, pageSize?: number): Promise<import('@shared/types').MatchListData>
  lookupSummoner(query: { summonerId?: number; name?: string; puuid?: string }): Promise<import('@shared/types').LcuSummoner>
  fetchPlayerMatchList(targetPuuid: string, summonerName: string, profileIconId: number, summonerLevel: number, page?: number, pageSize?: number): Promise<import('@shared/types').MatchListData>
  fetchGameDetails(gameIds: number[]): Promise<import('@shared/types').GameRecord[]>
  fetchMatches(gameCount?: number): Promise<import('@shared/types').MatchData>
  fetchGame(gameId: number): Promise<any>
  fetchGameData(): Promise<import('@shared/types').GameDataCache>
  onUpdateStatus(callback: (status: any) => void): () => void
  quitAndInstall(): void
  checkForUpdates(): Promise<any>
  getSettings<T = any>(): Promise<T>
  setSetting(key: string, value: any): Promise<void>
  openLogsDir(): Promise<void>
  openExternal(url: string): Promise<void>
  chatWithAI(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }>
  loadRecentGames(puuid: string, limit: number): Promise<import('@shared/types').GameSummary[]>
  loadGameDetail(gameId: number): Promise<any>
  saveGameDetail(gameId: number, detail: any): Promise<void>
  loadGameCount(puuid: string): Promise<number>
  getDailyGames(puuid: string, date: string): Promise<any[]>
  getRecentDates(puuid: string, limit: number): Promise<string[]>
  sgpInit(rsoPlatformId: string): Promise<boolean>
  sgpDestroy(): Promise<void>
  publishDashboard(data: import('@shared/types').DashboardData): Promise<{ status: string; url?: string; message?: string }>
}

declare global {
  interface Window {
    lcuApi: LcuApi
  }
}

export {}
