/**
 * App 层数据类型
 * 经过提取/转换后的应用内部类型，独立于 LCU 原始 API 结构
 */

// ═══════════════════════════════════════════════════════════
// LCU 连接与召唤师
// ═══════════════════════════════════════════════════════════

export interface LcuConnectionInfo {
  port: number
  authToken: string
  pid: number
  region: string
  rsoPlatformId: string
}

export interface SummonerInfo {
  puuid: string
  name: string
  level: number
  region: string
  platform: string
  profileIconId: number
}

/** LCU /lol-summoner/v1/summoners/{id} 原始响应 */
export interface LcuSummoner {
  accountId: number
  displayName: string
  gameName: string
  tagLine: string
  internalName: string
  nameChangeFlag: boolean
  percentCompleteForNextLevel: number
  profileIconId: number
  puuid: string
  rerollPoints: {
    currentPoints: number
    numberOfRolls: number
    pointsCostToRoll: number
    pointsToReroll: number
  }
  summonerId: number
  summonerLevel: number
  xpSinceLastLevel: number
  xpUntilNextLevel: number
}

/** 从 LCU 召唤师数据提取显示名（优先 Riot ID，回退 displayName） */
export function summonerDisplayName(s: { displayName?: string; gameName?: string; tagLine?: string }): string {
  if (s.gameName) {
    return s.tagLine ? `${s.gameName}#${s.tagLine}` : s.gameName
  }
  return s.displayName || ''
}

export interface QueueRanked {
  tier: string
  division: string
  league_points: number
  wins: number
  losses: number
  win_rate: number
}

export interface RankedData {
  highest_current_tier: string
  highest_previous_tier: string
  queues: Record<string, QueueRanked>
}

// ═══════════════════════════════════════════════════════════
// 对局详情（完整数据，用于批量分析）
// ═══════════════════════════════════════════════════════════

export interface PlayerStats {
  kills: number
  deaths: number
  assists: number
  kda: number
  kda_ratio: string
  largest_multi_kill: number
  largest_killing_spree: number
  killing_sprees: number
  double_kills: number
  triple_kills: number
  quadra_kills: number
  penta_kills: number
  unreal_kills: number
  damage: {
    total_to_champs: number
    total_dealt: number
    total_taken: number
    physical_to_champs: number
    physical_dealt: number
    physical_taken: number
    magic_to_champs: number
    magic_dealt: number
    magic_taken: number
    true_to_champs: number
    true_dealt: number
    true_taken: number
    largest_critical_strike: number
  }
  economy: { gold_earned: number; gold_spent: number }
  cs: {
    total: number
    minions: number
    neutral_total: number
    neutral_enemy_jungle: number
    neutral_team_jungle: number
  }
  items: number[]
  runes: {
    primary_style: number
    sub_style: number
    perks: number[]
    perk_vars: Record<string, number[]>
  }
  vision: {
    score: number
    wards_placed: number
    wards_killed: number
    sight_wards_bought: number
    vision_wards_bought: number
  }
  objectives: {
    turret_kills: number
    inhibitor_kills: number
    damage_to_turrets: number
    damage_to_objectives: number
  }
  cc: { time_cc_others: number; total_cc_dealt: number }
  survival: {
    longest_time_living: number
    damage_self_mitigated: number
    total_heal: number
    total_units_healed: number
  }
  champ_level: number
  firsts: Record<string, boolean>
  summoner_spells: { spell1: number | null; spell2: number | null }
  position: { individual_position: string; team_position: string; lane: string }
  surrender: Record<string, boolean>
  arena: { subteam_placement: number; player_subteam_id: number; player_augments: number[] }
  scores: { combat: number; objective: number; total: number; rank: number; details: number[] }
  role_bound_item: number
  was_severe_transgressor: boolean
  win: boolean
}

export interface PlayerData {
  puuid: string
  summoner_name: string
  profile_icon_id: number
  summoner_id: number
  champion_id: number
  stats: PlayerStats
}

export interface TeamData {
  team_id: number
  win: boolean
  bans: any[]
  baron_kills: number
  dragon_kills: number
  rift_herald_kills: number
  vilemaw_kills: number
  horde_kills: number
  tower_kills: number
  inhibitor_kills: number
  first_blood: boolean
  first_tower: boolean
  first_inhibitor: boolean
  first_baron: boolean
  first_dragon: boolean
  players: PlayerData[]
}

export interface ChampionMastery {
  level: number
  points: number
  highest_grade: string
  last_play_time: number
}

export interface GameRecord {
  game_id: number
  game_creation: string
  game_duration_min: number
  game_mode: string
  game_type: string
  queue_id: number
  map_id: number
  game_version: string
  blue_team: TeamData
  red_team: TeamData
  champion_mastery: Record<string, ChampionMastery>
}

export interface MatchData {
  summoner: SummonerInfo
  ranked: RankedData
  champion_mastery_total: number
  games_count: number
  games: GameRecord[]
}

// ═══════════════════════════════════════════════════════════
// 轻量级对局列表（两阶段加载）
// ═══════════════════════════════════════════════════════════

/** 队伍统计数据（用于卡片"队伍数据列"） */
export interface TeamStats {
  killParticipation: number
  damageShare: number
  damageTakenShare: number
  goldShare: number
  isHighestDamage: boolean
  isHighestDamageTaken: boolean
}

export interface ParticipantBrief {
  participantId: number
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number
  summonerName: string
  championId: number
  teamId: number // 100 = 蓝方, 200 = 红方
  items: number[]
}

export interface GameSummary {
  gameId: number
  gameMode: string
  queueId: number
  mapId: number
  gameCreation: number
  gameDuration: number
  gameVersion: string
  championId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  role: string
  spell1Id: number
  spell2Id: number
  perkPrimaryStyle: number
  perkSubStyle: number
  perk0: number
  items: number[]
  champLevel: number
  teamId: number
  kdaRatio: number
  blueParticipants: ParticipantBrief[]
  redParticipants: ParticipantBrief[]
  teamStats: TeamStats
}

export interface MatchListData {
  summoner: SummonerInfo
  ranked: RankedData
  totalGames: number
  pageSize: number
  games: GameSummary[]
}

// ═══════════════════════════════════════════════════════════
// 数据分析
// ═══════════════════════════════════════════════════════════

export interface PlayerAnalysis {
  puuid: string
  summonerName: string
  gameCount: number
  winCount: number
  loseCount: number
  winRate: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgKda: number
  avgDamageDealt: number
  avgDamageTaken: number
  avgTotalHeal: number
  avgCs: number
  avgGold: number
  avgVisionScore: number
  avgCcTime: number
}

export interface AnalysisResult {
  selectedGameIds: number[]
  gameCount: number
  winCount: number
  loseCount: number
  winRate: number
  players: PlayerAnalysis[]
}

// ═══════════════════════════════════════════════════════════
// 游戏数据缓存（从 LCU CDN 运行时拉取）
// ═══════════════════════════════════════════════════════════

export interface ChampionSimple {
  id: number
  name: string
  alias: string
  squarePortraitPath: string
  roles: string[]
}

export interface ItemData {
  id: number
  name: string
  description: string
  active: boolean
  inStore: boolean
  from: number[]
  to: number[]
  categories: string[]
  maxStacks: number
  requiredChampion: string
  requiredAlly: string
  specialRecipe: number
  isEnchantment: boolean
  price: number
  priceTotal: number
  iconPath: string
}

export interface SummonerSpellData {
  id: number
  name: string
  description: string
  summonerLevel: number
  cooldown: number
  gameModes: string[]
  iconPath: string
}

export interface PerkData {
  id: number
  name: string
  majorChangePatchVersion: string
  tooltip: string
  shortDesc: string
  longDesc: string
  iconPath: string
  endOfGameStatDescs: string[]
}

export interface PerkStyleData {
  id: number
  name: string
  tooltip: string
  iconPath: string
  allowedSubStyles: number[]
  slots: { type: string; slotLabel: string; perks: number[] }[]
  defaultPageName: string
  defaultSubStyle: number
  defaultPerks: number[]
}

export interface PerkstylesData {
  schemaVersion: number
  styles: Record<number, PerkStyleData>
}

export interface QueueData {
  id: number
  name: string
  shortName: string
  description: string
  detailedDescription: string
  gameSelectModeGroup: string
  gameSelectCategory: string
  gameSelectPriority: number
}

export interface AugmentData {
  id: number
  nameTRA: string
  augmentSmallIconPath: string
  rarity: string
}

export interface GameDataCache {
  champions: Record<number, ChampionSimple>
  items: Record<number, ItemData>
  summonerSpells: Record<number, SummonerSpellData>
  perks: Record<number, PerkData>
  perkstyles: PerkstylesData
  queues: Record<number, QueueData>
  augments: Record<number, AugmentData>
}
