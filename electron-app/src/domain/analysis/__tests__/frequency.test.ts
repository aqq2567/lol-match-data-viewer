/**
 * frequency.ts 纯函数单元测试
 * 只操作 GameRecord[] → 频次统计
 */
import { describe, test, expect } from 'vitest'
import {
  computeGlobalChampionFreq,
  computeGlobalItemFreq,
  computeGlobalAugmentFreq,
  computePlayerChampionPools,
  computePlayerFavoriteItems,
  computePlayerFavoriteAugments,
  getChampionUsers,
  getItemUsers,
  getAugmentUsers,
  sortPlayerAugmentsByFreq,
} from '../frequency'
import { makeGameRecord, makePlayer } from './fixtures'

// 测试用辅助函数
const mockGetName = (id: number) => `Name#${id}`
const mockGetIcon = (id: number) => `/icons/${id}.png`
const mockGetRarity = (id: number) => id % 2 === 0 ? 'legendary' : 'rare'
const mockIsBuildItem = (id: number) => id > 1000 // 只有 >1000 的是大件

// ═══════════════════════════════════════════════════════════
// 全局频次 TOP 10
// ═══════════════════════════════════════════════════════════

describe('computeGlobalChampionFreq', () => {
  test('空对局返回空', () => {
    expect(computeGlobalChampionFreq([], mockGetName)).toEqual([])
  })

  test('单英雄多局累加', () => {
    const g1 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 64, summoner_name: 'A', puuid: 'pa' })],
    })
    const g2 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 64, summoner_name: 'A', puuid: 'pa' })],
    })
    const result = computeGlobalChampionFreq([g1, g2], mockGetName)
    expect(result[0].championId).toBe(64)
    expect(result[0].count).toBe(2)
  })

  test('championId=0 被排除', () => {
    const g = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 0, summoner_name: 'Zero', puuid: 'pz' })],
      redPlayers: [], // no red players to simplify
    })
    const result = computeGlobalChampionFreq([g], mockGetName)
    expect(result).toEqual([])
  })

  test('返回 TOP 10', () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: i + 1, summoner_name: `P${i}`, puuid: `p${i}` })],
      }),
    )
    const result = computeGlobalChampionFreq(games, mockGetName)
    expect(result.length).toBeLessThanOrEqual(10)
  })
})

describe('computeGlobalItemFreq', () => {
  test('仅统计大件（isBuildItem 返回 true）', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({ stats: { items: [3031, 1055, 1000] }, puuid: 'p1', summoner_name: 'A' }),
      ],
      redPlayers: [],
    })
    const result = computeGlobalItemFreq([g], mockIsBuildItem, mockGetName, mockGetIcon)
    // 3031 > 1000 → yes; 1055 > 1000 → yes; 1000 ≤ 1000 → no
    expect(result).toHaveLength(2)
  })

  test('空对局', () => {
    expect(computeGlobalItemFreq([], mockIsBuildItem, mockGetName, mockGetIcon)).toEqual([])
  })
})

describe('computeGlobalAugmentFreq', () => {
  test('统计增幅使用频率', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({
          stats: { arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [100, 200] } },
          puuid: 'p1', summoner_name: 'A',
        }),
      ],
    })
    const result = computeGlobalAugmentFreq([g], mockGetName, mockGetIcon, mockGetRarity)
    expect(result).toHaveLength(2)
    expect(result[0].count).toBe(1)
  })

  test('augId=0 被排除', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({
          stats: { arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [0, 100] } },
          puuid: 'p1', summoner_name: 'A',
        }),
      ],
    })
    const result = computeGlobalAugmentFreq([g], mockGetName, mockGetIcon, mockGetRarity)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════
// 玩家最爱
// ═══════════════════════════════════════════════════════════

describe('computePlayerChampionPools', () => {
  test('唯一英雄数正确', () => {
    const g1 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 64, puuid: 'pa', summoner_name: 'A' })],
    })
    const g2 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 120, puuid: 'pa', summoner_name: 'A' })],
    })
    const result = computePlayerChampionPools([g1, g2])
    expect(result[0].uniqueChampions).toBe(2)
  })

  test('mostPlayedChampionId 正确', () => {
    const g1 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 64, puuid: 'pa', summoner_name: 'TestMain' })],
      redPlayers: [],
    })
    const g2 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 64, puuid: 'pa', summoner_name: 'TestMain' })],
      redPlayers: [],
    })
    const g3 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 120, puuid: 'pa', summoner_name: 'TestMain' })],
      redPlayers: [],
    })
    const result = computePlayerChampionPools([g1, g2, g3])
    const aResult = result.find((r) => r.playerName === 'TestMain')!
    expect(aResult.mostPlayedChampionId).toBe(64)
    expect(aResult.mostPlayedChampionCount).toBe(2)
  })
})

describe('computePlayerFavoriteItems', () => {
  test('最爱出的大件', () => {
    const g1 = makeGameRecord({
      bluePlayers: [
        makePlayer({ stats: { items: [3031, 3046, 2000] }, puuid: 'pa', summoner_name: 'A' }),
      ],
    })
    const g2 = makeGameRecord({
      bluePlayers: [
        makePlayer({ stats: { items: [3031, 3050, 2000] }, puuid: 'pa', summoner_name: 'A' }),
      ],
    })
    const result = computePlayerFavoriteItems([g1, g2], mockIsBuildItem, mockGetName, mockGetIcon)
    const aResult = result.find((r) => r.playerName === 'A')!
    expect(aResult.itemId).toBe(3031) // 出现 2 次
    expect(aResult.count).toBe(2)
  })
})

describe('computePlayerFavoriteAugments', () => {
  test('最爱增幅', () => {
    const g1 = makeGameRecord({
      bluePlayers: [
        makePlayer({
          stats: { arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [100, 200] } },
          puuid: 'pa', summoner_name: 'A',
        }),
      ],
    })
    const g2 = makeGameRecord({
      bluePlayers: [
        makePlayer({
          stats: { arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [100, 300] } },
          puuid: 'pa', summoner_name: 'A',
        }),
      ],
    })
    const result = computePlayerFavoriteAugments([g1, g2], mockGetName, mockGetIcon, mockGetRarity)
    const aResult = result.find((r) => r.playerName === 'A')!
    expect(aResult.augmentId).toBe(100) // 出现 2 次
  })
})

// ═══════════════════════════════════════════════════════════
// 使用者查询
// ═══════════════════════════════════════════════════════════

describe('getChampionUsers', () => {
  test('查询指定英雄的使用者', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({ champion_id: 64, puuid: 'pa', summoner_name: 'A' }),
        makePlayer({ champion_id: 64, puuid: 'pb', summoner_name: 'B' }),
      ],
      redPlayers: [
        makePlayer({ champion_id: 120, puuid: 'pc', summoner_name: 'C' }),
      ],
    })
    const users = getChampionUsers([g], 64)
    expect(users).toHaveLength(2)
    expect(users[0].count).toBe(1)
  })

  test('英雄无人使用返回空', () => {
    const g = makeGameRecord()
    expect(getChampionUsers([g], 999)).toEqual([])
  })
})

describe('getItemUsers', () => {
  test('查询指定装备的使用者', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({ stats: { items: [3031, 3046] }, puuid: 'pa', summoner_name: 'ItemUser' }),
      ],
      redPlayers: [],
    })
    const users = getItemUsers([g], 3031, mockIsBuildItem)
    expect(users).toHaveLength(1)
    expect(users[0].playerName).toBe('ItemUser')
  })

  test('非大件不统计', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({ stats: { items: [999] }, puuid: 'pa', summoner_name: 'A' }),
      ],
    })
    const users = getItemUsers([g], 999, mockIsBuildItem)
    expect(users).toEqual([])
  })
})

describe('getAugmentUsers', () => {
  test('查询指定增幅的使用者', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({
          stats: { arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [100] } },
          puuid: 'pa', summoner_name: 'A',
        }),
      ],
    })
    const users = getAugmentUsers([g], 100)
    expect(users).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════
// sortPlayerAugmentsByFreq
// ═══════════════════════════════════════════════════════════

describe('sortPlayerAugmentsByFreq', () => {
  test('按使用率降序', () => {
    const augs: any[] = [
      { count: 5, totalGames: 10 },  // rate = 0.5
      { count: 8, totalGames: 10 },  // rate = 0.8
      { count: 2, totalGames: 20 },  // rate = 0.1
    ]
    const sorted = sortPlayerAugmentsByFreq(augs)
    expect(sorted[0].count).toBe(8)   // 0.8
    expect(sorted[1].count).toBe(5)   // 0.5
    expect(sorted[2].count).toBe(2)   // 0.1
  })

  test('不修改原数组', () => {
    const augs: any[] = [{ count: 1, totalGames: 2 }]
    const original = [...augs]
    sortPlayerAugmentsByFreq(augs)
    expect(augs).toEqual(original)
  })
})
