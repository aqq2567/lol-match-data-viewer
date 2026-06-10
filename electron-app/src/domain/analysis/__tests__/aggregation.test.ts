/**
 * aggregation.ts 纯函数单元测试
 * 只操作 GameRecord[] → 排名/领奖台/PlayerAnalysis
 */
import { describe, test, expect } from 'vitest'
import {
  buildPlayerAggMap,
  computeMetricRanking,
  computePodium,
  findBestStat,
  findBestPlayer,
  computePodiumWinRate,
  computePlayerAnalysis,
} from '../aggregation'
import { makeGameRecord, makePlayer } from './fixtures'

// ═══════════════════════════════════════════════════════════
// buildPlayerAggMap
// ═══════════════════════════════════════════════════════════

describe('buildPlayerAggMap', () => {
  test('空对局返回空 Map', () => {
    expect(buildPlayerAggMap([]).size).toBe(0)
  })

  test('两名玩家各一局 → Map 含两位', () => {
    const g = makeGameRecord({
      bluePlayers: [makePlayer({ summoner_name: 'A' }), makePlayer({ summoner_name: 'B' })],
      redPlayers: [makePlayer({ summoner_name: 'C' }), makePlayer({ summoner_name: 'D' })],
    })
    const map = buildPlayerAggMap([g])
    expect(map.size).toBe(4)
    expect(map.get('A')!.gameCount).toBe(1)
  })

  test('同一玩家多局累加', () => {
    const pA = makePlayer({ summoner_name: 'A', puuid: 'pa' })
    const g1 = makeGameRecord({ bluePlayers: [pA] })
    const g2 = makeGameRecord({ bluePlayers: [makePlayer({ summoner_name: 'A', puuid: 'pa' })] })
    const map = buildPlayerAggMap([g1, g2])
    expect(map.get('A')!.gameCount).toBe(2)
    expect(map.get('A')!.totalKills).toBe(10) // 默认每局 5 杀
  })
})

// ═══════════════════════════════════════════════════════════
// computeMetricRanking
// ═══════════════════════════════════════════════════════════

describe('computeMetricRanking', () => {
  test('按击杀数排名', () => {
    const g = makeGameRecord({
      bluePlayers: [
        makePlayer({ summoner_name: 'Killer', stats: { kills: 20 } }),
        makePlayer({ summoner_name: 'Support', stats: { kills: 1 } }),
      ],
      redPlayers: [
        makePlayer({ summoner_name: 'Mid', stats: { kills: 10 } }),
        makePlayer({ summoner_name: 'Jungler', stats: { kills: 5 } }),
      ],
    })
    const ranking = computeMetricRanking([g], (s) => s.kills)
    expect(ranking[0].playerName).toBe('Killer')
    expect(ranking[0].total).toBe(20)
    expect(ranking[3].playerName).toBe('Support')
    expect(ranking[3].total).toBe(1)
  })

  test('average = total / gameCount', () => {
    const p = makePlayer({ summoner_name: 'A', puuid: 'pa' })
    const g1 = makeGameRecord({ bluePlayers: [p] })
    const g2 = makeGameRecord({ bluePlayers: [makePlayer({ summoner_name: 'A', puuid: 'pa' })] })
    const ranking = computeMetricRanking([g1, g2], (s) => s.kills)
    expect(ranking[0].gameCount).toBe(2)
    expect(ranking[0].average).toBe(5) // (5+5)/2
  })
})

// ═══════════════════════════════════════════════════════════
// computePodium
// ═══════════════════════════════════════════════════════════

describe('computePodium', () => {
  test('返回 TOP 3', () => {
    const players = ['A', 'B', 'C', 'D'].map((name) =>
      makePlayer({ summoner_name: name }))
    const g = makeGameRecord({ bluePlayers: [players[0], players[1]], redPlayers: [players[2], players[3]] })
    const map = buildPlayerAggMap([g])
    const podium = computePodium([g], map, (s) => s.kills, String)
    expect(podium.length).toBe(3)
  })

  test('KDA 正确', () => {
    const p = makePlayer({ summoner_name: 'A', puuid: 'pa' })
    const g = makeGameRecord({ bluePlayers: [p] })
    const map = buildPlayerAggMap([g])
    const podium = computePodium([g], map, (s) => s.kills, String)
    // 默认: kills=5 deaths=3 assists=8
    // KDA = (5+8)/3 = 4.33
    expect(podium[0].avgKda).toBe('4.33')
  })

  test('零死亡 KDA', () => {
    const p = makePlayer({ summoner_name: 'A', puuid: 'pa', stats: { kills: 10, deaths: 0, assists: 5 } })
    const g = makeGameRecord({ bluePlayers: [p] })
    const map = buildPlayerAggMap([g])
    const podium = computePodium([g], map, (s) => s.kills, String)
    expect(podium[0].avgKda).toBe('15.0') // (10+5) → toFixed(1)
  })
})

// ═══════════════════════════════════════════════════════════
// findBestStat / findBestPlayer
// ═══════════════════════════════════════════════════════════

describe('findBestStat', () => {
  test('空数组返回 0', () => {
    expect(findBestStat([], (s) => s.kills)).toBe(0)
  })

  test('找最大击杀', () => {
    const players = [
      makePlayer({ stats: { kills: 5 } }),
      makePlayer({ stats: { kills: 20 } }),
      makePlayer({ stats: { kills: 10 } }),
    ]
    expect(findBestStat(players, (s) => s.kills)).toBe(20)
  })
})

describe('findBestPlayer', () => {
  test('空数组返回 null', () => {
    expect(findBestPlayer([], (s) => s.kills)).toBeNull()
  })

  test('最大值 ≤0 返回 null', () => {
    const players = [
      makePlayer({ stats: { kills: 0 } }),
      makePlayer({ stats: { kills: 0 } }),
    ]
    expect(findBestPlayer(players, (s) => s.kills)).toBeNull()
  })

  test('返回击杀最多的玩家', () => {
    const best = makePlayer({ summoner_name: 'Best', stats: { kills: 20 } })
    const players = [
      makePlayer({ summoner_name: 'Worst', stats: { kills: 1 } }),
      best,
    ]
    expect(findBestPlayer(players, (s) => s.kills)!.summoner_name).toBe('Best')
  })
})

// ═══════════════════════════════════════════════════════════
// computePodiumWinRate
// ═══════════════════════════════════════════════════════════

describe('computePodiumWinRate', () => {
  test('正常计算', () => {
    const entry: any = { gameCount: 10, winCount: 7 }
    expect(computePodiumWinRate(entry)).toBe('70')
  })

  test('零局返回 0', () => {
    const entry: any = { gameCount: 0, winCount: 0 }
    expect(computePodiumWinRate(entry)).toBe('0')
  })
})

// ═══════════════════════════════════════════════════════════
// computePlayerAnalysis
// ═══════════════════════════════════════════════════════════

describe('computePlayerAnalysis', () => {
  test('多玩家多局分析', () => {
    const pA = makePlayer({ summoner_name: 'A', puuid: 'pa' })
    const pB = makePlayer({ summoner_name: 'B', puuid: 'pb' })
    const g = makeGameRecord({ bluePlayers: [pA], redPlayers: [pB] })
    const result = computePlayerAnalysis([g])
    expect(result).toHaveLength(2)
    expect(result[0].gameCount).toBe(1)
    expect(result[0].winCount + result[0].loseCount).toBe(1)
  })

  test('按局数降序', () => {
    const pA = makePlayer({ summoner_name: 'A', puuid: 'pa' })
    const pB = makePlayer({ summoner_name: 'B', puuid: 'pb' })
    const g1 = makeGameRecord({ bluePlayers: [pA], redPlayers: [pB] })
    const g2 = makeGameRecord({ bluePlayers: [makePlayer({ summoner_name: 'A', puuid: 'pa' })], redPlayers: [makePlayer({ summoner_name: 'B', puuid: 'pb' })] })
    const result = computePlayerAnalysis([g1, g2])
    expect(result[0].gameCount).toBe(2)
    expect(result[1].gameCount).toBe(2)
  })
})
