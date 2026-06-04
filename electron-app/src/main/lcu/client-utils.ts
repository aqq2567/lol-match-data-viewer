/**
 * LCU 连接检测 —— 纯函数工具集
 * 零外部依赖（不 import fs / child_process / axios），可在测试中直接使用
 */
import fs from 'fs'

/** 脱敏 authToken：仅保留前 4 位和后 4 位，防止日志泄露完整凭据 */
export function maskToken(tok: string): string {
  if (tok.length <= 8) return tok.slice(0, 2) + '***'
  return tok.slice(0, 4) + '…' + tok.slice(-4)
}

/** 从命令行字符串中提取正则匹配（如 --app-port=61887 → "61887"） */
export function extractFromCmdline(cmdline: string, pattern: RegExp): string {
  const m = cmdline.match(pattern)
  return m ? m[1] : ''
}

/**
 * 解析 lockfile 内容，格式: name:pid:port:authToken:protocol
 * 返回 port / authToken / pid，解析失败返回 null
 */
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

/**
 * 解析 lockfile 内容（带诊断日志版本）
 * 与 parseLockfile 逻辑一致，额外输出格式校验信息
 */
export function parseLockfileWithDiag(
  filePath: string,
  content: string
): { port: number; authToken: string; pid: number } | null {
  const parts = content.trim().split(':')
  if (parts.length < 4) {
    console.log(`[LCU:DIAG] lockfile 格式错误: ${filePath} fields=${parts.length} raw="${content.trim()}"`)
    return null
  }
  if (parts[0] !== 'LeagueClient') {
    console.log(`[LCU:DIAG] lockfile 非 LeagueClient: ${filePath} name=${parts[0]} (跳过，可能是 RiotClient)`)
    return null
  }
  const port = parseInt(parts[2]) || 0
  const authToken = parts[3]
  const pid = parseInt(parts[1]) || 0
  if (!port || !authToken) {
    console.log(`[LCU:DIAG] lockfile 字段无效: ${filePath} port=${parts[2]} authToken=${parts[3] ? '有' : '无'}`)
    return null
  }
  return { port, authToken, pid }
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

/** 将 PowerShell 脚本编码为 Base64（UTF-16LE），通过 -EncodedCommand 安全传入 */
function encodePsCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** 用 process.kill(pid, 0) 检查 PID 是否存活（Windows 兼容） */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 获取文件 mtime 到现在经过的秒数（用于判断 lockfile 新旧） */
export function lockfileAgeSeconds(filePath: string): number {
  try {
    return (Date.now() - fs.statSync(filePath).mtimeMs) / 1000
  } catch {
    return -1
  }
}
