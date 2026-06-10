import { describe, test, expect } from 'vitest'
import { buildChatMessages } from '../chat-service'
import { makeGameRecord } from '@domain/analysis/__tests__/fixtures'
import type { GameDataCache } from '@shared/types'

function makeEmptyGds(): GameDataCache {
  return {
    champions: {},
    items: {},
    summonerSpells: {},
    perks: {},
    perkstyles: { schemaVersion: 0, styles: {} },
    queues: {},
    augments: {},
  }
}

describe('buildChatMessages', () => {
  test('空对局列表返回"无对局数据"', () => {
    const msgs = buildChatMessages([], makeEmptyGds(), [])
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('无对局数据')
  })

  test('system prompt 包含指令规则', () => {
    const g = makeGameRecord()
    const msgs = buildChatMessages([g], makeEmptyGds(), [])
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('英雄联盟对局数据分析师')
    expect(msgs[0].content).toContain('仅使用下方提供的对局数据回答问题')
  })

  test('单场对局包含对局编号和时长', () => {
    const g = makeGameRecord()
    const msgs = buildChatMessages([g], makeEmptyGds(), [])
    expect(msgs[0].content).toContain('对局 #1')
    expect(msgs[0].content).toContain('26min')
  })

  test('system prompt 包含玩家名', () => {
    const g = makeGameRecord()
    const msgs = buildChatMessages([g], makeEmptyGds(), [])
    expect(msgs[0].content).toContain('BlueA')
    expect(msgs[0].content).toContain('RedA')
  })

  test('空历史返回单条 system 消息', () => {
    const g = makeGameRecord()
    const msgs = buildChatMessages([g], makeEmptyGds(), [])
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('system')
  })

  test('历史消息追加在 system 之后保持顺序', () => {
    const g = makeGameRecord()
    const history = [
      { role: 'user' as const, content: '分析一下' },
      { role: 'assistant' as const, content: '好的' },
    ]
    const msgs = buildChatMessages([g], makeEmptyGds(), history)
    expect(msgs).toHaveLength(3)
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).toBe('分析一下')
    expect(msgs[2].role).toBe('assistant')
    expect(msgs[2].content).toBe('好的')
  })

  test('多场对局按顺序排列', () => {
    const g1 = makeGameRecord()
    const g2 = makeGameRecord()
    const msgs = buildChatMessages([g1, g2], makeEmptyGds(), [])
    expect(msgs[0].content).toContain('对局 #1')
    expect(msgs[0].content).toContain('对局 #2')
  })
})
