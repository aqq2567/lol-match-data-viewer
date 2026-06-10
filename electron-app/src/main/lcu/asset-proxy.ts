/**
 * LCU 图片资源代理
 * 注册 lcu-asset:// 自定义协议，将渲染进程的图片请求代理到 LCU 本地 API
 */
import { protocol } from 'electron'
import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'
import { getLastConnection } from './client'

// ═══════════════════════════════════════════════════════════
// 简易并发限制器（对标 LeagueAkari PQueue concurrency=8）
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

/** 缓存的 lcu-asset 协议代理 Axios 实例（惰性创建，端口变化时自动重建） */
let _assetAxios: AxiosInstance | null = null
let _assetAxiosPort: number | null = null

function getAssetAxios(): AxiosInstance | null {
  const conn = getLastConnection()
  if (!conn) return null
  if (_assetAxiosPort !== conn.port) {
    const auth = Buffer.from(`riot:${conn.authToken}`).toString('base64')
    _assetAxios = axios.create({
      baseURL: `https://127.0.0.1:${conn.port}`,
      headers: { Authorization: `Basic ${auth}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      httpAgent: new http.Agent(),
      timeout: ASSET_PROXY_TIMEOUT,
      proxy: false,
    })
    _assetAxiosPort = conn.port
    console.log(`[LCU:MAIN] lcu-asset Axios 实例已创建: port=${conn.port}`)
  }
  return _assetAxios
}

export function registerLcuAssetProtocol() {
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
    } catch (err: unknown) {
      const axiosErr = err as { code?: string; response?: { status?: number } }
      if (axiosErr.response?.status === 404) {
        return new Response('Not found', { status: 404 })
      }
      const status = axiosErr.response?.status || 'NET'
      const code = axiosErr.code || ''
      console.warn(
        `[LCU:MAIN] lcu-asset 代理失败 [${status}${code ? ' ' + code : ''}]: ${fullPath}`
      )
      return new Response('Internal error', { status: 500 })
    }
  })
}
