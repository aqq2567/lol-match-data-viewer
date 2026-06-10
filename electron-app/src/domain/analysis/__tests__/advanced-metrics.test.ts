/**
 * advanced-metrics.ts 纯函数单元测试
 */
import { describe, test, expect } from 'vitest'
import { computeAdvancedMetricRanking } from '../advanced-metrics'
import { makeGameRecord, makePlayer } from './fixtures'

// 模拟 championRoles：每个 championId → 角色标签
function mockRoles(id: number): string[] {
  const map: Record<number, string[]> = {
    1: ['Fighter', 'Tank'],
    2: ['Mage'],
    3: ['Assassin'],
    4: ['Marksman'],
    5: ['Support'],
  }
  return map[id] || [] // unknown IDs → no role match
}

const mockGetRoleName = (tag: string) => {
  const map: Record<string, string> = {
    Fighter: '战士', Tank: '坦克', Mage: '法师',
    Assassin: '刺客', Marksman: '射手', Support: '辅助',
  }
  return map[tag] || tag
}

// ═══════════════════════════════════════════════════════════
// computeAdvancedMetricRanking
// ═══════════════════════════════════════════════════════════

describe('computeAdvancedMetricRanking', () => {
  test('未知 key 返回空数组', () => {
    const g = makeGameRecord()
    expect(computeAdvancedMetricRanking([g], 'unknown', mockRoles, mockGetRoleName)).toEqual([])
  })

  // ── 角色率 ──

  describe('角色率指标', () => {
    test('fighterRate — 计算战士局占比', () => {
      const g1 = makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: 1, summoner_name: 'Fighter', puuid: 'p1' })],
        redPlayers: [],
      })
      const g2 = makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: 1, summoner_name: 'Fighter', puuid: 'p1' })],
        redPlayers: [],
      })
      const ranking = computeAdvancedMetricRanking([g1, g2], 'fighterRate', mockRoles, mockGetRoleName)
      expect(ranking).toHaveLength(1)
      expect(ranking[0].total).toBeCloseTo(1.0) // 2/2 局用战士
      expect(ranking[0].raw).toBeDefined()
    })

    test('fighterRate — 部分角色局', () => {
      const g1 = makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: 1, summoner_name: 'Mix', puuid: 'pm' })],
        redPlayers: [],
      })
      const g2 = makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: 2, summoner_name: 'Mix', puuid: 'pm' })],
        redPlayers: [],
      })
      // champion_id=2 → Mage, not Fighter
      const ranking = computeAdvancedMetricRanking([g1, g2], 'fighterRate', mockRoles, mockGetRoleName)
      expect(ranking[0].total).toBeCloseTo(0.5) // 1/2 局
    })

    test('supportRate — 计算辅助局占比', () => {
      const g = makeGameRecord({
        bluePlayers: [makePlayer({ champion_id: 5, summoner_name: 'Sup', puuid: 'ps' })],
        redPlayers: [],
      })
      const ranking = computeAdvancedMetricRanking([g], 'supportRate', mockRoles, mockGetRoleName)
      expect(ranking[0].total).toBeCloseTo(1.0)
      expect(ranking[0].raw![0].label).toContain('辅助')
    })
  })

  // ── 伤害比 ──

  describe('伤害比指标', () => {
    function makeDamageGame(blueKills: number, blueDmg: number, redKills: number, redDmg: number, extra: { blueDeaths?: number; redDeaths?: number } = {}) {
      return makeGameRecord({
        blueWin: true,
        bluePlayers: [
          makePlayer({
            summoner_name: 'BlueA', puuid: 'pba',
            stats: {
              kills: blueKills, deaths: extra.blueDeaths ?? 3,
              damage: { total_to_champs: blueDmg, total_dealt: blueDmg, total_taken: 10000, physical_to_champs: 0, physical_dealt: 0, physical_taken: 0, magic_to_champs: 0, magic_dealt: 0, magic_taken: 0, true_to_champs: 0, true_dealt: 0, true_taken: 0, largest_critical_strike: 0 },
            },
          }),
        ],
        redPlayers: [
          makePlayer({
            summoner_name: 'RedA', puuid: 'pra',
            stats: {
              kills: redKills, deaths: extra.redDeaths ?? 3,
              damage: { total_to_champs: redDmg, total_dealt: redDmg, total_taken: 10000, physical_to_champs: 0, physical_dealt: 0, physical_taken: 0, magic_to_champs: 0, magic_dealt: 0, magic_taken: 0, true_to_champs: 0, true_dealt: 0, true_taken: 0, largest_critical_strike: 0 },
            },
          }),
        ],
      })
    }

    test('dmgPerGold', () => {
      const g = makeDamageGame(5, 20000, 2, 10000)
      const ranking = computeAdvancedMetricRanking([g], 'dmgPerGold', mockRoles, mockGetRoleName)
      expect(ranking).toHaveLength(2)
      // Each player has gold_earned=12000 (default), dmgPerGold = dmg/gold
      expect(ranking[0].total).toBeGreaterThan(0)
      expect(ranking[0].raw).toBeDefined()
    })

    test('dmgShare — 伤害占比', () => {
      // Blue has 20000 dmg, Red has 10000 dmg. Team total on blue side = 20000
      const g = makeDamageGame(5, 20000, 2, 10000)
      const ranking = computeAdvancedMetricRanking([g], 'dmgShare', mockRoles, mockGetRoleName)
      // BlueA dmgShare = 20000 / 20000 = 1.0 (own team)
      const blue = ranking.find((r) => r.playerName === 'BlueA')!
      expect(blue.total).toBeCloseTo(1.0)
    })

    test('dmgTakenShare', () => {
      const g = makeDamageGame(5, 20000, 2, 10000)
      const ranking = computeAdvancedMetricRanking([g], 'dmgTakenShare', mockRoles, mockGetRoleName)
      // Each takes 10000 dmg, team total = 10000 (single player per team)
      expect(ranking.length).toBeGreaterThan(0)
    })

    test('dmgPerKill', () => {
      const g = makeDamageGame(5, 20000, 2, 10000)
      const ranking = computeAdvancedMetricRanking([g], 'dmgPerKill', mockRoles, mockGetRoleName)
      const blue = ranking.find((r) => r.playerName === 'BlueA')!
      expect(blue.total).toBeCloseTo(4000) // 20000/5
    })

    test('dmgPerDeath — 零死亡返回 0', () => {
      const g = makeDamageGame(0, 20000, 0, 10000, { blueDeaths: 0, redDeaths: 0 })
      const ranking = computeAdvancedMetricRanking([g], 'dmgPerDeath', mockRoles, mockGetRoleName)
      for (const r of ranking) {
        expect(r.total).toBe(0)
      }
    })
  })

  // ── 多局聚合 ──

  test('多局总角色率正确累加', () => {
    const g1 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 1, summoner_name: 'MultiRole', puuid: 'pa' })],
      redPlayers: [],
    })
    const g2 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 1, summoner_name: 'MultiRole', puuid: 'pa' })],
      redPlayers: [],
    })
    const g3 = makeGameRecord({
      bluePlayers: [makePlayer({ champion_id: 2, summoner_name: 'MultiRole', puuid: 'pa' })],
      redPlayers: [],
    })
    const ranking = computeAdvancedMetricRanking([g1, g2, g3], 'fighterRate', mockRoles, mockGetRoleName)
    const entry = ranking.find((r) => r.playerName === 'MultiRole')!
    expect(entry.total).toBeCloseTo(2 / 3)
  })
})
