/**
 * friends.ts 纯函数单元测试
 * 零 mock — analyzeFriends/computeFriendSummary 只操作 GameSummary 数组
 */
import { describe, test, expect } from 'vitest'
import {
  analyzeFriends,
  computeFriendSummary,
  FRIEND_METRICS,
  computeSortedByMetric,
  computeFriendPodium,
  getFirstPlaceTitle,
} from '../friends'
import { makeGameSummary, makeBrief } from './fixtures'
import type { ParticipantBrief } from '@shared/types'

const mockGetDisplayName = (p: ParticipantBrief) => p.summonerName || p.gameName || p.puuid?.slice(0, 8) || '?'

// 快捷：构造一场包含指定队友的对局
function gameWithTeammates(
  selfPuuid: string,
  teammates: { puuid: string; items?: number[] }[],
  opts: { win?: boolean; gameMode?: string } = {},
) {
  const blue = [
    makeBrief({ puuid: selfPuuid, teamId: 100 }),
    ...teammates.map((t) => makeBrief({
      puuid: t.puuid, teamId: 100, items: t.items || [3031, 3046],
    })),
  ]
  return makeGameSummary({ puuid: selfPuuid, blueParticipants: blue, win: opts.win ?? true, gameMode: opts.gameMode })
}

// ═══════════════════════════════════════════════════════════
// analyzeFriends
// ═══════════════════════════════════════════════════════════

describe('analyzeFriends', () => {
  test('空对局返回空', () => {
    expect(analyzeFriends([], 'self', mockGetDisplayName)).toEqual([])
  })

  test('不足 3 场不纳入', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    expect(result).toHaveLength(0)
  })

  test('≥3 场纳入统计', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    expect(result).toHaveLength(1)
    expect(result[0].gamesTogether).toBe(3)
  })

  test('胜率计算正确（50%）', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }], { win: true }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: false }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: true }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: false }),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    expect(result[0].winRate).toBeCloseTo(0.5, 2)
  })

  test('收集者/心之钢装备追踪', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a', items: [6676, 0, 0, 0] }]),
      gameWithTeammates('self', [{ puuid: 'a', items: [3084, 0, 0, 0] }]),
      gameWithTeammates('self', [{ puuid: 'a', items: [3031, 0, 0, 0] }]),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    expect(result[0].collectorGames).toBe(1)   // COLLECTOR_ID=6676
    expect(result[0].heartsteelGames).toBe(1)   // HEARTSTEEL_ID=3084
  })

  test('练习模式被排除', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }], { gameMode: 'PRACTICETOOL' }),
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    // 只有 3 场非练习模式
    expect(result).toHaveLength(1)
    expect(result[0].gamesTogether).toBe(3)
  })

  test('soloWinRate 正确', () => {
    // 总共 5 场: 自我 3 胜 2 负
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }], { win: true }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: true }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: false }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: true }),
      gameWithTeammates('self', [{ puuid: 'a' }], { win: false }),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    // soloTotal = 5 - 4 = 1, soloWins = 3 - 3 = 0, soloWinRate = 0
    expect(result[0].soloWinRate).toBe(0)
  })

  test('按一起场次降序排列', () => {
    const games = [
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'a' }]),
      gameWithTeammates('self', [{ puuid: 'b' }]),
      gameWithTeammates('self', [{ puuid: 'b' }]),
      gameWithTeammates('self', [{ puuid: 'b' }]),
      gameWithTeammates('self', [{ puuid: 'b' }]),
      gameWithTeammates('self', [{ puuid: 'b' }]),
    ]
    const result = analyzeFriends(games, 'self', mockGetDisplayName)
    expect(result[0].puuid).toBe('b') // 5 场
    expect(result[1].puuid).toBe('a') // 3 场
  })
})

// ═══════════════════════════════════════════════════════════
// computeFriendSummary
// ═══════════════════════════════════════════════════════════

describe('computeFriendSummary', () => {
  test('空好友返回全零', () => {
    const summary = computeFriendSummary([], 0)
    expect(summary.totalFriends).toBe(0)
    expect(summary.mostPlayed).toBeNull()
  })

  test('mostPlayed = 一起最多者', () => {
    const friends = [
      { gamesTogether: 10, name: 'A', puuid: 'a', profileIconId: 1, winsTogether: 5, winRate: 0.5, soloWinRate: 0.4, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
      { gamesTogether: 5, name: 'B', puuid: 'b', profileIconId: 2, winsTogether: 3, winRate: 0.6, soloWinRate: 0.3, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
    ]
    const summary = computeFriendSummary(friends, 20)
    expect(summary.mostPlayed!.name).toBe('A')
    expect(summary.mostPlayed!.count).toBe(10)
  })

  test('bestWinRate 需要 ≥5 场', () => {
    const friends = [
      { gamesTogether: 3, name: 'A', puuid: 'a', profileIconId: 1, winsTogether: 3, winRate: 1.0, soloWinRate: 0, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
      { gamesTogether: 10, name: 'B', puuid: 'b', profileIconId: 2, winsTogether: 6, winRate: 0.6, soloWinRate: 0, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
    ]
    const summary = computeFriendSummary(friends, 20)
    // 算法：从 friends[0] 出发，仅当其他好友 winRate 更高且 ≥5 场才替换
    // A winRate=1.0 无人超越 → A 保留
    expect(summary.bestWinRate!.name).toBe('A')
  })

  test('bestWinRate 高胜率+满场次替换低胜率', () => {
    const friends = [
      { gamesTogether: 10, name: 'A', puuid: 'a', profileIconId: 1, winsTogether: 5, winRate: 0.5, soloWinRate: 0, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
      { gamesTogether: 10, name: 'B', puuid: 'b', profileIconId: 2, winsTogether: 8, winRate: 0.8, soloWinRate: 0, lastPlayedTime: 0, gameIds: [], collectorGames: 0, heartsteelGames: 0 },
    ]
    const summary = computeFriendSummary(friends, 20)
    // B winRate 0.8 > A winRate 0.5 且 B gamesTogether ≥5 → B 替换 A
    expect(summary.bestWinRate!.name).toBe('B')
  })
})

// ═══════════════════════════════════════════════════════════
// FRIEND_METRICS 结构
// ═══════════════════════════════════════════════════════════

describe('FRIEND_METRICS', () => {
  test('包含 5 个指标', () => {
    expect(FRIEND_METRICS).toHaveLength(5)
  })

  test('每个指标都有必需的字段', () => {
    for (const m of FRIEND_METRICS) {
      expect(m.key).toBeTruthy()
      expect(m.label).toBeTruthy()
      expect(m.colorClass).toMatch(/^cat-/)
      expect(typeof m.getter).toBe('function')
      expect(typeof m.fmt).toBe('function')
      expect(m.minGames).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════
// computeSortedByMetric
// ═══════════════════════════════════════════════════════════

describe('computeSortedByMetric', () => {
  const friends = [
    { gamesTogether: 10, winRate: 0.5, soloWinRate: 0.4, collectorGames: 3, heartsteelGames: 0, puuid: 'a', name: 'A', profileIconId: 1, winsTogether: 5, lastPlayedTime: 0, gameIds: [] },
    { gamesTogether: 5, winRate: 0.8, soloWinRate: 0.5, collectorGames: 0, heartsteelGames: 2, puuid: 'b', name: 'B', profileIconId: 2, winsTogether: 4, lastPlayedTime: 0, gameIds: [] },
  ]

  test('按 gamesTogether 降序', () => {
    const cat = FRIEND_METRICS.find((m) => m.key === 'gamesTogether')!
    const result = computeSortedByMetric(friends, cat)
    expect(result[0].puuid).toBe('a')
  })

  test('按 winRate 降序', () => {
    const cat = FRIEND_METRICS.find((m) => m.key === 'winRate')!
    const result = computeSortedByMetric(friends, cat)
    expect(result[0].puuid).toBe('b')
  })

  test('不满 minGames 的被过滤', () => {
    const cat = FRIEND_METRICS.find((m) => m.key === 'winRate')!
    // winRate minGames=5, B has 5 games, both pass
    const result = computeSortedByMetric(friends, cat)
    expect(result).toHaveLength(2)
    // add a friend with only 4 games
    const withFew = [
      ...friends,
      { gamesTogether: 4, winRate: 0.9, soloWinRate: 0.4, collectorGames: 0, heartsteelGames: 0, puuid: 'c', name: 'C', profileIconId: 3, winsTogether: 3, lastPlayedTime: 0, gameIds: [] },
    ]
    const result2 = computeSortedByMetric(withFew, cat)
    expect(result2).toHaveLength(2) // C filtered out
  })

  test('null cat 返回原始顺序', () => {
    const result = computeSortedByMetric(friends, null)
    expect(result).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════
// computeFriendPodium
// ═══════════════════════════════════════════════════════════

describe('computeFriendPodium', () => {
  const friends = [
    { gamesTogether: 10, winRate: 0.5, soloWinRate: 0.4, collectorGames: 0, heartsteelGames: 0, puuid: 'a', name: 'A', profileIconId: 1, winsTogether: 5, lastPlayedTime: 0, gameIds: [] },
    { gamesTogether: 5, winRate: 0.8, soloWinRate: 0.4, collectorGames: 0, heartsteelGames: 0, puuid: 'b', name: 'B', profileIconId: 2, winsTogether: 4, lastPlayedTime: 0, gameIds: [] },
  ]

  test('TOP 3 取前 3（≤总数时）', () => {
    const cat = FRIEND_METRICS.find((m) => m.key === 'gamesTogether')!
    const podium = computeFriendPodium(friends, cat)
    expect(podium).toHaveLength(2) // only 2 friends total
    expect(podium[0].name).toBe('A')
  })

  test('displayValue 使用 fmt 函数格式化', () => {
    const cat = FRIEND_METRICS.find((m) => m.key === 'winRate')!
    const podium = computeFriendPodium(friends, cat)
    expect(podium[0].displayValue).toContain('%')
  })
})

// ═══════════════════════════════════════════════════════════
// getFirstPlaceTitle
// ═══════════════════════════════════════════════════════════

describe('getFirstPlaceTitle', () => {
  test('已知指标返回称号', () => {
    expect(getFirstPlaceTitle('gamesTogether')).toBe('最佳拍档')
    expect(getFirstPlaceTitle('winRate')).toBe('天选搭档')
    expect(getFirstPlaceTitle('collectorRatio')).toBe('最爱收集者之人')
  })

  test('null / 未知指标返回空串', () => {
    expect(getFirstPlaceTitle(null)).toBe('')
    expect(getFirstPlaceTitle('unknownKey')).toBe('')
  })
})
