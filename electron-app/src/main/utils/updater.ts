/**
 * 自动更新模块
 * 基于 electron-updater + GitHub Releases
 * 启动后延迟检查，后台静默下载，退出时自动安装
 */
import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { getSettings } from './settings'

let updateDownloaded = false

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

  /** 执行更新检查（受 autoUpdate 设置控制） */
  function checkForUpdates() {
    const settings = getSettings()
    if (!settings.autoUpdate) {
      console.log('[UPDATER] 自动更新已关闭，跳过检查')
      return
    }
    autoUpdater.checkForUpdates().catch((err) => {
      console.error(`[UPDATER] 检查更新异常: ${err.message || err}`)
    })
  }

  // 启动 10 秒后检查更新（避免与 LCU 扫描抢资源）
  setTimeout(() => {
    console.log('[UPDATER] 开始首次更新检查')
    checkForUpdates()
  }, 10_000)
}
