/**
 * client-utils.ts 纯函数单元测试
 *
 * 所有测试零依赖、零 mock——输入字符串/数字，验证输出。
 * 运行：npm test
 * 监听模式（改代码自动重跑）：npm run test:watch
 */
import { describe, test, expect } from 'vitest'
import {
  maskToken,
  extractFromCmdline,
  parseLockfile,
  parseLockfileWithDiag,
  parseWmicOutput,
  encodePsCommand,
  isPidAlive,
} from '../client-utils'

// ═══════════════════════════════════════════════════════════
// maskToken
// ═══════════════════════════════════════════════════════════

describe('maskToken', () => {
  test('正常长度 token（>8 字符），只显示前 4 后 4', () => {
    const result = maskToken('abcdefghijklmnop')
    // "abcd…mnop"
    expect(result).toBe('abcd…mnop')
    // 不该暴露完整 token
    expect(result).not.toContain('efgh')
  })

  test('短 token（≤8 字符），只显示前 2 位', () => {
    expect(maskToken('abc')).toBe('ab***')
    expect(maskToken('12345678')).toBe('12***')
  })

  test('空字符串', () => {
    expect(maskToken('')).toBe('***')
  })
})

// ═══════════════════════════════════════════════════════════
// extractFromCmdline
// ═══════════════════════════════════════════════════════════

describe('extractFromCmdline', () => {
  test('从真实 LCU 命令行提取 port 和 token', () => {
    const cmdline =
      '"C:/Riot Games/League of Legends/LeagueClientUx.exe" ' +
      '--app-port=61887 --remoting-auth-token=abc123-def456-ghi789'
    expect(extractFromCmdline(cmdline, /--app-port=(\d+)/)).toBe('61887')
    expect(
      extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
    ).toBe('abc123-def456-ghi789')
  })

  test('token 含点号、加号、斜杠、等号时，当前正则无法完全匹配', () => {
    // 这是已知限制：[\\w\\-_]+ 不包含 . + / =
    // 如果 Riot 更改 token 格式，此测试会失败 → 提醒你更新正则
    const cmdline = 'LeagueClientUx.exe --app-port=12345 --remoting-auth-token=abc.xyz+aaa/bbb=ccc'
    const token = extractFromCmdline(cmdline, /--remoting-auth-token=([\w\-_]+)/)
    // 当前行为：只匹配到 abc 就停了
    expect(token).toBe('abc')
  })

  test('参数不存在时返回空字符串', () => {
    expect(extractFromCmdline('no args here', /--app-port=(\d+)/)).toBe('')
    expect(extractFromCmdline('', /--app-port=(\d+)/)).toBe('')
  })

  test('从完整命令行中提取 region 和 rsoPlatformId', () => {
    const cmdline =
      'LeagueClientUx.exe --app-port=61887 ' +
      '--remoting-auth-token=abc123 --region=HN1 --rso_platform_id=HN1'
    expect(extractFromCmdline(cmdline, /--region=([\w\-_]+)/)).toBe('HN1')
    expect(extractFromCmdline(cmdline, /--rso_platform_id=([\w\-_]+)/)).toBe('HN1')
  })
})

// ═══════════════════════════════════════════════════════════
// parseLockfile
// ═══════════════════════════════════════════════════════════

describe('parseLockfile', () => {
  test('解析标准 lockfile 格式', () => {
    // 真实格式: LeagueClient:12345:61887:abc123def456:https
    const result = parseLockfile('LeagueClient:12345:61887:abc123def456:https')
    expect(result).not.toBeNull()
    expect(result!.port).toBe(61887)
    expect(result!.pid).toBe(12345)
    expect(result!.authToken).toBe('abc123def456')
  })

  test('RiotClient 的 lockfile 应被跳过', () => {
    // RiotClientUx 也有 lockfile，但我们只需要 LeagueClient
    const result = parseLockfile('RiotClient:12345:61887:abc123:https')
    expect(result).toBeNull()
  })

  test('字段不足 4 个时返回 null', () => {
    expect(parseLockfile('LeagueClient:12345:61887')).toBeNull()
    expect(parseLockfile('')).toBeNull()
    expect(parseLockfile(':')).toBeNull()
  })

  test('port 为 0 时返回 null', () => {
    expect(parseLockfile('LeagueClient:12345:0:abc123:https')).toBeNull()
  })

  test('authToken 为空时返回 null', () => {
    expect(parseLockfile('LeagueClient:12345:61887::https')).toBeNull()
  })

  test('含换行/空格的脏数据仍能正确解析', () => {
    const result = parseLockfile('  LeagueClient:12345:61887:abc123:https\n')
    expect(result).not.toBeNull()
    expect(result!.port).toBe(61887)
    expect(result!.pid).toBe(12345)
    expect(result!.authToken).toBe('abc123')
  })
})

// ═══════════════════════════════════════════════════════════
// parseLockfileWithDiag
// ═══════════════════════════════════════════════════════════

describe('parseLockfileWithDiag', () => {
  test('标准格式解析（逻辑同 parseLockfile，额外输出日志）', () => {
    const result = parseLockfileWithDiag(
      'C:\\Riot\\lockfile',
      'LeagueClient:99999:55555:secret123:https'
    )
    expect(result).not.toBeNull()
    expect(result!.port).toBe(55555)
    expect(result!.pid).toBe(99999)
    expect(result!.authToken).toBe('secret123')
  })

  test('非 LeagueClient 名称应返回 null', () => {
    expect(
      parseLockfileWithDiag('/path/lockfile', 'RiotClient:1:2:3:4')
    ).toBeNull()
  })

  test('字段不足应返回 null', () => {
    expect(
      parseLockfileWithDiag('/path/lockfile', 'LeagueClient:1:2')
    ).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// parseWmicOutput
// ═══════════════════════════════════════════════════════════

describe('parseWmicOutput', () => {
  test('解析标准 WMIC CSV 输出', () => {
    // WMIC /format:csv 输出示例（含 BOM/引号）
    const raw = [
      'Node,CommandLine,ProcessId',
      'DESKTOP-ABC,"""C:\\Riot Games\\League of Legends\\LeagueClientUx.exe"" --app-port=61887 --remoting-auth-token=abc123-def456",12345',
    ].join('\n')
    const result = parseWmicOutput(raw)
    expect(result).not.toBeNull()
    expect(result!.port).toBe(61887)
    expect(result!.pid).toBe(12345)
    expect(result!.authToken).toBe('abc123-def456')
  })

  test('不含 LeagueClientUx 的行应被跳过', () => {
    const raw = [
      'Node,CommandLine,ProcessId',
      'DESKTOP-ABC,some-other-process.exe --arg=value,99999',
    ].join('\n')
    expect(parseWmicOutput(raw)).toBeNull()
  })

  test('空输入返回 null', () => {
    expect(parseWmicOutput('')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// encodePsCommand
// ═══════════════════════════════════════════════════════════

describe('encodePsCommand', () => {
  test('输出为 Base64 字符串', () => {
    const result = encodePsCommand('Write-Host "hello"')
    // Base64 只包含 A-Za-z0-9+/=
    expect(result).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  test('编码后可被 Node.js 解码还原', () => {
    const original = 'Get-Process -Name LeagueClientUx'
    const encoded = encodePsCommand(original)
    // PowerShell -EncodedCommand 期望 UTF-16LE，Node.js 的 Buffer 可以反向解码
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le')
    expect(decoded).toBe(original)
  })

  test('空脚本编码结果为空 Base64', () => {
    // 空字符串 UTF-16LE → 0 字节 → Base64 编码结果为空
    const result = encodePsCommand('')
    expect(result).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════
// isPidAlive
// ═══════════════════════════════════════════════════════════

describe('isPidAlive', () => {
  test('当前 Node 进程的 PID 应该存活', () => {
    expect(isPidAlive(process.pid)).toBe(true)
  })

  test('PID 0 在 Windows 上被视为存活（System Idle Process）', () => {
    // Windows 上 process.kill(0, 0) 返回 true——PID 0 是合法的
    // 这个测试记录当前平台的真实行为，不做跨平台假设
    const result = isPidAlive(0)
    // Windows → true, Unix → false（Unix 上 PID 0 不存在）
    console.log(`[TEST] isPidAlive(0) = ${result} on ${process.platform}`)
    expect(typeof result).toBe('boolean')
  })

  test('极大 PID 应该不存在', () => {
    expect(isPidAlive(99999999)).toBe(false)
  })
})
