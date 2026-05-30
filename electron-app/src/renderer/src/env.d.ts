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
}

declare global {
  interface Window {
    lcuApi: LcuApi
  }
}

export {}
