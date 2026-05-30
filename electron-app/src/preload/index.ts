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
}

contextBridge.exposeInMainWorld('lcuApi', api)
console.log('[LCU:PRELOAD] lcuApi 已暴露到 window')
