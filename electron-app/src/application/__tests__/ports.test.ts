import { describe, test, expect, vi } from 'vitest'
import {
  createMatchRepository,
  createSessionRepository,
  createGameDataRepository,
  createChatRepository,
  createSettingsRepository,
} from '../ports'

// ═══════════════════════════════════════════════════════════
// createMatchRepository
// ═══════════════════════════════════════════════════════════

describe('createMatchRepository', () => {
  test('findByIds 委托给 raw.fetchGameDetails', async () => {
    const raw = { fetchGameDetails: vi.fn().mockResolvedValue([]), fetchMatchList: vi.fn(), fetchPlayerMatchList: vi.fn() }
    const repo = createMatchRepository(raw)
    await repo.findByIds([1, 2])
    expect(raw.fetchGameDetails).toHaveBeenCalledWith([1, 2])
  })

  test('findCurrentSummonerMatches 委托给 raw.fetchMatchList', async () => {
    const raw = { fetchGameDetails: vi.fn(), fetchMatchList: vi.fn().mockResolvedValue({}), fetchPlayerMatchList: vi.fn() }
    const repo = createMatchRepository(raw)
    await repo.findCurrentSummonerMatches(2, 30)
    expect(raw.fetchMatchList).toHaveBeenCalledWith(2, 30)
  })

  test('findPlayerMatches 委托给 raw.fetchPlayerMatchList', async () => {
    const raw = { fetchGameDetails: vi.fn(), fetchMatchList: vi.fn(), fetchPlayerMatchList: vi.fn().mockResolvedValue({}) }
    const repo = createMatchRepository(raw)
    await repo.findPlayerMatches('puuid-1', 'Test', 100, 30, 1, 20)
    expect(raw.fetchPlayerMatchList).toHaveBeenCalledWith('puuid-1', 'Test', 100, 30, 1, 20)
  })
})

// ═══════════════════════════════════════════════════════════
// createSessionRepository
// ═══════════════════════════════════════════════════════════

describe('createSessionRepository', () => {
  test('checkConnection 委托给 raw.checkConnection', async () => {
    const info = { port: 12345, authToken: 't', pid: 1, region: '', rsoPlatformId: '' }
    const raw = { checkConnection: vi.fn().mockResolvedValue(info), getCurrentSummoner: vi.fn() }
    const port = createSessionRepository(raw)
    const result = await port.checkConnection()
    expect(result).toBe(info)
  })

  test('getCurrentSummoner 委托给 raw.getCurrentSummoner', async () => {
    const sum = { id: 1, displayName: 'Test', puuid: 'p', summonerId: 1 }
    const raw = { checkConnection: vi.fn(), getCurrentSummoner: vi.fn().mockResolvedValue(sum) }
    const port = createSessionRepository(raw)
    const result = await port.getCurrentSummoner()
    expect(result).toBe(sum)
  })
})

// ═══════════════════════════════════════════════════════════
// createGameDataRepository
// ═══════════════════════════════════════════════════════════

describe('createGameDataRepository', () => {
  test('load 委托给 raw.fetchGameData', async () => {
    const data = { champions: {}, items: {}, summonerSpells: {}, perks: {}, perkstyles: { schemaVersion: 0, styles: {} }, queues: {}, augments: {} }
    const raw = { fetchGameData: vi.fn().mockResolvedValue(data) }
    const port = createGameDataRepository(raw)
    const result = await port.load()
    expect(result).toBe(data)
  })
})

// ═══════════════════════════════════════════════════════════
// createChatRepository
// ═══════════════════════════════════════════════════════════

describe('createChatRepository', () => {
  test('sendMessage 委托给 raw.chatWithAI', async () => {
    const msgs = [{ role: 'user' as const, content: 'hi' }]
    const resp = { status: 'ok', content: 'hello' }
    const raw = { chatWithAI: vi.fn().mockResolvedValue(resp) }
    const port = createChatRepository(raw)
    const result = await port.sendMessage(msgs)
    expect(raw.chatWithAI).toHaveBeenCalledWith(msgs)
    expect(result).toBe(resp)
  })
})

// ═══════════════════════════════════════════════════════════
// createSettingsRepository — 部分应用逻辑需验证
// ═══════════════════════════════════════════════════════════

describe('createSettingsRepository', () => {
  const makeRaw = () => ({
    getSettings: vi.fn().mockResolvedValue({ autoUpdate: true, deepseekApiKey: '' }),
    setSetting: vi.fn().mockResolvedValue(undefined),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    openLogsDir: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    onUpdateStatus: vi.fn(),
  })

  test('load 委托给 raw.getSettings', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    const cfg = await port.load()
    expect(cfg).toEqual({ autoUpdate: true, deepseekApiKey: '' })
  })

  test('setAutoUpdate 通过 setSetting 写入 key=autoUpdate', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    await port.setAutoUpdate(false)
    expect(raw.setSetting).toHaveBeenCalledWith('autoUpdate', false)
  })

  test('setDeepseekApiKey 通过 setSetting 写入 key=deepseekApiKey', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    await port.setDeepseekApiKey('sk-abc123')
    expect(raw.setSetting).toHaveBeenCalledWith('deepseekApiKey', 'sk-abc123')
  })

  test('openExternal 委托给 raw.openExternal', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    await port.openExternal('https://example.com')
    expect(raw.openExternal).toHaveBeenCalledWith('https://example.com')
  })

  test('openLogsDir 委托给 raw.openLogsDir', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    await port.openLogsDir()
    expect(raw.openLogsDir).toHaveBeenCalled()
  })

  test('checkForUpdates 委托给 raw.checkForUpdates', async () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    await port.checkForUpdates()
    expect(raw.checkForUpdates).toHaveBeenCalled()
  })

  test('quitAndInstall 委托给 raw.quitAndInstall', () => {
    const raw = makeRaw()
    const port = createSettingsRepository(raw)
    port.quitAndInstall()
    expect(raw.quitAndInstall).toHaveBeenCalled()
  })
})
