/**
 * LCU 连接发现 + HTTP 客户端
 * 对标 LeagueAkari shared/http-api-axios-helper/league-client 层的职责
 */
import { execSync } from 'child_process'
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
  const encoded = encodePsCommand(script)
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
    // CSV 格式: Node,CommandLine,ProcessId
    const match = line.match(/^[^,]*,(.+),(\d+)$/)
    if (!match) continue
    const cmdline = match[1].replace(/^"|"$/g, '') // 去掉 CSV 引号包裹
    const pid = parseInt(match[2]) || 0
    const port = extractFromCmdline(cmdline, /--app-port=(\d+)/)
    const authToken = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
    if (port && authToken) {
      return { port: parseInt(port), authToken, pid }
    }
  }
  return null
}

/** 通过 PowerShell 查找 LeagueClientUx.exe 进程并解析连接参数 */
export function findLolClient(): LcuConnectionInfo | null {
  try {
    // ═══ 方案1：通过进程 Path 获取 lockfile 目录（大多数系统无需 admin）═════
    const lockfileResult = runPsScript(`
      $p = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { exit }
      try {
        $dir = Split-Path $p.Path -Parent -ErrorAction Stop
        $lf = Join-Path $dir 'lockfile'
        if (Test-Path $lf) {
          Get-Content $lf -Raw
        }
      } catch {}
    `, PS_EXEC_TIMEOUT)

    if (lockfileResult) {
      const parsed = parseLockfile(lockfileResult)
      if (parsed) {
        console.log(`[LCU:MAIN] 检测到 LCU (lockfile): port=${parsed.port}, pid=${parsed.pid}`)
        // 尝试从进程中获取 region / rsoPlatformId（可选，仅用于信息展示）
        const extraInfo = runPsScript(`
          $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = ${parsed.pid}" | Select-Object -ExpandProperty CommandLine) 2>$null
          if (-not $cmdline) { $cmdline = (Get-WmiObject Win32_Process -Filter "ProcessId = ${parsed.pid}" | Select-Object -ExpandProperty CommandLine) 2>$null }
          $cmdline
        `, 4000)

        return {
          ...parsed,
          region: extractFromCmdline(extraInfo, /--region=([\w\-_]+)/),
          rsoPlatformId: extractFromCmdline(extraInfo, /--rso_platform_id=([\w\-_]+)/),
        }
      }
    }

    // ═══ 方案2：搜索常见安装路径中的 lockfile（完全无需 admin 权限）══════
    const foundLf = runPsScript(`
      $p = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { exit }

      # 检查固定路径（覆盖常见安装位置）
      $fixedPaths = @(
        "$env:ProgramFiles\\Riot Games\\League of Legends\\lockfile",
        "\${env:ProgramFiles(x86)}\\Riot Games\\League of Legends\\lockfile",
        "$env:LOCALAPPDATA\\Riot Games\\League of Legends\\lockfile",
        "C:\\Riot Games\\League of Legends\\lockfile",
        "D:\\Riot Games\\League of Legends\\lockfile",
        "E:\\Riot Games\\League of Legends\\lockfile",
        "F:\\Riot Games\\League of Legends\\lockfile",
        "G:\\Riot Games\\League of Legends\\lockfile",
        "C:\\Program Files\\Riot Games\\Riot Client\\lockfile",
        "C:\\Riot Games\\Riot Client\\lockfile"
      )
      foreach ($fp in $fixedPaths) {
        if (Test-Path $fp) {
          Get-Content $fp -Raw
          exit
        }
      }

      # 搜索 Riot Games 目录树（深度有限）
      $roots = @("$env:ProgramFiles\\Riot Games", "\${env:ProgramFiles(x86)}\\Riot Games", "C:\\Riot Games", "D:\\Riot Games", "E:\\Riot Games", "F:\\Riot Games", "G:\\Riot Games", "$env:LOCALAPPDATA\\Riot Games")
      foreach ($root in $roots) {
        if (Test-Path $root) {
          $lf = Get-ChildItem -Path $root -Filter 'lockfile' -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1
          if ($lf) {
            Get-Content $lf.FullName -Raw
            exit
          }
        }
      }
    `, 8000)

    if (foundLf) {
      const parsed = parseLockfile(foundLf)
      if (parsed) {
        console.log(`[LCU:MAIN] 检测到 LCU (lockfile搜索): port=${parsed.port}, pid=${parsed.pid}`)
        return { ...parsed, region: '', rsoPlatformId: '' }
      }
    }

    // ═══ 方案3：WMIC 直读命令行（不依赖 PowerShell，部分系统需 admin）══════
    const wmicRaw = runWmic('LeagueClientUx.exe', 8000)
    if (wmicRaw) {
      const wmicParsed = parseWmicOutput(wmicRaw)
      if (wmicParsed) {
        console.log(`[LCU:MAIN] 检测到 LCU (WMIC): port=${wmicParsed.port}, pid=${wmicParsed.pid}`)
        // 尝试从 lockfile 补全 region 信息
        const extraInfo = runPsScript(`
          $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = ${wmicParsed.pid}" | Select-Object -ExpandProperty CommandLine) 2>$null
          $cmdline
        `, 4000)
        return {
          ...wmicParsed,
          region: extractFromCmdline(extraInfo, /--region=([\w\-_]+)/),
          rsoPlatformId: extractFromCmdline(extraInfo, /--rso_platform_id=([\w\-_]+)/),
        }
      }
    }

    // ═══ 方案4：回退到 PowerShell Get-CimInstance 解析命令行（最终兜底）══════
    const cmdline = runPsScript(`
      $p = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { exit }
      $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)" | Select-Object -ExpandProperty CommandLine)
      if (-not $cmdline) {
        $cmdline = (Get-WmiObject Win32_Process -Filter "ProcessId = $($p.Id)" | Select-Object -ExpandProperty CommandLine)
      }
      $cmdline
    `, PS_EXEC_TIMEOUT)

    if (!cmdline) {
      // 输出进程名辅助诊断
      const diagResult = runPsScript(`
        Get-Process -Name '*League*','*LOL*','*Riot*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -Unique
        Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*League*' -or $_.Name -like '*LOL*' -or $_.Name -like '*英雄联盟*' -or $_.Name -like '*Riot*' } | Select-Object -ExpandProperty Name | Sort-Object -Unique
      `, 8000)

      if (diagResult) {
        console.log(`[LCU:MAIN] 全部4种方案均失败。检测到相关进程: ${diagResult.replace(/\n/g, ', ')}`)
      } else {
        console.log('[LCU:MAIN] 全部4种方案均失败，且未检测到任何 LOL 进程 — 请确认游戏已启动并登录')
      }
      return null
    }

    const port = extractFromCmdline(cmdline, /--app-port=(\d+)/)
    const authToken = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
    if (!port || !authToken) {
      console.warn(`[LCU:MAIN] 找到进程但无法解析连接参数, cmdline=${cmdline.slice(0, 200)}`)
      return null
    }

    console.log(`[LCU:MAIN] 检测到 LCU (PS cmdline): port=${port}, region=${extractFromCmdline(cmdline, /--region=([\w\-_]+)/)}`)
    return {
      port: parseInt(port),
      authToken,
      pid: parseInt(extractFromCmdline(cmdline, /--app-pid=(\d+)/) || '0'),
      region: extractFromCmdline(cmdline, /--region=([\w\-_]+)/),
      rsoPlatformId: extractFromCmdline(cmdline, /--rso_platform_id=([\w\-_]+)/),
    }
  } catch (err: any) {
    console.error(`[LCU:MAIN] 进程检测异常: ${err.message || err}`)
    return null
  }
}

/** 解析 lockfile 格式: name:pid:port:authToken:protocol */
function parseLockfile(content: string): { port: number; authToken: string; pid: number } | null {
  const parts = content.trim().split(':')
  if (parts.length < 4) return null
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

  constructor(conn: LcuConnectionInfo) {
    this.baseUrl = `https://127.0.0.1:${conn.port}`
    const auth = Buffer.from(`riot:${conn.authToken}`).toString('base64')

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
        // 仅对连接拒绝和服务端临时错误重试
        const retryable = code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
          status === 502 || status === 503 || status === 504
        if (!retryable || attempt === MAX_RETRIES) {
          const detail = status === 404 ? ' (数据可能已过期或不存在)' : ''
          console.error(`[LCU:MAIN] LCU API 请求失败 [${status || code}] ${endpoint}: ${err.message || err}${detail}`)
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

  /** 通过召唤师数字 ID 查询任意玩家 */
  async getSummonerById(summonerId: number) {
    return this.get<import('@shared/types').LcuSummoner>(
      `/lol-summoner/v1/summoners/${summonerId}`
    )
  }

  /** 通过旧式召唤师名查询（可能不支持 Riot ID #tag 格式） */
  async getSummonerByName(name: string) {
    return this.get<import('@shared/types').LcuSummoner>(
      `/lol-summoner/v1/summoners?name=${encodeURIComponent(name)}`
    )
  }

  /** 通过 PUUID 查询召唤师（验证用） */
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

  /** 使用 beginIndex（完整拼写）参数名 —— 部分 LCU 版本（如 TENCENT）使用此格式 */
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
