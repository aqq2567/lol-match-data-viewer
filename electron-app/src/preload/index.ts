/**
 * Preload 脚本 —— 通过 contextBridge 向渲染进程暴露安全的 LCU API
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { LcuConnectionInfo, MatchData, MatchListData, GameRecord, GameDataCache, LcuSummoner } from '@shared/types'

const api = {
  /** 向主进程发送日志（渲染进程专用），主进程会写入日志文件 */
  log(level: 'log' | 'warn' | 'error', ...args: any[]): void {
    ipcRenderer.invoke('log:write', level, ...args)
  },

  /** 检查 LOL 客户端是否运行 */
  checkConnection(): Promise<LcuConnectionInfo | null> {
    console.log('[LCU:PRELOAD] checkConnection 调用')
    return ipcRenderer.invoke('lcu:check-connection')
  },

  /** 获取当前登录召唤师的简要信息 */
  getCurrentSummoner(): Promise<LcuSummoner> {
    console.log('[LCU:PRELOAD] getCurrentSummoner 调用')
    return ipcRenderer.invoke('lcu:current-summoner')
  },

  /** 拉取对局列表（轻量，仅摘要，支持分页） */
  fetchMatchList(page = 1, pageSize = 20): Promise<MatchListData> {
    console.log(`[LCU:PRELOAD] fetchMatchList 调用: page=${page}, pageSize=${pageSize}`)
    return ipcRenderer.invoke('lcu:fetch-match-list', page, pageSize)
  },

  /** 通过召唤师 ID/名字/PUUID 查询任意玩家 */
  lookupSummoner(query: { summonerId?: number; name?: string; puuid?: string }): Promise<LcuSummoner> {
    console.log(`[LCU:PRELOAD] lookupSummoner 调用: ${query.summonerId ? `id=${query.summonerId}` : query.name ? `name=${query.name}` : `puuid=${query.puuid?.slice(0, 8)}…`}`)
    return ipcRenderer.invoke('lcu:lookup-summoner', query)
  },

  /** 以指定 PUUID 拉取对局列表（查询其他玩家） */
  fetchPlayerMatchList(targetPuuid: string, summonerName: string, profileIconId: number, summonerLevel: number, page = 1, pageSize = 20): Promise<MatchListData> {
    console.log(`[LCU:PRELOAD] fetchPlayerMatchList 调用: puuid=${targetPuuid.slice(0, 8)}… page=${page}`)
    return ipcRenderer.invoke('lcu:fetch-player-match-list', targetPuuid, summonerName, profileIconId, summonerLevel, page, pageSize)
  },

  /** 批量拉取对局完整详情（并发，用于分析） */
  fetchGameDetails(gameIds: number[]): Promise<GameRecord[]> {
    return ipcRenderer.invoke('lcu:fetch-game-details', gameIds)
  },

  /** 拉取最近的 N 场对局完整数据（旧版，较重） */
  fetchMatches(gameCount = 10): Promise<MatchData> {
    return ipcRenderer.invoke('lcu:fetch-matches', gameCount)
  },

  /** 获取指定对局的原始详情 */
  fetchGame(gameId: number): Promise<any> {
    return ipcRenderer.invoke('lcu:fetch-game', gameId)
  },

  /** 拉取游戏基础数据（英雄、装备、技能、符文等，含 iconPath） */
  fetchGameData(): Promise<GameDataCache> {
    console.log('[LCU:PRELOAD] fetchGameData 调用')
    return ipcRenderer.invoke('lcu:fetch-game-data')
  },

  /** 监听更新状态变化 */
  onUpdateStatus(callback: (status: any) => void): () => void {
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },

  /** 立即安装更新并重启 */
  quitAndInstall(): void {
    ipcRenderer.invoke('update:quit-and-install')
  },

  /** 手动检查更新 */
  checkForUpdates(): Promise<any> {
    return ipcRenderer.invoke('update:check')
  },

  /** 获取用户设置 */
  getSettings<T = any>(): Promise<T> {
    return ipcRenderer.invoke('settings:get')
  },

  /** 更新单个设置项 */
  setSetting(key: string, value: any): Promise<void> {
    return ipcRenderer.invoke('settings:set', key, value)
  },

  /** 打开日志目录 */
  openLogsDir(): Promise<void> {
    return ipcRenderer.invoke('logs:open-dir')
  },

  /** 在默认浏览器中打开外部链接 */
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('shell:open-external', url)
  },

  /** AI 对话（DeepSeek API） */
  chatWithAI(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }> {
    return ipcRenderer.invoke('llm:chat', messages)
  },

  /** DB: 获取本地缓存的最近 N 场对局摘要 */
  loadRecentGames(puuid: string, limit: number): Promise<ReturnType<typeof import('@shared/types').GameSummary>[]> {
    return ipcRenderer.invoke('db:recent-games', puuid, limit)
  },

  /** DB: 获取本地缓存的单场对局详情 */
  loadGameDetail(gameId: number): Promise<ReturnType<typeof import('@shared/types').GameRecord> | null> {
    return ipcRenderer.invoke('db:game-detail', gameId)
  },

  /** DB: 保存对局详情到本地 */
  saveGameDetail(gameId: number, detail: any): Promise<void> {
    return ipcRenderer.invoke('db:save-game-detail', gameId, detail)
  },

  /** DB: 获取本地缓存的玩家对局总数 */
  loadGameCount(puuid: string): Promise<number> {
    return ipcRenderer.invoke('db:game-count', puuid)
  },

  /** DB: 获取指定日期对局列表 */
  getDailyGames(puuid: string, date: string): Promise<any[]> {
    return ipcRenderer.invoke('db:daily-games', puuid, date)
  },

  /** DB: 获取最近有数据的日期 */
  getRecentDates(puuid: string, limit: number): Promise<string[]> {
    return ipcRenderer.invoke('db:recent-dates', puuid, limit)
  },

  /** SGP: 初始化 SGP 通道（获取 entitlements token） */
  sgpInit(rsoPlatformId: string): Promise<boolean> {
    return ipcRenderer.invoke('sgp:init', rsoPlatformId)
  },

  /** SGP: 销毁 SGP 通道 */
  sgpDestroy(): Promise<void> {
    return ipcRenderer.invoke('sgp:destroy')
  },
}

contextBridge.exposeInMainWorld('lcuApi', api)

// 将 preload 的 console.log/warn/error 路由到主进程日志文件
const _preOrig = { log: console.log, warn: console.warn, error: console.error }
console.log = (...a: any[]) => { _preOrig.log(...a); ipcRenderer.invoke('log:write', 'log', ...a).catch(() => {}) }
console.warn = (...a: any[]) => { _preOrig.warn(...a); ipcRenderer.invoke('log:write', 'warn', ...a).catch(() => {}) }
console.error = (...a: any[]) => { _preOrig.error(...a); ipcRenderer.invoke('log:write', 'error', ...a).catch(() => {}) }

console.log('[LCU:PRELOAD] lcuApi 已暴露到 window')
