/**
 * 应用层 — 端口定义
 *
 * 应用层通过这些接口访问基础设施，不直接依赖 Electron / window.lcuApi。
 * MatchRepository 用业务语义命名（findXxx），不暴露底层是 LCU 还是 SGP。
 */

import type { GameRecord, GameDataCache, LcuConnectionInfo, LcuSummoner, MatchListData } from '@shared/types'

// ═══════════════════════════════════════════════════════════
// MatchRepository — 对局数据访问
// ═══════════════════════════════════════════════════════════

export interface MatchRepository {
  findByIds(ids: number[]): Promise<GameRecord[]>
  findCurrentSummonerMatches(page?: number, pageSize?: number): Promise<MatchListData>
  findPlayerMatches(
    puuid: string,
    summonerName: string,
    profileIconId: number,
    summonerLevel: number,
    page?: number,
    pageSize?: number,
  ): Promise<MatchListData>
}

/**
 * 将 window.lcuApi（LCU 语义方法名）适配为 MatchRepository（业务语义方法名）。
 * 这是应用层唯一的 LCU→业务 名字映射点——未来换 SGP 时，只需新建一个 SGP 版实现。
 */
export function createMatchRepository(raw: {
  fetchGameDetails(gameIds: number[]): Promise<GameRecord[]>
  fetchMatchList(page?: number, pageSize?: number): Promise<MatchListData>
  fetchPlayerMatchList(
    targetPuuid: string,
    summonerName: string,
    profileIconId: number,
    summonerLevel: number,
    page?: number,
    pageSize?: number,
  ): Promise<MatchListData>
}): MatchRepository {
  return {
    findByIds: (ids) => raw.fetchGameDetails(ids),
    findCurrentSummonerMatches: (page, pageSize) => raw.fetchMatchList(page, pageSize),
    findPlayerMatches: (puuid, name, iconId, level, page, pageSize) =>
      raw.fetchPlayerMatchList(puuid, name, iconId, level, page, pageSize),
  }
}

// ═══════════════════════════════════════════════════════════
// SessionPort — 会话/连接操作
// ═══════════════════════════════════════════════════════════

export interface SessionPort {
  checkConnection(): Promise<LcuConnectionInfo | null>
  getCurrentSummoner(): Promise<LcuSummoner>
}

export function createSessionRepository(raw: {
  checkConnection(): Promise<LcuConnectionInfo | null>
  getCurrentSummoner(): Promise<LcuSummoner>
}): SessionPort {
  return {
    checkConnection: () => raw.checkConnection(),
    getCurrentSummoner: () => raw.getCurrentSummoner(),
  }
}

// ═══════════════════════════════════════════════════════════
// GameDataPort — 静态游戏数据加载
// ═══════════════════════════════════════════════════════════

export interface GameDataPort {
  load(): Promise<GameDataCache>
}

export function createGameDataRepository(raw: {
  fetchGameData(): Promise<GameDataCache>
}): GameDataPort {
  return {
    load: () => raw.fetchGameData(),
  }
}

// ═══════════════════════════════════════════════════════════
// SettingsPort — 设置/桌面集成操作
// ═══════════════════════════════════════════════════════════

export interface SettingsPort {
  load(): Promise<{ autoUpdate: boolean; deepseekApiKey: string }>
  setAutoUpdate(enabled: boolean): Promise<void>
  setDeepseekApiKey(key: string): Promise<void>
  checkForUpdates(): Promise<void>
  openLogsDir(): Promise<void>
  openExternal(url: string): Promise<void>
  quitAndInstall(): void
  onUpdateStatus(callback: (status: unknown) => void): void
}

export function createSettingsRepository(raw: {
  getSettings(): Promise<{ autoUpdate: boolean; deepseekApiKey: string }>
  setSetting(key: string, value: unknown): Promise<void>
  checkForUpdates(): Promise<void>
  openLogsDir(): Promise<void>
  openExternal(url: string): Promise<void>
  quitAndInstall(): void
  onUpdateStatus(callback: (status: unknown) => void): void
}): SettingsPort {
  return {
    load: () => raw.getSettings(),
    setAutoUpdate: (enabled) => raw.setSetting('autoUpdate', enabled),
    setDeepseekApiKey: (key) => raw.setSetting('deepseekApiKey', key),
    checkForUpdates: () => raw.checkForUpdates(),
    openLogsDir: () => raw.openLogsDir(),
    openExternal: (url) => raw.openExternal(url),
    quitAndInstall: () => raw.quitAndInstall(),
    onUpdateStatus: (cb) => raw.onUpdateStatus(cb),
  }
}

// ═══════════════════════════════════════════════════════════
// ChatPort — AI 对话
// ═══════════════════════════════════════════════════════════

export interface ChatPort {
  sendMessage(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }>
}

export function createChatRepository(raw: {
  chatWithAI(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }>
}): ChatPort {
  return {
    sendMessage: (messages) => raw.chatWithAI(messages),
  }
}
