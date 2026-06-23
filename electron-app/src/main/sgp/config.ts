/**
 * SGP 服务器地址解析
 *
 * 查找优先级:
 *   1. 内置 tencent-servers.json 精确匹配
 *   2. 动态拼域名 fallback — {zone}-sgp.lol.qq.com:21019
 *   3. 动态拼域名 fallback — {zone}-k8s-sgp.lol.qq.com:21019
 */

import path from 'path'
import fs from 'fs'

export interface SgpServerEntry {
  matchHistory: string | null
  common: string | null
}

export interface SgpServersConfig {
  version: number
  lastUpdate: number
  servers: Record<string, SgpServerEntry>
}

let _config: SgpServersConfig | null = null

function loadConfig(): SgpServersConfig {
  if (_config) return _config
  const configPath = path.join(__dirname, 'tencent-servers.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  _config = JSON.parse(raw) as SgpServersConfig
  return _config
}

/** 根据 rsoPlatformId（如 TENCENT_HN1）解析 SGP 服务器地址 */
export function resolveSgpBaseUrl(rsoPlatformId: string): string {
  const config = loadConfig()
  const serverId = rsoPlatformId.toUpperCase()
  const entry = config.servers[serverId]
  if (entry?.matchHistory) {
    return entry.matchHistory
  }

  // 动态拼域名 fallback
  const zone = serverId.replace('TENCENT_', '').toLowerCase()
  // 先尝试直连模式
  return `https://${zone}-sgp.lol.qq.com:21019`
}

/** 从 rsoPlatformId 提取子 ID（去掉 TENCENT_ 前缀） */
export function getSgpSubId(rsoPlatformId: string): string {
  if (rsoPlatformId.toUpperCase().startsWith('TENCENT_')) {
    return rsoPlatformId.split('_')[1]
  }
  return rsoPlatformId
}
