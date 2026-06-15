/**
 * Electron 主进程入口
 * - 创建渲染窗口
 * - 注册 IPC 处理器（日志 + LCU 数据拉取）
 * - 注册 lcu-asset:// 自定义协议代理 LCU 图片资源
 */
import 'dotenv/config'
import { app, BrowserWindow, ipcMain, Menu, shell, protocol } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { logger } from './utils/logger'
import { getSettings, setSetting } from './utils/settings'
import { initAutoUpdater } from './utils/updater'
import { registerLcuHandlers } from './ipc/lcu-handlers'
import { chatWithLLM } from './utils/llm'
import { registerLcuAssetProtocol } from './lcu/asset-proxy'
import { initDb, closeDb } from './db/database'

// ═══════════════════════════════════════════════════════════
// 全局日志拦截 —— 所有 console.log/warn/error 同时写入文件
// 自动提取 [TAG] 前缀用于日志分类（如 [LCU:MAIN]、[UPDATER]）
// ═══════════════════════════════════════════════════════════
logger.init()

const TAG_RE = /^\[([A-Z_]+:[A-Z_]+|[A-Z]+)\]\s*/

function fmtConsole(args: any[]): { tag: string; message: string } {
  const msg = args.map(a =>
    a instanceof Error ? (a.message || String(a)) :
    typeof a === 'object' ? JSON.stringify(a) :
    String(a)
  ).join(' ')
  const m = msg.match(TAG_RE)
  if (m) return { tag: m[1], message: msg.slice(m[0].length) }
  return { tag: 'MAIN', message: msg }
}

console.log = (...args: any[]) => {
  const { tag, message } = fmtConsole(args)
  logger.info(tag, message)
}
console.warn = (...args: any[]) => {
  const { tag, message } = fmtConsole(args)
  logger.warn(tag, message)
}
console.error = (...args: any[]) => {
  const { tag, message } = fmtConsole(args)
  logger.error(tag, message)
}

let mainWindow: BrowserWindow | null = null
/** 标记是否正在执行 quitAndInstall，此时不应 app.exit(0) 以免中断更新安装重启 */
let isQuitAndInstall = false

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

// ═══════════════════════════════════════════════════════════
// IPC 处理器注册
// ═══════════════════════════════════════════════════════════

// 渲染进程日志 → 主进程落盘（自动提取 [TAG] 前缀）
ipcMain.handle('log:write', async (_event, level: string, ...args: any[]) => {
  const msg = args.map((a: any) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  const m = msg.match(TAG_RE)
  const tag = (m ? m[1] : 'RENDERER') + (level === 'error' ? ':ERROR' : level === 'warn' ? ':WARN' : '')
  const message = m ? msg.slice(m[0].length) : msg
  logger.renderer(level, tag, message)
})

// 更新相关 handler
ipcMain.handle('update:quit-and-install', () => {
  console.log('[UPDATER] 用户请求安装更新并重启（静默模式）')
  isQuitAndInstall = true
	autoUpdater.quitAndInstall(true, true)
})

ipcMain.handle('update:check', async () => {
  const settings = getSettings()
  if (!settings.autoUpdate) {
    console.log('[UPDATER] 自动更新已关闭，跳过手动检查')
    return
  }
  console.log('[UPDATER] 用户手动触发更新检查')
  return checkForUpdates()
})

// LLM 对话 handler
ipcMain.handle('llm:chat', async (_event, messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => {
  console.log(`[LLM:MAIN] llm:chat 收到请求: ${messages.length} 条消息`)
  const sysMsg = messages.find(m => m.role === 'system')
  if (sysMsg) {
    const head = sysMsg.content.slice(0, 400)
    console.log(`[LLM:MAIN] system prompt 头部 (${sysMsg.content.length} 字):\n${head}`)
  }
  try {
    const reply = await chatWithLLM(messages)
    console.log(`[LLM:MAIN] llm:chat 成功: 回复长度=${reply.length}`)
    return { status: 'success', content: reply }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[LLM:MAIN] llm:chat 失败: ${msg}`)
    return { status: 'error', message: msg }
  }
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

let checkForUpdates: () => Promise<void>

// LCU 相关 handler
registerLcuHandlers()

// 初始化自动更新（拿到双通道检查函数）
checkForUpdates = initAutoUpdater(() => mainWindow)

// ═══════════════════════════════════════════════════════════
// 应用生命周期
// ═══════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  console.log('[LCU:MAIN] Electron 应用启动完成')
  await initDb()
  Menu.setApplicationMenu(null)
  registerLcuAssetProtocol()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    if (isQuitAndInstall) {
      // 更新安装重启：不调用 app.exit(0)，让 electron-updater 完成安装后自动重启
    } else {
      app.exit(0)
    }
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
