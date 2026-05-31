/**
 * Electron 主进程入口
 * - 创建渲染窗口
 * - 注册 IPC 处理器（日志 + LCU 数据拉取）
 * - 注册 lcu-asset:// 自定义协议代理 LCU 图片资源
 */
import { app, BrowserWindow, ipcMain, Menu, shell, protocol } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { logger } from './utils/logger'
import { getSettings, setSetting } from './utils/settings'
import { initAutoUpdater } from './utils/updater'
import { registerLcuHandlers } from './ipc/lcu-handlers'
import type { LcuConnectionInfo } from '@shared/types'

// ═══════════════════════════════════════════════════════════
// 简易并发限制器（对标 LeagueAkari PQueue concurrency=8）
// 防止大量图片请求同时打到 LCU 导致拒绝连接
// ═══════════════════════════════════════════════════════════

class ConcurrencyLimiter {
  private running = 0
  private queue: Array<() => void> = []
  constructor(private maxConcurrency: number) {}
  async acquire(): Promise<void> {
    while (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
  }
  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }
}

/** LCU 图片代理最大并发数 */
const ASSET_PROXY_CONCURRENCY = 8
/** LCU 图片代理 HTTP 请求超时（毫秒） */
const ASSET_PROXY_TIMEOUT = 10000

const _assetLimiter = new ConcurrencyLimiter(ASSET_PROXY_CONCURRENCY)

// ═══════════════════════════════════════════════════════════
// 全局日志拦截 —— 所有 console.log/warn/error 同时写入文件
// ═══════════════════════════════════════════════════════════
logger.init()

console.log = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  logger.info('MAIN', msg)
}
console.warn = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  logger.warn('MAIN', msg)
}
console.error = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  logger.error('MAIN', msg)
}

let mainWindow: BrowserWindow | null = null

/** 缓存的 LCU 认证信息，供 lcu-asset 协议代理使用 */
let _lcuAuth: string | null = null
let _lcuPort: number | null = null
let _assetAxios: AxiosInstance | null = null
let _assetAxiosPort: number | null = null

/** 获取/缓存用于图片代理的 Axios 实例 */
function getAssetAxios(): AxiosInstance | null {
  if (!_lcuPort || !_lcuAuth) return null
  if (_assetAxiosPort !== _lcuPort) {
    _assetAxios = axios.create({
      baseURL: `https://127.0.0.1:${_lcuPort}`,
      headers: { Authorization: `Basic ${_lcuAuth}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      httpAgent: new http.Agent(),
      timeout: ASSET_PROXY_TIMEOUT,
      proxy: false,
    })
    _assetAxiosPort = _lcuPort
    console.log(`[LCU:MAIN] lcu-asset Axios 实例已创建: port=${_lcuPort}`)
  }
  return _assetAxios
}

/** 主窗口默认尺寸 */
const WINDOW_WIDTH = 1200
const WINDOW_HEIGHT = 800
const WINDOW_MIN_WIDTH = 960
const WINDOW_MIN_HEIGHT = 560

function createWindow() {
  console.log(`[LCU:MAIN] 创建主窗口: ${WINDOW_WIDTH}x${WINDOW_HEIGHT}`)
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: 'LOL Match Data Viewer',
    backgroundColor: '#101014',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log(`[LCU:MAIN] 开发模式: 加载 ${process.env['ELECTRON_RENDERER_URL']}`)
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    console.log(`[LCU:MAIN] 生产模式: 加载 ${htmlPath}`)
    mainWindow.loadFile(htmlPath)
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    console.log(`[LCU:MAIN] 拦截外部链接: ${details.url}`)
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const tag = ['verbose', 'info', 'warning', 'error'][level] || 'debug'
    logger.renderer(tag, 'RENDERER', message)
  })
}

// ═══════════════════════════════════════════════════════════
// 自定义协议 —— 代理 LCU 图片资源
// ═══════════════════════════════════════════════════════════

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lcu-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

function registerLcuAssetProtocol() {
  protocol.handle('lcu-asset', async (request) => {
    const ax = getAssetAxios()
    if (!ax) {
      console.warn(`[LCU:MAIN] lcu-asset 请求被拒绝（未连接）: ${request.url}`)
      return new Response('LCU not connected', { status: 503 })
    }

    const fullPath = new URL(request.url).pathname
    try {
      await _assetLimiter.acquire()
      try {
        const res = await ax.get(fullPath, { responseType: 'arraybuffer' })
        const contentType = res.headers['content-type'] || 'application/octet-stream'
        return new Response(res.data, {
          status: 200,
          headers: { 'Content-Type': contentType },
        })
      } finally {
        _assetLimiter.release()
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        return new Response('Not found', { status: 404 })
      }
      const status = err.response?.status || 'NET'
      const code = err.code || ''
      console.warn(
        `[LCU:MAIN] lcu-asset 代理失败 [${status}${code ? ' ' + code : ''}]: ${fullPath}`
      )
      return new Response('Internal error', { status: 500 })
    }
  })
}

// ═══════════════════════════════════════════════════════════
// IPC 处理器注册
// ═══════════════════════════════════════════════════════════

// 渲染进程日志 → 主进程落盘
ipcMain.handle('log:write', async (_event, level: string, ...args: any[]) => {
  const msg = args.map((a: any) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  logger.renderer(level, 'RENDERER', msg)
})

// 更新相关 handler
ipcMain.handle('update:quit-and-install', () => {
  console.log('[UPDATER] 用户请求安装更新并重启（静默模式）')
  autoUpdater.quitAndInstall(true, true)
})

ipcMain.handle('update:check', async () => {
  const settings = getSettings()
  if (!settings.autoUpdate) {
    console.log('[UPDATER] 自动更新已关闭，跳过手动检查')
    return
  }
  console.log('[UPDATER] 用户手动触发更新检查')
  return autoUpdater.checkForUpdates()
})

// 设置相关 handler
ipcMain.handle('settings:get', async () => {
  return getSettings()
})

ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
  setSetting(key, value)
})

// 打开日志目录
ipcMain.handle('logs:open-dir', async () => {
  const logDir = logger.logDir
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  const err = await shell.openPath(logDir)
  if (err) console.error(`[MAIN] 打开日志目录失败: ${err}`)
})

// 打开外部链接
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})

// LCU 相关 handler（通过回调同步认证信息给 lcu-asset 协议代理）
registerLcuHandlers({
  onConnectionFound(conn: LcuConnectionInfo) {
    if (_lcuPort !== conn.port) {
      _assetAxios = null
      _assetAxiosPort = null
    }
    _lcuPort = conn.port
    _lcuAuth = Buffer.from(`riot:${conn.authToken}`).toString('base64')
  },
})

// ═══════════════════════════════════════════════════════════
// 应用生命周期
// ═══════════════════════════════════════════════════════════

app.whenReady().then(() => {
  console.log('[LCU:MAIN] Electron 应用启动完成')
  Menu.setApplicationMenu(null)
  registerLcuAssetProtocol()
  createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.exit(0)
  }
})

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.destroy()
    mainWindow = null
  }
  logger.info('SYSTEM', '应用退出，关闭日志')
  logger.close()
})
