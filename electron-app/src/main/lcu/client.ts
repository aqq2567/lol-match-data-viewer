/**
 * LCU 连接发现 + HTTP 客户端
 * 对标 LeagueAkari shared/http-api-axios-helper/league-client 层的职责
 */
import { execSync } from 'child_process'
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

// ═══════════════════════════════════════════════════════════
// 诊断工具
// ═══════════════════════════════════════════════════════════

/** findLolClient 调用序号，方便跨调用追踪 */
let _findCallSeq = 0

/** 用 process.kill(pid, 0) 检查 PID 是否存活（Windows 兼容） */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 获取文件 mtime 到现在经过的秒数（用于判断 lockfile 新旧） */
function lockfileAgeSeconds(filePath: string): number {
  try {
    return (Date.now() - fs.statSync(filePath).mtimeMs) / 1000
  } catch {
    return -1
  }
}

/** 脱敏 authToken：仅保留前 4 位和后 4 位 */
function maskToken(tok: string): string {
  if (tok.length <= 8) return tok.slice(0, 2) + '***'
  return tok.slice(0, 4) + '…' + tok.slice(-4)
}

// ═══════════════════════════════════════════════════════════
// 连接发现
// ═══════════════════════════════════════════════════════════

/** PowerShell 进程执行超时（毫秒） */
const PS_EXEC_TIMEOUT = 10000

/**
 * 将 PowerShell 脚本编码为 Base64（UTF-16LE），通过 -EncodedCommand 安全传入
 * 完全规避 cmd.exe / Shell 对特殊字符的转义破坏
 */
function encodePsCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/**
 * 执行 PowerShell 脚本，返回 stdout 字符串。失败时返回空串不抛异常
 */
function runPsScript(script: string, timeout: number): string {
  const encoded = encodePsCommand('$ProgressPreference = "SilentlyContinue"\n' + script)
  try {
    return execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
      encoding: 'utf-8',
      timeout,
    }).trim()
  } catch (err: any) {
    console.error(`[LCU:MAIN] PowerShell 执行失败 (timeout=${timeout}ms): ${err.message || err}`)
    return ''
  }
}

/**
 * 直接调用 WMIC 读取进程命令行。
 * 不依赖 PowerShell，在 PowerShell 被组策略禁用时仍可工作。
 * 注意：WMIC 读取命令行通常仍需管理员权限。
 */
function runWmic(processName: string, timeout: number): string {
  try {
    return execSync(
      `wmic process where "name='${processName}'" get CommandLine,ProcessId /format:csv`,
      { encoding: 'utf-8', timeout }
    ).trim()
  } catch (err: any) {
    console.error(`[LCU:MAIN] WMIC 执行失败 (timeout=${timeout}ms): ${err.message || err}`)
    return ''
  }
}

/** 解析 WMIC /format:csv 输出，提取 port、authToken、pid */
function parseWmicOutput(raw: string): { port: number; authToken: string; pid: number } | null {
  const lines = raw.split('\n')
  for (const line of lines) {
    if (!line.includes('LeagueClientUx')) continue
    const match = line.match(/^[^,]*,(.+),(\d+)$/)
    if (!match) continue
    const cmdline = match[1].replace(/^"|"$/g, '')
    const pid = parseInt(match[2]) || 0
    const port = extractFromCmdline(cmdline, /--app-port=(\d+)/)
    const authToken = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
    if (port && authToken) {
      return { port: parseInt(port), authToken, pid }
    }
  }
  return null
}

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

/** 用 Node.js 递归搜索已知 Riot Games 目录中的 lockfile，返回全路径列表 */
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

/** 通过 Node.js 文件搜索 + PS 命令行兜底 查找 LCU 连接参数 */
export async function findLolClient(): Promise<LcuConnectionInfo | null> {
  const callSeq = ++_findCallSeq
  const t0 = Date.now()
  console.log(`[LCU:DIAG] findLolClient #${callSeq} 开始`)

  try {
    // ═══ 方案1：Node.js 搜索 lockfile（无需 PowerShell / 无需管理员）══════
    const lockfiles = findLockfiles()
    for (const lf of lockfiles) {
      const t1 = Date.now()
      try {
        const age = lockfileAgeSeconds(lf)
        const content = fs.readFileSync(lf, 'utf-8')
        const parsed = parseLockfileWithDiag(lf, content)
        if (!parsed) continue

        // 检查 PID 是否存活
        const pidAlive = isPidAlive(parsed.pid)
        console.log(`[LCU:DIAG] lockfile: ${lf} age=${age.toFixed(0)}s pid=${parsed.pid} pidAlive=${pidAlive} port=${parsed.port} token=${maskToken(parsed.authToken)}`)

        if (!pidAlive) {
          console.log(`[LCU:DIAG]   PID ${parsed.pid} 不存在，跳过此 lockfile（可能是旧进程残留）`)
          continue
        }

        // HTTPS 活跃性检查
        const alive = await lcuAliveCheck(parsed.port, parsed.authToken)
        if (!alive.ok) {
          console.log(`[LCU:DIAG]   lcuAliveCheck 未通过 (errorCode=${alive.errorCode})，继续下一个`)
          continue
        }

        const totalElapsed = Date.now() - t0
        console.log(`[LCU:MAIN] 检测到 LCU (方案1): port=${parsed.port}, pid=${parsed.pid}, path=${lf}, totalElapsed=${totalElapsed}ms`)
        return { ...parsed, region: '', rsoPlatformId: '' }
      } catch (e: any) {
        console.log(`[LCU:DIAG] lockfile 异常: ${lf} err=${e.message || e}`)
      }
    }

    // ═══ 方案2：PowerShell 通过进程路径找 lockfile（需能访问 .Path 属性）══════
    const psT0 = Date.now()
    const lockfileResult = runPsScript(`
      $p = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { exit 0 }
      try {
        $dir = Split-Path $p.Path -Parent -ErrorAction Stop
        $lf = Join-Path $dir 'lockfile'
        if (Test-Path $lf) { Get-Content $lf -Raw }
      } catch {}
    `, PS_EXEC_TIMEOUT)
    console.log(`[LCU:DIAG] 方案2 PS lockfile: elapsed=${Date.now() - psT0}ms result=${lockfileResult ? maskToken(lockfileResult) : '(空)'}`)

    if (lockfileResult) {
      const parsed = parseLockfile(lockfileResult)
      if (parsed) {
        console.log(`[LCU:MAIN] 检测到 LCU (方案2): port=${parsed.port}, pid=${parsed.pid}, pidAlive=${isPidAlive(parsed.pid)}`)
        const region = runPsScript(`
          $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = ${parsed.pid}" | Select-Object -ExpandProperty CommandLine) 2>$null
          $cmdline
        `, 4000)
        const conn: LcuConnectionInfo = {
          ...parsed,
          region: extractFromCmdline(region, /--region=([\w\-_]+)/),
          rsoPlatformId: extractFromCmdline(region, /--rso_platform_id=([\w\-_]+)/),
        }
        console.log(`[LCU:DIAG] findLolClient #${callSeq} 完成 (方案2): totalElapsed=${Date.now() - t0}ms`)
        return conn
      }
    }

    // ═══ 方案3：WMIC 读命令行（Win10 可用，Win11 24H2 已移除）══════
    const wmicT0 = Date.now()
    const wmicRaw = runWmic('LeagueClientUx.exe', 8000)
    console.log(`[LCU:DIAG] 方案3 WMIC: elapsed=${Date.now() - wmicT0}ms resultLen=${wmicRaw.length}`)
    if (wmicRaw) {
      const wmicParsed = parseWmicOutput(wmicRaw)
      if (wmicParsed) {
        console.log(`[LCU:MAIN] 检测到 LCU (方案3): port=${wmicParsed.port}, pid=${wmicParsed.pid}, pidAlive=${isPidAlive(wmicParsed.pid)}`)
        const region = runPsScript(`
          $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = ${wmicParsed.pid}" | Select-Object -ExpandProperty CommandLine) 2>$null
          $cmdline
        `, 4000)
        const conn: LcuConnectionInfo = {
          ...wmicParsed,
          region: extractFromCmdline(region, /--region=([\w\-_]+)/),
          rsoPlatformId: extractFromCmdline(region, /--rso_platform_id=([\w\-_]+)/),
        }
        console.log(`[LCU:DIAG] findLolClient #${callSeq} 完成 (方案3): totalElapsed=${Date.now() - t0}ms`)
        return conn
      }
    }

    // ═══ 方案4：PowerShell Get-CimInstance 命令行兜底（需管理员）═════
    const ps4T0 = Date.now()
    const cmdline = runPsScript(`
      $p = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { exit 0 }
      $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)" | Select-Object -ExpandProperty CommandLine) 2>$null
      if (-not $cmdline) { $cmdline = (Get-WmiObject Win32_Process -Filter "ProcessId = $($p.Id)" | Select-Object -ExpandProperty CommandLine) 2>$null }
      $cmdline
    `, PS_EXEC_TIMEOUT)
    console.log(`[LCU:DIAG] 方案4 PS cmdline: elapsed=${Date.now() - ps4T0}ms resultLen=${cmdline.length}`)

    if (cmdline) {
      const port = extractFromCmdline(cmdline, /--app-port=(\d+)/)
      const authToken = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
      if (port && authToken) {
        const pid = parseInt(extractFromCmdline(cmdline, /--app-pid=(\d+)/) || '0')
        console.log(`[LCU:MAIN] 检测到 LCU (方案4): port=${port}, pid=${pid}, pidAlive=${isPidAlive(pid)}`)
        const conn: LcuConnectionInfo = {
          port: parseInt(port), authToken, pid,
          region: extractFromCmdline(cmdline, /--region=([\w\-_]+)/),
          rsoPlatformId: extractFromCmdline(cmdline, /--rso_platform_id=([\w\-_]+)/),
        }
        console.log(`[LCU:DIAG] findLolClient #${callSeq} 完成 (方案4): totalElapsed=${Date.now() - t0}ms`)
        return conn
      }
    }

    // 全部失败 — 诊断输出
    console.log(`[LCU:DIAG] findLolClient #${callSeq} 全部方案失败: totalElapsed=${Date.now() - t0}ms` +
      ` lockfiles=${lockfiles.length} ps2=${!!lockfileResult} wmic=${!!wmicRaw} ps4=${!!cmdline}`)

    const diagResult = runPsScript(`
      Get-Process -Name '*League*','*LOL*','*Riot*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -Unique
      Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*League*' -or $_.Name -like '*LOL*' -or $_.Name -like '*Riot*' } | Select-Object -ExpandProperty Name | Sort-Object -Unique
    `, 8000)

    if (diagResult) {
      console.log(`[LCU:MAIN] 全部4种方案均失败。检测到相关进程: ${diagResult.replace(/\n/g, ', ')}`)
    } else {
      console.log('[LCU:MAIN] 全部4种方案均失败，且未检测到任何 LOL 进程 — 请确认游戏已启动并登录')
    }
    return null
  } catch (err: any) {
    console.error(`[LCU:MAIN] 进程检测异常: ${err.message || err}`)
    return null
  }
}

/** 解析 lockfile 格式: name:pid:port:authToken:protocol（带详细诊断） */
function parseLockfileWithDiag(
  path: string,
  content: string
): { port: number; authToken: string; pid: number } | null {
  const parts = content.trim().split(':')
  if (parts.length < 4) {
    console.log(`[LCU:DIAG] lockfile 格式错误: ${path} fields=${parts.length} raw="${content.trim()}"`)
    return null
  }
  if (parts[0] !== 'LeagueClient') {
    console.log(`[LCU:DIAG] lockfile 非 LeagueClient: ${path} name=${parts[0]} (跳过，可能是 RiotClient)`)
    return null
  }
  const port = parseInt(parts[2]) || 0
  const authToken = parts[3]
  const pid = parseInt(parts[1]) || 0
  if (!port || !authToken) {
    console.log(`[LCU:DIAG] lockfile 字段无效: ${path} port=${parts[2]} authToken=${parts[3] ? '有' : '无'}`)
    return null
  }
  return { port, authToken, pid }
}

/** 解析 lockfile 格式: name:pid:port:authToken:protocol（备用于非 Node.js 路径） */
function parseLockfile(content: string): { port: number; authToken: string; pid: number } | null {
  const parts = content.trim().split(':')
  if (parts.length < 4) return null
  if (parts[0] !== 'LeagueClient') return null
  const port = parseInt(parts[2]) || 0
  const authToken = parts[3]
  const pid = parseInt(parts[1]) || 0
  if (!port || !authToken) return null
  return { port, authToken, pid }
}

/** 从命令行字符串中提取正则匹配 */
function extractFromCmdline(cmdline: string, pattern: RegExp): string {
  const m = cmdline.match(pattern)
  return m ? m[1] : ''
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
