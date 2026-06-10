/**
 * 测试夹具工厂函数
 * 所有函数接受 partial 覆盖，未指定的字段用合理默认值填充
 */
import type {
  GameRecord, GameSummary, PlayerData, PlayerStats,
  TeamData, ParticipantBrief,
} from '@shared/types'

// ═══════════════════════════════════════════════════════════
// PlayerStats
// ═══════════════════════════════════════════════════════════

let _pidSeq = 0
function nextPid() { _pidSeq++; return _pidSeq }

export function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    kills: 5, deaths: 3, assists: 8, kda: 4.3, kda_ratio: '4.33',
    largest_multi_kill: 1, largest_killing_spree: 2, killing_sprees: 1,
    double_kills: 0, triple_kills: 0, quadra_kills: 0, penta_kills: 0, unreal_kills: 0,
    damage: {
      total_to_champs: 20000, total_dealt: 50000, total_taken: 25000,
      physical_to_champs: 12000, physical_dealt: 30000, physical_taken: 15000,
      magic_to_champs: 6000, magic_dealt: 15000, magic_taken: 8000,
      true_to_champs: 2000, true_dealt: 5000, true_taken: 2000,
      largest_critical_strike: 500,
    },
    economy: { gold_earned: 12000, gold_spent: 11000 },
    cs: { total: 200, minions: 180, neutral_total: 20, neutral_enemy_jungle: 10, neutral_team_jungle: 10 },
    items: [3031, 3046, 3006, 3153, 0, 0],
    runes: { primary_style: 8000, sub_style: 8100, perks: [8005, 8008, 8003], perk_vars: {} },
    vision: { score: 15, wards_placed: 8, wards_killed: 3, sight_wards_bought: 0, vision_wards_bought: 2 },
    objectives: { turret_kills: 1, inhibitor_kills: 0, damage_to_turrets: 2000, damage_to_objectives: 5000 },
    cc: { time_cc_others: 10, total_cc_dealt: 25 },
    survival: { longest_time_living: 300, damage_self_mitigated: 5000, total_heal: 2000, total_units_healed: 1 },
    champ_level: 16,
    firsts: { first_blood: false, first_tower: false, first_inhibitor: false },
    summoner_spells: { spell1: 4, spell2: 12 },
    position: { individual_position: 'TOP', team_position: 'TOP', lane: 'TOP' },
    surrender: {},
    arena: { subteam_placement: 0, player_subteam_id: 0, player_augments: [] },
    scores: { combat: 0, objective: 0, total: 0, rank: 0, details: [] },
    role_bound_item: 0,
    was_severe_transgressor: false,
    win: true,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════
// PlayerData
// ═══════════════════════════════════════════════════════════

export function makePlayer(overrides: Partial<PlayerData> & { stats?: Partial<PlayerStats> } = {}): PlayerData {
  const { stats, ...rest } = overrides
  // stable id: use hash of summoner_name to avoid cross-test _pidSeq drift
  const name = rest.summoner_name || 'Default'
  const id = [...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 0) & 0xFFFF
  return {
    puuid: rest.puuid || `puuid-${name}`,
    summoner_name: name,
    profile_icon_id: 100 + id,
    summoner_id: 1000 + id,
    champion_id: (id % 199) + 1, // deterministic, never 0
    stats: makeStats(stats),
    ...rest,
  }
}

// ═══════════════════════════════════════════════════════════
// TeamData
// ═══════════════════════════════════════════════════════════

export function makeTeam(players: PlayerData[], overrides: Partial<TeamData> = {}): TeamData {
  return {
    team_id: 100,
    win: true,
    bans: [],
    baron_kills: 1, dragon_kills: 2, rift_herald_kills: 1,
    vilemaw_kills: 0, horde_kills: 0, tower_kills: 5, inhibitor_kills: 1,
    first_blood: true, first_tower: true, first_inhibitor: true,
    first_baron: true, first_dragon: true,
    players,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════
// GameRecord
// ═══════════════════════════════════════════════════════════

let _gidSeq = 1000
function nextGid() { _gidSeq++; return _gidSeq }

export function makeGameRecord(overrides: {
  bluePlayers?: PlayerData[]
  redPlayers?: PlayerData[]
  blueWin?: boolean
  gameMode?: string
} = {}): GameRecord {
  const { bluePlayers, redPlayers, blueWin = true, gameMode = 'CLASSIC', ...rest } = overrides
  const bp = bluePlayers || [makePlayer({ summoner_name: 'BlueA' }), makePlayer({ summoner_name: 'BlueB' })]
  const rp = redPlayers || [makePlayer({ summoner_name: 'RedA' }), makePlayer({ summoner_name: 'RedB' })]
  return {
    game_id: nextGid(),
    game_creation: '2025-01-01T00:00:00',
    game_duration_min: 25.5,
    game_mode: gameMode,
    game_type: 'MATCHED_GAME',
    queue_id: 420,
    map_id: 11,
    game_version: '14.1.1',
    blue_team: makeTeam(bp, { win: blueWin, team_id: 100 }),
    red_team: makeTeam(rp, { win: !blueWin, team_id: 200 }),
    champion_mastery: {},
    ...rest,
  }
}

// ═══════════════════════════════════════════════════════════
// ParticipantBrief
// ═══════════════════════════════════════════════════════════

export function makeBrief(overrides: Partial<ParticipantBrief> = {}): ParticipantBrief {
  const id = nextPid()
  return {
    participantId: id,
    puuid: `puuid-${id}`,
    gameName: `Game${id}`,
    tagLine: 'NA1',
    profileIconId: 100 + id,
    summonerName: `Summoner${id}`,
    championId: id * 10,
    teamId: 100,
    items: [3031, 3046],
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════
// GameSummary
// ═══════════════════════════════════════════════════════════

export function makeGameSummary(overrides: {
  blueParticipants?: ParticipantBrief[]
  redParticipants?: ParticipantBrief[]
  win?: boolean
  gameMode?: string
  championId?: number
  puuid?: string
  kdaRatio?: number
  kills?: number
  deaths?: number
  assists?: number
} = {}): GameSummary {
  const {
    blueParticipants, redParticipants,
    win = true, gameMode = 'CLASSIC',
    championId = 64, puuid = 'self-puuid',
    kdaRatio = 4.33,
    kills = 5, deaths = 3, assists = 8,
  } = overrides
  const selfBrief = makeBrief({ puuid, championId, teamId: 100 })
  const bp = blueParticipants || [selfBrief, makeBrief({ teamId: 100 })]
  const rp = redParticipants || [makeBrief({ teamId: 200 }), makeBrief({ teamId: 200 })]
  return {
    gameId: nextGid(),
    gameMode,
    gameType: 'MATCHED_GAME',
    queueId: 420,
    mapId: 11,
    gameCreation: 1700000000,
    gameDuration: 1800,
    gameVersion: '14.1.1',
    championId,
    win,
    kills, deaths, assists,
    role: 'TOP',
    spell1Id: 4, spell2Id: 12,
    perkPrimaryStyle: 8000, perkSubStyle: 8100, perk0: 8005,
    items: [3031, 3046, 0, 0, 0, 0],
    champLevel: 16,
    teamId: 100,
    kdaRatio,
    blueParticipants: bp,
    redParticipants: rp,
    teamStats: {
      killParticipation: 0.5, damageShare: 0.3,
      damageTakenShare: 0.25, goldShare: 0.25,
      isHighestDamage: false, isHighestDamageTaken: false,
    },
  }
}
