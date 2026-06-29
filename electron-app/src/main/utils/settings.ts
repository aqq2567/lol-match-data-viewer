/**
 * 用户设置管理
 * 存储在 {userData}/settings.json，启动时读取默认值
 */
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = 'settings.json'

interface DashboardConfig {
  ghUser: string       // GitHub 用户名
  ghRepo: string       // 仓库名
  ghToken: string      // Personal Access Token (public_repo 权限)
  round: string        // 轮次名称，默认 "第1轮"
  adminPasswordHash: string // 管理员密码 SHA256 哈希（前端只读，不可通过 IPC 修改）
}

interface UserSettings {
  autoUpdate: boolean
  deepseekApiKey?: string
  dashboard?: DashboardConfig  // 新增：比赛看板发布配置
}

let _cache: UserSettings | null = null

function getFilePath(): string {
  const dir = app.getPath('userData')
  const path = join(dir, SETTINGS_FILE)
  // 确保目录存在
  const parentDir = join(path, '..')
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }
  return path
}

export function getSettings(): UserSettings {
  if (_cache) return _cache
  try {
    const filePath = getFilePath()
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8')
      _cache = JSON.parse(raw)
    }
  } catch (err) {
    console.warn(`[SETTINGS] 读取配置文件失败: ${err}`)
  }
  if (!_cache) {
    _cache = {
      autoUpdate: true,
      dashboard: {
        ghUser: '',
        ghRepo: '',
        ghToken: '',
        round: '第1轮',
        adminPasswordHash: '',
      },
    }
    saveSettings()
  }
  return _cache
}

export function setSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
  const settings = getSettings()
  settings[key] = value
  saveSettings()
}

function saveSettings(): void {
  try {
    const filePath = getFilePath()
    writeFileSync(filePath, JSON.stringify(_cache, null, 2), 'utf-8')
  } catch (err) {
    console.error(`[SETTINGS] 保存配置文件失败: ${err}`)
  }
}
