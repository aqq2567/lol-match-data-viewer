/**
 * match-stats.ts 纯函数单元测试
 * 零 mock，零 I/O，纯数据进纯数据出
 */
import { describe, test, expect } from 'vitest'
import {
  computeFrequentChampions,
  countPlayerFreq,
  extractTeammates,
  extractOpponents,
  computeAvgKda,
  computeWinStats,
  formatTotalGamesDisplay,
  isPlayerInAllGames,
  filterToPlayerTeam,
  hasUniformGameMode,
} from '../match-stats'
import { makeGameSummary, makeGameRecord, makeBrief, makePlayer } from './fixtures'
import type { GameSummary } from '@shared/types'

// ═══════════════════════════════════════════════════════════
// computeFrequentChampions
// ═══════════════════════════════════════════════════════════

describe('computeFrequentChampions', () => {
  test('空对局返回空数组', () => {
    expect(computeFrequentChampions([])).toEqual([])
  })

  test('多场同一英雄累加正确', () => {
    const games: GameSummary[] = [
      makeGameSummary({ championId: 64 }),
      makeGameSummary({ championId: 64 }),
      makeGameSummary({ championId: 120 }),
    ]
    const result = computeFrequentChampions(games)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ championId: 64, count: 2 })
    expect(result[1]).toEqual({ championId: 120, count: 1 })
  })

  test('超过 5 个英雄只返回 TOP 5', () => {
    const games: GameSummary[] = Array.from({ length: 6 }, (_, i) =>
      makeGameSummary({ championId: i + 1 }),
    )
    // 再给 championId=3 加一场
    games.push(makeGameSummary({ championId: 3 }))
    const result = computeFrequentChampions(games)
    expect(result.length).toBeLessThanOrEqual(5)
    // championId=3 出现 2 次应该排第一
    expect(result[0]).toEqual({ championId: 3, count: 2 })
  })
})

// ═══════════════════════════════════════════════════════════
// countPlayerFreq
// ═══════════════════════════════════════════════════════════

describe('countPlayerFreq', () => {
  test('排除自己', () => {
    const selfPuuid = 'self'
    const other = makeBrief({ puuid: 'other' })
    const games = [
      makeGameSummary({
        puuid: selfPuuid,
        blueParticipants: [
          makeBrief({ puuid: selfPuuid }),
          other,
        ],
      }),
      makeGameSummary({
        puuid: selfPuuid,
        blueParticipants: [
          makeBrief({ puuid: selfPuuid }),
          other,
        ],
      }),
    ]
    const result = countPlayerFreq(games, selfPuuid, (g) => {
      return g.blueParticipants
    })
    expect(result).toHaveLength(1)
    expect(result[0].puuid).toBe('other')
    expect(result[0].count).toBe(2)
  })

  test('出现不足 2 场不纳入统计', () => {
    const selfPuuid = 'self'
    const games = [
      makeGameSummary({
        puuid: selfPuuid,
        blueParticipants: [
          makeBrief({ puuid: selfPuuid }),
          makeBrief({ puuid: 'rare' }),
        ],
      }),
    ]
    const result = countPlayerFreq(games, selfPuuid, (g) => g.blueParticipants)
    expect(result).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════
// extractTeammates / extractOpponents
// ═══════════════════════════════════════════════════════════

describe('extractTeammates', () => {
  test('蓝方自己 + 2 队友 → 返回 2 队友不含自己', () => {
    const selfPuuid = 'self'
    const teammate = makeBrief({ puuid: 'tm8', teamId: 100 })
    const game = makeGameSummary({
      puuid: selfPuuid,
      blueParticipants: [makeBrief({ puuid: selfPuuid, teamId: 100 }), teammate],
      redParticipants: [makeBrief({ puuid: 'enemy', teamId: 200 })],
    })
    const result = extractTeammates(game, selfPuuid)
    expect(result).toHaveLength(1)
    expect(result[0].puuid).toBe('tm8')
  })

  test('红方自己正确提取红方队友', () => {
    const selfPuuid = 'self'
    const teammate = makeBrief({ puuid: 'tm8', teamId: 200 })
    const game = makeGameSummary({
      puuid: selfPuuid,
      win: false,
      blueParticipants: [makeBrief({ puuid: 'enemy', teamId: 100 })],
      redParticipants: [makeBrief({ puuid: selfPuuid, teamId: 200 }), teammate],
    })
    const result = extractTeammates(game, selfPuuid)
    expect(result).toHaveLength(1)
    expect(result[0].puuid).toBe('tm8')
  })
})

describe('extractOpponents', () => {
  test('蓝方自己 → 返回红方全队', () => {
    const selfPuuid = 'self'
    const enemy1 = makeBrief({ puuid: 'enemy1', teamId: 200 })
    const enemy2 = makeBrief({ puuid: 'enemy2', teamId: 200 })
    const game = makeGameSummary({
      puuid: selfPuuid,
      blueParticipants: [makeBrief({ puuid: selfPuuid, teamId: 100 })],
      redParticipants: [enemy1, enemy2],
    })
    const result = extractOpponents(game, selfPuuid)
    expect(result).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════
// computeAvgKda
// ═══════════════════════════════════════════════════════════

describe('computeAvgKda', () => {
  test('空对局返回 "-"', () => {
    expect(computeAvgKda([])).toBe('-')
  })

  test('单场 KDA=4.33', () => {
    const games = [makeGameSummary({ kdaRatio: 4.33 })]
    expect(computeAvgKda(games)).toBe('4.33')
  })

  test('多场取平均', () => {
    const games = [
      makeGameSummary({ kdaRatio: 2.0 }),
      makeGameSummary({ kdaRatio: 4.0 }),
    ]
    expect(computeAvgKda(games)).toBe('3.00')
  })
})

// ═══════════════════════════════════════════════════════════
// computeWinStats
// ═══════════════════════════════════════════════════════════

describe('computeWinStats', () => {
  test('空对局', () => {
    expect(computeWinStats([])).toEqual({ wins: 0, losses: 0, ratePercent: '0' })
  })

  test('1 胜 1 负', () => {
    const games = [
      makeGameSummary({ win: true }),
      makeGameSummary({ win: false }),
    ]
    const result = computeWinStats(games)
    expect(result.wins).toBe(1)
    expect(result.losses).toBe(1)
    expect(result.ratePercent).toBe('50')
  })

  test('练习模式不计入败场', () => {
    const games = [
      makeGameSummary({ win: true }),
      makeGameSummary({ win: false, gameMode: 'PRACTICETOOL' }),
    ]
    const result = computeWinStats(games)
    expect(result.wins).toBe(1)
    expect(result.losses).toBe(0)
    expect(result.ratePercent).toBe('100')
  })
})

// ═══════════════════════════════════════════════════════════
// formatTotalGamesDisplay
// ═══════════════════════════════════════════════════════════

describe('formatTotalGamesDisplay', () => {
  test('totalGames > gamesLength → 显示 totalGames', () => {
    expect(formatTotalGamesDisplay(500, 200, 1, 100)).toBe('500 场')
  })

  test('最后一页不足 pageSize → 显示准确数量', () => {
    expect(formatTotalGamesDisplay(0, 50, 3, 100)).toBe('250 场')
  })

  test('满页 → 显示 +', () => {
    expect(formatTotalGamesDisplay(0, 100, 2, 100)).toBe('200+ 场')
  })
})

// ═══════════════════════════════════════════════════════════
// isPlayerInAllGames
// ═══════════════════════════════════════════════════════════

describe('isPlayerInAllGames', () => {
  test('空对局返回 false', () => {
    expect(isPlayerInAllGames([], 'any')).toBe(false)
  })

  test('空 puuid 返回 false', () => {
    const games = [makeGameRecord()]
    expect(isPlayerInAllGames(games, '')).toBe(false)
  })

  test('玩家在所有对局中', () => {
    const puuid = 'player-1'
    const p = makePlayer({ puuid, summoner_name: 'Test' })
    const g1 = makeGameRecord({ bluePlayers: [p], redPlayers: [makePlayer()] })
    const g2 = makeGameRecord({ bluePlayers: [p], redPlayers: [makePlayer()] })
    expect(isPlayerInAllGames([g1, g2], puuid)).toBe(true)
  })

  test('玩家不在某一局中', () => {
    const puuid = 'player-1'
    const p = makePlayer({ puuid, summoner_name: 'Test' })
    const g1 = makeGameRecord({ bluePlayers: [p], redPlayers: [makePlayer()] })
    const g2 = makeGameRecord({ bluePlayers: [makePlayer()], redPlayers: [makePlayer()] })
    expect(isPlayerInAllGames([g1, g2], puuid)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════
// filterToPlayerTeam
// ═══════════════════════════════════════════════════════════

describe('filterToPlayerTeam', () => {
  test('清空对方队伍', () => {
    const puuid = 'p1'
    const p = makePlayer({ puuid, summoner_name: 'Me' })
    const g = makeGameRecord({
      bluePlayers: [p, makePlayer({ summoner_name: 'Ally' })],
      redPlayers: [makePlayer({ summoner_name: 'Enemy1' }), makePlayer({ summoner_name: 'Enemy2' })],
    })
    const result = filterToPlayerTeam([g], puuid)
    expect(result[0].blue_team.players).toHaveLength(2) // unchanged
    expect(result[0].red_team.players).toHaveLength(0)  // cleared
  })

  test('玩家在红方', () => {
    const puuid = 'p1'
    const p = makePlayer({ puuid, summoner_name: 'Me' })
    const g = makeGameRecord({
      blueWin: false,
      bluePlayers: [makePlayer(), makePlayer()],
      redPlayers: [p, makePlayer()],
    })
    const result = filterToPlayerTeam([g], puuid)
    expect(result[0].blue_team.players).toHaveLength(0)
    expect(result[0].red_team.players).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════
// hasUniformGameMode
// ═══════════════════════════════════════════════════════════

describe('hasUniformGameMode', () => {
  test('≤1 场对局 → true', () => {
    expect(hasUniformGameMode([])).toBe(true)
    expect(hasUniformGameMode([makeGameSummary()])).toBe(true)
  })

  test('全部同一模式 → true', () => {
    const games = [
      makeGameSummary({ gameMode: 'ARAM' }),
      makeGameSummary({ gameMode: 'ARAM' }),
    ]
    expect(hasUniformGameMode(games)).toBe(true)
  })

  test('混合模式 → false', () => {
    const games = [
      makeGameSummary({ gameMode: 'CLASSIC' }),
      makeGameSummary({ gameMode: 'ARAM' }),
    ]
    expect(hasUniformGameMode(games)).toBe(false)
  })
})
