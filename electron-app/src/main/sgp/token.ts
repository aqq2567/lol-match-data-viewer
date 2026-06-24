/**
 * SGP entitlements token 获取
 *
 * 通过 LCU 本地 API 获取 JWT Bearer 凭证，用于后续 SGP API 调用。
 * 这是 SGP 模块和 IPC handler 的共同依赖，放在这里打破循环依赖：
 *   sgp/index.ts → sgp/token.ts ← ipc/lcu-handlers.ts
 * 两者都依赖 token.ts，但 token.ts 不依赖任何一方。
 */
import { findLolClient, LcuHttpClient } from '../lcu/client'

/**
 * 从 LCU 获取 entitlements token (JWT)。
 * 成功返回 token 字符串，失败返回 null（调用方降级处理）。
 */
export async function fetchEntitlementsToken(): Promise<string | null> {
  try {
    const conn = await findLolClient()
    if (!conn) {
      console.warn('[SGP] No LCU connection — cannot fetch entitlements token')
      return null
    }

    const client = new LcuHttpClient(conn)
    const resp = await client.get<{ accessToken: string; token: string; subject: string }>(
      '/entitlements/v1/token'
    )
    const token = resp?.accessToken || ''
    if (token) {
      console.log('[SGP] entitlements token acquired')
    } else {
      console.warn('[SGP] entitlements token response had no accessToken field')
    }
    return token || null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[SGP] Failed to fetch entitlements token: ${msg}`)
    return null
  }
}
