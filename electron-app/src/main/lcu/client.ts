/**
 * LCU 连接发现 + HTTP 客户端
 *
 * 连接发现采用双层降级：
 *   方案1（主）：原生插件从进程 PEB 读命令行（不需要管理员/不依赖安装路径）
 *   方案2（兜底）：文件系统搜索 lockfile（原生插件加载失败时使用）
 */
import fs from 'fs'
import path from 'path'
import axios, { AxiosInstance } from 'axios'
import https from 'https'
import type { LcuConnectionInfo } from '@shared/types'
import type {
  ChampionSimple,
  ItemData,
  SummonerSpellData,
  PerkData,
  PerkStyleData,
  QueueData,
  AugmentData,
} from '@shared/types/app'
import {
  isPidAlive,
  lockfileAgeSeconds,
  maskToken,
  extractFromCmdline,
  parseLockfileWithDiag,
} from './client-utils'

// ═══════════════════════════════════════════════════════════
// 原生插件（懒加载，加载失败时降级到 lockfile 搜索）
// ═══════════════════════════════════════════════════════════

let _lcuAddon: {
  getPidsByName: (name: string) => number[]
  getCommandLine1: (pid: number) => string
} | null = null
let _lcuAddonLoadAttempted = false

function loadLcuAddon(): typeof _lcuAddon {
  if (_lcuAddonLoadAttempted) return _lcuAddon
  _lcuAddonLoadAttempted = true
  try {
    // asar 内 require 对 .node 原生模块无效，需计算真实文件系统路径
    let addonPath = path.join(__dirname, '..', '..', 'addons', 'akari-tools-win64.node')
    if (addonPath.includes('app.asar')) {
      addonPath = addonPath.replace('app.asar', 'app.asar.unpacked')
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require(addonPath)
    _lcuAddon = {
      getPidsByName: raw.getPidsByName.bind(raw),
      getCommandLine1: raw.getCommandLine1.bind(raw),
    }
    console.log('[LCU:DIAG] 原生插件加载成功: akari-tools-win64.node')
  } catch (err: any) {
    console.warn(`[LCU:DIAG] 原生插件加载失败: ${err.message || err}，将使用 lockfile 方案`)
    _lcuAddon = null
  }
  return _lcuAddon
}

// ═══════════════════════════════════════════════════════════
// 诊断工具
// ═══════════════════════════════════════════════════════════

/** findLolClient 调用序号，方便跨调用追踪 */
let _findCallSeq = 0

/** 上一次成功找到的 LCU 连接信息（供 lcu-asset 图片代理等外部模块读取） */
let _lastConnection: LcuConnectionInfo | null = null

/** 获取 findLolClient 缓存的最新连接信息 */
export function getLastConnection(): LcuConnectionInfo | null {
  return _lastConnection
}

// ═══════════════════════════════════════════════════════════
// 连接发现
// ═══════════════════════════════════════════════════════════

/** 用真实 HTTPS 请求验证 LCU API 服务是否就绪（5 秒超时） */
function lcuAliveCheck(
  port: number, authToken: string, timeoutMs = 5000
): Promise<{ ok: boolean; statusCode?: number; errorCode?: string }> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    const auth = Buffer.from(`riot:${authToken}`).toString('base64')
    const req = https.request({
      hostname: '127.0.0.1',
      port,
      path: '/riotclient/affinity',
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    }, (res) => {
      const elapsed = Date.now() - t0
      res.resume()
      console.log(`[LCU:DIAG]   lcuAliveCheck OK: port=${port} status=${res.statusCode} elapsed=${elapsed}ms`)
      resolve({ ok: true, statusCode: res.statusCode })
    })
    req.on('error', (err: any) => {
      const elapsed = Date.now() - t0
      console.log(`[LCU:DIAG]   lcuAliveCheck 失败: port=${port} code=${err.code || 'none'} message=${err.message} elapsed=${elapsed}ms`)
      req.destroy()
      resolve({ ok: false, errorCode: err.code })
    })
    req.on('timeout', () => {
      const elapsed = Date.now() - t0
      console.log(`[LCU:DIAG]   lcuAliveCheck 超时: port=${port} elapsed=${elapsed}ms`)
      req.destroy()
      resolve({ ok: false, errorCode: 'TIMEOUT' })
    })
    req.end()
  })
}

/** 用 Node.js 递归搜索已知 Riot Games 目录中的 lockfile（方案2兜底） */
function findLockfiles(): string[] {
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env.LOCALAPPDATA || ''

  const roots = [
    path.join(progFiles, 'Riot Games'),
    path.join(progFilesX86, 'Riot Games'),
    path.join(localAppData, 'Riot Games'),
    'C:\\Riot Games', 'D:\\Riot Games', 'E:\\Riot Games',
    'F:\\Riot Games', 'G:\\Riot Games',
  ]

  const existingRoots: string[] = []
  const results: string[] = []
  for (const root of roots) {
    if (fs.existsSync(root)) {
      existingRoots.push(root)
      walk(root, 3)
    }
  }
  console.log(`[LCU:DIAG] 扫描 Riot Games 目录: ${existingRoots.length} 个存在, 找到 ${results.length} 个 lockfile` +
    (results.length ? ` => ${results.join(', ')}` : ''))
  return results

  function walk(dir: string, depth: number) {
    if (depth < 0) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.name === 'lockfile' && entry.isFile()) {
        results.push(full)
      } else if (entry.isDirectory() && depth > 0) {
        walk(full, depth - 1)
      }
    }
  }
}

/**
 * 方案1（主）：通过原生插件从进程 PEB 读取命令行
 * 不需要管理员权限，不依赖安装路径，不依赖 lockfile
 */
async function tryNativeAddon(t0: number): Promise<LcuConnectionInfo | null> {
  const addon = loadLcuAddon()
  if (!addon) return null

  const pids = addon.getPidsByName('LeagueClientUx.exe')
  console.log(`[LCU:DIAG] 方案1 原生插件: 找到 ${pids.length} 个 LeagueClientUx 进程, pids=[${pids.join(',')}]`)

  for (const pid of pids) {
    try {
      const cmdline = addon.getCommandLine1(pid)
      if (!cmdline) {
        console.log(`[LCU:DIAG]   PID ${pid}: getCommandLine1 返回空`)
        continue
      }

      const port = extractFromCmdline(cmdline, /--app-port=(\d+)/)
      const authToken = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
      console.log(`[LCU:DIAG]   PID ${pid}: port=${port || '?'} token=${authToken ? maskToken(authToken) : '?'}`)

      if (!port || !authToken) {
        console.log(`[LCU:DIAG]   PID ${pid}: 命令行缺少 port 或 token，跳过`)
        continue
      }

      const alive = await lcuAliveCheck(parseInt(port), authToken)
      if (!alive.ok) {
        console.log(`[LCU:DIAG]   PID ${pid}: lcuAliveCheck 失败 (errorCode=${alive.errorCode})`)
        continue
      }

      const region = extractFromCmdline(cmdline, /--region=([\w\-_]+)/)
      const rsoPlatformId = extractFromCmdline(cmdline, /--rso_platform_id=([\w\-_]+)/)

      const totalElapsed = Date.now() - t0
      console.log(`[LCU:MAIN] 检测到 LCU (方案1 原生插件): port=${port}, pid=${pid}, totalElapsed=${totalElapsed}ms`)
      return {
        port: parseInt(port),
        authToken,
        pid,
        region,
        rsoPlatformId,
      }
    } catch (e: any) {
      console.log(`[LCU:DIAG]   PID ${pid}: 异常 err=${e.message || e}`)
    }
  }

  return null
}

/**
 * 方案2（兜底）：文件系统搜索 lockfile
 * 仅当原生插件加载失败时使用
 */
async function tryLockfileSearch(t0: number): Promise<LcuConnectionInfo | null> {
  const lockfiles = findLockfiles()
  for (const lf of lockfiles) {
    try {
      const age = lockfileAgeSeconds(lf)
      const content = fs.readFileSync(lf, 'utf-8')
      const parsed = parseLockfileWithDiag(lf, content)
      if (!parsed) continue

      const pidAlive = isPidAlive(parsed.pid)
      console.log(`[LCU:DIAG] lockfile: ${lf} age=${age.toFixed(0)}s pid=${parsed.pid} pidAlive=${pidAlive} port=${parsed.port} token=${maskToken(parsed.authToken)}`)

      if (!pidAlive) {
        console.log(`[LCU:DIAG]   PID ${parsed.pid} 不存在，跳过（旧进程残留）`)
        continue
      }

      const alive = await lcuAliveCheck(parsed.port, parsed.authToken)
      if (!alive.ok) {
        console.log(`[LCU:DIAG]   lcuAliveCheck 未通过 (errorCode=${alive.errorCode})，继续下一个`)
        continue
      }

      const totalElapsed = Date.now() - t0
      console.log(`[LCU:MAIN] 检测到 LCU (方案2 lockfile): port=${parsed.port}, pid=${parsed.pid}, path=${lf}, totalElapsed=${totalElapsed}ms`)
      return { ...parsed, region: '', rsoPlatformId: '' }
    } catch (e: any) {
      console.log(`[LCU:DIAG] lockfile 异常: ${lf} err=${e.message || e}`)
    }
  }
  return null
}

/** 查找运行中的 LCU 客户端连接参数 */
export async function findLolClient(): Promise<LcuConnectionInfo | null> {
  const callSeq = ++_findCallSeq
  const t0 = Date.now()
  console.log(`[LCU:DIAG] findLolClient #${callSeq} 开始`)

  try {
    // ═══ 方案1：原生插件读 PEB 命令行（覆盖所有安装路径/无需管理员）══════
    const nativeResult = await tryNativeAddon(t0)
    if (nativeResult) {
      _lastConnection = nativeResult
      return nativeResult
    }

    // ═══ 方案2：文件系统搜索 lockfile（兜底）══════
    const lockfileResult = await tryLockfileSearch(t0)
    if (lockfileResult) {
      _lastConnection = lockfileResult
      return lockfileResult
    }

    // 全部失败 — 诊断输出
    _lastConnection = null
    const totalElapsed = Date.now() - t0
    const addon = loadLcuAddon()
    const pids = addon ? addon.getPidsByName('LeagueClientUx.exe') : []
    console.log(
      `[LCU:DIAG] findLolClient #${callSeq} 全部方案失败: totalElapsed=${totalElapsed}ms ` +
      `addonLoaded=${!!addon} leagueClientUxPids=[${pids.join(',')}]`
    )

    if (pids.length > 0) {
      console.log(
        `[LCU:MAIN] 检测到 LeagueClientUx 进程 (pids=[${pids.join(',')}]) 但无法提取连接参数。` +
        '可能原因：命令行中缺少 --app-port / --remoting-auth-token，或 LCU 服务尚未就绪'
      )
    } else {
      console.log('[LCU:MAIN] 未检测到 LeagueClientUx 进程 — 请确认游戏已启动并登录')
    }
    return null
  } catch (err: any) {
    _lastConnection = null
    console.error(`[LCU:MAIN] 进程检测异常: ${err.message || err}`)
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// HTTP 客户端
// ═══════════════════════════════════════════════════════════

/** LCU HTTP 请求默认超时（毫秒） */
const LCU_HTTP_TIMEOUT = 15000
/** 请求失败最大重试次数（仅对 ECONNREFUSED / 5xx 重试） */
const MAX_RETRIES = 2
/** 重试间隔基数（毫秒），实际延迟 = delay * (attempt + 1) */
const RETRY_DELAY = 1000

export class LcuHttpClient {
  private axios: AxiosInstance
  private baseUrl: string
  /** 创建此客户端时使用的连接信息，供 ECONNREFUSED 时诊断 */
  private _connSnapshot: { port: number; pid: number; authToken: string }

  constructor(conn: LcuConnectionInfo) {
    this.baseUrl = `https://127.0.0.1:${conn.port}`
    const auth = Buffer.from(`riot:${conn.authToken}`).toString('base64')
    this._connSnapshot = { port: conn.port, pid: conn.pid, authToken: conn.authToken }

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: LCU_HTTP_TIMEOUT,
    })
  }

  async get<T = any>(endpoint: string): Promise<T> {
    let lastErr: any
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await this.axios.get<T>(endpoint)
        return resp.data
      } catch (err: any) {
        lastErr = err
        const code = err.code || ''
        const status = err.response?.status || 0
        const retryable = code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
          status === 502 || status === 503 || status === 504
        if (!retryable || attempt === MAX_RETRIES) {
          const detail = status === 404 ? ' (数据可能已过期或不存在)' : ''

          // ECONNREFUSED 专属诊断
          if (code === 'ECONNREFUSED') {
            const s = this._connSnapshot
            const pidAlive = s.pid ? isPidAlive(s.pid) : 'unknown'
            console.error(
              `[LCU:MAIN] LCU API ECONNREFUSED: ${endpoint} | ` +
              `port=${s.port} pid=${s.pid} pidAlive=${pidAlive} ` +
              `token=${maskToken(s.authToken)} attempt=${attempt + 1}/${MAX_RETRIES + 1}`
            )
          } else {
            console.error(`[LCU:MAIN] LCU API 请求失败 [${status || code}] ${endpoint}: ${err.message || err}${detail}`)
          }
          throw err
        }
        console.warn(`[LCU:MAIN] 请求失败 [${status || code}] ${endpoint}, ${RETRY_DELAY * (attempt + 1)}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
      }
    }
    throw lastErr
  }

  // ── 召唤师与战绩 ──

  async getCurrentSummoner(): Promise<import('@shared/types').LcuSummoner> {
    return this.get<import('@shared/types').LcuSummoner>(
      '/lol-summoner/v1/current-summoner'
    )
  }

  async getSummonerById(summonerId: number) {
    return this.get<import('@shared/types').LcuSummoner>(
      `/lol-summoner/v1/summoners/${summonerId}`
    )
  }

  async getSummonerByName(name: string) {
    return this.get<import('@shared/types').LcuSummoner>(
      `/lol-summoner/v1/summoners?name=${encodeURIComponent(name)}`
    )
  }

  async getSummonerByPuuid(puuid: string) {
    return this.get<import('@shared/types').LcuSummoner>(
      `/lol-summoner/v1/summoners/by-puuid/${puuid}`
    )
  }

  async getMatchHistory(puuid: string, beg = 0, end = 19) {
    return this.get<any>(
      `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=${beg}&endIndex=${end}`
    )
  }

  async getMatchHistoryAlt(puuid: string, beg = 0, end = 19) {
    return this.get<any>(
      `/lol-match-history/v1/products/lol/${puuid}/matches?beginIndex=${beg}&endIndex=${end}`
    )
  }

  async getGameDetail(gameId: number) {
    return this.get<any>(`/lol-match-history/v1/games/${gameId}`)
  }

  async getRankedStats(puuid: string) {
    return this.get<any>(`/lol-ranked/v1/ranked-stats/${puuid}`)
  }

  async getChampionMastery() {
    return this.get<any[]>('/lol-champion-mastery/v1/local-player/champion-mastery')
  }

  // ── 游戏静态数据（LCU CDN，含 iconPath） ──

  async getGameChampions(): Promise<ChampionSimple[]> {
    return this.get<ChampionSimple[]>('/lol-game-data/assets/v1/champion-summary.json')
  }

  async getGameItems(): Promise<ItemData[]> {
    return this.get<ItemData[]>('/lol-game-data/assets/v1/items.json')
  }

  async getGameSummonerSpells(): Promise<SummonerSpellData[]> {
    return this.get<SummonerSpellData[]>('/lol-game-data/assets/v1/summoner-spells.json')
  }

  async getGamePerks(): Promise<PerkData[]> {
    return this.get<PerkData[]>('/lol-game-data/assets/v1/perks.json')
  }

  async getGamePerkstyles(): Promise<{ schemaVersion: number; styles: PerkStyleData[] }> {
    return this.get<{ schemaVersion: number; styles: PerkStyleData[] }>(
      '/lol-game-data/assets/v1/perkstyles.json'
    )
  }

  async getGameQueues(): Promise<Record<string, QueueData>> {
    return this.get<Record<string, QueueData>>('/lol-game-data/assets/v1/queues.json')
  }

  async getGameAugments(): Promise<AugmentData[]> {
    return this.get<AugmentData[]>('/lol-game-data/assets/v1/cherry-augments.json')
  }
}
