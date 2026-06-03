/**
 * 自动更新模块
 *
 * 双通道策略：
 *   通道1（优先）：electron-updater 直连 GitHub
 *   通道2（兜底）：axios 通过 ghproxy.com 镜像代理 GitHub API
 *
 * 国内用户直连 GitHub 不可用时自动切换到镜像源。
 */
import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import axios from 'axios'
import { getSettings } from './settings'

/** 当前版本 */
const CURRENT_VERSION = app.getVersion()

/** GitHub API 最新 release 端点 */
const GITHUB_API_LATEST =
  'https://api.github.com/repos/aqq2567/lol-match-data-viewer/releases/latest'

/** ghproxy.com 镜像代理的 GitHub API */
const MIRROR_API_LATEST = `https://ghproxy.com/${GITHUB_API_LATEST}`

/** GitHub 可达性检测超时（毫秒） */
const REACHABILITY_TIMEOUT = 5000

/** 镜像源 API 请求超时（毫秒） */
const MIRROR_API_TIMEOUT = 15000

let updateDownloaded = false

// ═══════════════════════════════════════════════════════════
// 可达性检测
// ═══════════════════════════════════════════════════════════

let _githubReachable: boolean | null = null

async function isGithubReachable(): Promise<boolean> {
  if (_githubReachable !== null) return _githubReachable
  try {
    await axios.head('https://api.github.com', { timeout: REACHABILITY_TIMEOUT })
    _githubReachable = true
    console.log('[UPDATER] GitHub 可达，使用直连')
  } catch {
    _githubReachable = false
    console.log('[UPDATER] GitHub 不可达，将切换到镜像源')
  }
  return _githubReachable
}

// ═══════════════════════════════════════════════════════════
// 版本比较（简易 semver，不引入额外依赖）
// ═══════════════════════════════════════════════════════════

function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// ═══════════════════════════════════════════════════════════
// 镜像源更新检查
// ═══════════════════════════════════════════════════════════

interface MirrorRelease {
  tag_name?: string
  html_url?: string
  assets?: Array<{ browser_download_url?: string; name?: string }>
}

async function checkUpdateViaMirror(getMainWindow: () => BrowserWindow | null) {
  try {
    const resp = await axios.get<MirrorRelease>(MIRROR_API_LATEST, {
      timeout: MIRROR_API_TIMEOUT,
      headers: { Accept: 'application/json' },
    })

    const release = resp.data
    const latestVersion = release.tag_name?.replace(/^v/, '')

    if (!latestVersion) {
      console.log('[UPDATER] 镜像源：未找到有效版本号')
      return
    }

    console.log(`[UPDATER] 镜像源：当前 ${CURRENT_VERSION}，最新 ${latestVersion}`)

    if (compareVersion(latestVersion, CURRENT_VERSION) > 0) {
      const win = getMainWindow()
      if (win) {
        // 优先使用 GitHub release 页面（通过镜像代理）
        const downloadUrl = release.html_url
          ? `https://ghproxy.com/${release.html_url}`
          : `https://ghproxy.com/https://github.com/aqq2567/lol-match-data-viewer/releases/latest`

        console.log(`[UPDATER] 通过镜像源发现新版本: ${latestVersion}`)
        win.webContents.send('update-status', {
          status: 'mirror-available',
          version: latestVersion,
          url: downloadUrl,
        })
      }
    } else {
      console.log('[UPDATER] 镜像源：当前已是最新版本')
    }
  } catch (err: any) {
    console.error(`[UPDATER] 镜像源检查失败: ${err.message || err}`)
  }
}

// ═══════════════════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════════════════

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null) {
  // 日志
  autoUpdater.logger = {
    info: (msg: string) => console.log(`[UPDATER] ${msg}`),
    warn: (msg: string) => console.warn(`[UPDATER] ${msg}`),
    error: (msg: string) => console.error(`[UPDATER] ${msg}`),
    debug: (_msg: string) => {},
  }

  // 自动下载，安装前提示
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] 正在检查更新...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[UPDATER] 发现新版本: ${info.version}`)
    const win = getMainWindow()
    if (win) {
      win.webContents.send('update-status', { status: 'downloading', version: info.version })
    }
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] 当前已是最新版本')
  })

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    if (pct % 20 === 0) {
      console.log(`[UPDATER] 下载进度: ${pct}%`)
    }
    const win = getMainWindow()
    if (win) {
      win.webContents.send('update-status', { status: 'downloading', percent: pct })
    }
  })

  autoUpdater.on('update-downloaded', () => {
    updateDownloaded = true
    console.log('[UPDATER] 新版本已下载，将在下次启动时安装')
    const win = getMainWindow()
    if (win) {
      win.webContents.send('update-status', { status: 'downloaded' })
    }
  })

  autoUpdater.on('error', (err) => {
    console.error(`[UPDATER] 更新检查失败: ${err.message || err}`)
  })

  /** 执行更新检查：优先 GitHub 直连，不可达时走镜像源 */
  async function checkForUpdates() {
    const settings = getSettings()
    if (!settings.autoUpdate) {
      console.log('[UPDATER] 自动更新已关闭，跳过检查')
      return
    }

    const reachable = await isGithubReachable()

    if (reachable) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error(`[UPDATER] 直连检查更新异常: ${err.message || err}`)
        console.log('[UPDATER] 直连失败，尝试镜像源兜底')
        checkUpdateViaMirror(getMainWindow)
      })
    } else {
      checkUpdateViaMirror(getMainWindow)
    }
  }

  // 启动 10 秒后检查更新（避免与 LCU 扫描抢资源）
  setTimeout(() => {
    console.log('[UPDATER] 开始首次更新检查')
    checkForUpdates()
  }, 10_000)

  return checkForUpdates
}
