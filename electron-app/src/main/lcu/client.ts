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

/** 通过 PowerShell 查找 LeagueClientUx.exe 进程并解析连接参数 */
export function findLolClient(): LcuConnectionInfo | null {
  try {
    // ═══ 首选方案：通过 lockfile 读取（无需 admin 权限）═════
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
      // lockfile 格式: LeagueClientUx:pid:port:authToken:https
      const parts = lockfileResult.trim().split(':')
      if (parts.length >= 4) {
        const pid = parseInt(parts[1]) || 0
        const port = parseInt(parts[2]) || 0
        const authToken = parts[3]
        if (port && authToken) {
          console.log(`[LCU:MAIN] 检测到 LCU (lockfile): port=${port}, pid=${pid}`)

          // 尝试从进程中获取 region / rsoPlatformId（可选，仅用于信息展示）
          const extraInfo = runPsScript(`
            $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine) 2>$null
            if (-not $cmdline) { $cmdline = (Get-WmiObject Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine) 2>$null }
            $cmdline
          `, 4000)

          const extract = (pattern: string): string => {
            const m = extraInfo.match(pattern)
            return m ? m[1] : ''
          }

          return {
            port,
            authToken,
            pid,
            region: extract(/--region=([\w\-_]+)/),
            rsoPlatformId: extract(/--rso_platform_id=([\w\-_]+)/),
          }
        }
      }
    }

    // ═══ 回退方案：通过进程命令行解析（部分系统需 admin 权限）═════
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
        console.log(`[LCU:MAIN] 未找到 LeagueClientUx.exe，但检测到以下相关进程: ${diagResult.replace(/\n/g, ', ')}`)
      } else {
        console.log('[LCU:MAIN] 未检测到任何 League/LOL/Riot 相关进程')
      }
      return null
    }

    const extract = (pattern: string): string => {
      const m = cmdline.match(pattern)
      return m ? m[1] : ''
    }

    const port = extract(/--app-port=(\d+)/)
    const authToken = extract(/--remoting-auth-token=([\w\-_]+)/)
    if (!port || !authToken) {
      console.warn(`[LCU:MAIN] 找到进程但无法解析连接参数, cmdline=${cmdline.slice(0, 200)}`)
      return null
    }

    console.log(`[LCU:MAIN] 检测到 LCU (cmdline): port=${port}, region=${extract(/--region=([\w\-_]+)/)}`)
    return {
      port: parseInt(port),
      authToken,
      pid: parseInt(extract(/--app-pid=(\d+)/) || '0'),
      region: extract(/--region=([\w\-_]+)/),
      rsoPlatformId: extract(/--rso_platform_id=([\w\-_]+)/),
    }
  } catch (err: any) {
    console.error(`[LCU:MAIN] 进程检测异常: ${err.message || err}`)
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// HTTP 客户端
// ═══════════════════════════════════════════════════════════

/** LCU HTTP 请求默认超时（毫秒） */
const LCU_HTTP_TIMEOUT = 15000

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
    try {
      const resp = await this.axios.get<T>(endpoint)
      return resp.data
    } catch (err: any) {
      const status = err.response?.status || err.code || 'NET'
      const detail = status === 404 ? ' (数据可能已过期或不存在)' : ''
      console.error(`[LCU:MAIN] LCU API 请求失败 [${status}] ${endpoint}: ${err.message || err}${detail}`)
      throw err
    }
  }

  // ── 召唤师与战绩 ──

  async getCurrentSummoner() {
    return this.get<{
      puuid: string
      displayName: string
      summonerLevel: number
    }>('/lol-summoner/v1/current-summoner')
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
