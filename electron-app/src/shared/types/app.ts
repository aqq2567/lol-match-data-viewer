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

/** @deprecated 请使用 `getPlayerDisplayName` from @shared/utils/mappings */
export function summonerDisplayName(s: { displayName?: string; gameName?: string; tagLine?: string }): string {
  if (s.gameName) return s.tagLine ? `${s.gameName}#${s.tagLine}` : s.gameName
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
  // ═══ KDA ═══
  kills: number                // 击杀
  deaths: number               // 死亡
  assists: number              // 助攻
  kda: number                  // KDA 值
  kda_ratio: string            // KDA 比例字符串
  largest_multi_kill: number   // 最大连杀数
  largest_killing_spree: number // 最大击杀狂欢
  killing_sprees: number       // 击杀狂欢次数
  double_kills: number         // 双杀
  triple_kills: number         // 三杀
  quadra_kills: number         // 四杀
  penta_kills: number          // 五杀
  unreal_kills: number         // 六杀
  // ═══ 伤害 ═══
  damage: {
    total_to_champs: number       // 对英雄总伤害
    total_dealt: number           // 总伤害输出
    total_taken: number           // 总承受伤害
    physical_to_champs: number    // 对英雄物理伤害
    physical_dealt: number        // 物理伤害输出
    physical_taken: number        // 物理承受伤害
    magic_to_champs: number       // 对英雄魔法伤害
    magic_dealt: number           // 魔法伤害输出
    magic_taken: number           // 魔法承受伤害
    true_to_champs: number        // 对英雄真实伤害
    true_dealt: number            // 真实伤害输出
    true_taken: number            // 真实承受伤害
    largest_critical_strike: number // 最大暴击伤害
  }
  // ═══ 经济 ═══
  economy: { gold_earned: number; gold_spent: number }  // 金币获得 / 金币花费
  // ═══ 补刀 ═══
  cs: {
    total: number                 // 总补刀
    minions: number               // 小兵补刀
    neutral_total: number         // 野怪补刀
    neutral_enemy_jungle: number  // 敌方野区野怪（反野）
    neutral_team_jungle: number   // 友方野区野怪
  }
  // ═══ 装备 ═══
  items: number[]              // 装备列表 (item0-item6)
  // ═══ 符文 ═══
  runes: {
    primary_style: number      // 主符文系
    sub_style: number          // 副符文系
    perks: number[]            // 符文 ID 列表
    perk_vars: Record<string, number[]> // 符文变量
  }
  // ═══ 视野 ═══
  vision: {
    score: number              // 视野得分
    wards_placed: number       // 放置守卫数
    wards_killed: number       // 摧毁守卫数
    sight_wards_bought: number // 购买真眼数
    vision_wards_bought: number // 购买假眼数
  }
  // ═══ 目标 ═══
  objectives: {
    turret_kills: number       // 防御塔击杀
    inhibitor_kills: number    // 水晶击杀
    damage_to_turrets: number  // 对防御塔伤害
    damage_to_objectives: number // 对目标伤害
  }
  // ═══ 控制技能 ═══
  cc: { time_cc_others: number; total_cc_dealt: number } // 控制敌方时间 / 总共控制时长
  // ═══ 生存 ═══
  survival: {
    longest_time_living: number    // 最长连续存活时间
    damage_self_mitigated: number  // 自我减伤
    total_heal: number             // 总治疗量
    total_units_healed: number     // 治疗单位数
  }
  champ_level: number          // 英雄等级
  firsts: Record<string, boolean> // 首杀/首塔标记
  summoner_spells: { spell1: number | null; spell2: number | null } // 召唤师技能
  position: { individual_position: string; team_position: string; lane: string } // 位置
  surrender: Record<string, boolean> // 投降标记
  arena: { subteam_placement: number; player_subteam_id: number; player_augments: number[] } // 竞技场
  scores: { combat: number; objective: number; total: number; rank: number; details: number[] } // 【LCU 独有】评分
  role_bound_item: number      // 【LCU 独有】角色绑定装备
  was_severe_transgressor: boolean // 【LCU 独有】是否严重违规
  win: boolean                 // 胜负
  // ═══ SGP 独有字段（LCU 降级时为 0/null/{}） ═══
  challenges: Record<string, number>     // 挑战数据（130+ 字段，含击杀参与率/分均伤害/英雄专属层数等）
  spell_casts: SpellCasts           // 技能释放次数 (Q/W/E/R)
  summoner_casts: SummonerCasts     // 召唤师技能释放次数 (D/F)
  pings: Pings                      // 14 种信号次数
  team_contribution: TeamContribution // 团队贡献（护盾/治疗/偷龙）
  time_breakdown: TimeBreakdown     // 时间分解（死亡时间/游戏时间）
  items_purchased: number           // 购买装备次数
  consumables_purchased: number     // 购买消耗品次数
  detector_wards_placed: number     // 放置控制守卫数
  bounty_level: number              // 赏金等级
  champ_experience: number          // 英雄经验值
}

// ═══ SGP 专属子结构（LCU 降级时字段为 0/null） ═══

/** 技能释放次数 (Q/W/E/R) — SGP 独有 */
export interface SpellCasts {
  q: number   // Q 技能释放次数 (spell1Casts)
  w: number   // W 技能释放次数 (spell2Casts)
  e: number   // E 技能释放次数 (spell3Casts)
  r: number   // R 技能释放次数 (spell4Casts)
}

/** 召唤师技能释放次数 (D/F) — SGP 独有 */
export interface SummonerCasts {
  d: number   // D 召唤师技能释放次数 (summoner1Casts)
  f: number   // F 召唤师技能释放次数 (summoner2Casts)
}

/** 信号次数 (14 种) — SGP 独有 */
export interface Pings {
  all_in: number         // 冲锋/全力进攻
  assist: number         // 请求协助
  bait: number           // 诱饵
  basic: number          // 基础信号
  command: number        // 指令
  danger: number         // 危险
  enemy_missing: number  // 敌人消失
  enemy_vision: number   // 发现敌方视野
  get_back: number       // 撤退
  hold: number           // 原地待命
  need_vision: number    // 请求视野
  on_my_way: number      // 正在路上
  push: number           // 推进
  vision_cleared: number // 视野已清除
}

/** 团队贡献 — SGP 独有 */
export interface TeamContribution {
  damage_shielded: number            // 为队友吸收伤害（护盾/减伤）
  heals_on_teammates: number         // 为队友治疗量
  objectives_stolen: number          // 偷龙/偷男爵成功次数
  objectives_stolen_assists: number  // 偷龙/偷男爵助攻次数
}

/** 时间分解 — SGP 独有 */
export interface TimeBreakdown {
  total_time_dead: number  // 总死亡时间（秒）
  time_played: number      // 实际游戏时间（秒，不含加载/暂停）
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

export interface CherrySubteamData {
  subteam_id: number
  placement: number   // 1-6，子队最终排名
  players: PlayerData[]
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
  cherry_subteams?: CherrySubteamData[]  // 仅 CHERRY 模式，按排名 1→6 排列
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
  gameType: string
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

// ═══════════════════════════════════════════════════════════
// 比赛看板导出数据（web-dashboard 与 Electron 之间的唯一契约）
// ═══════════════════════════════════════════════════════════

export interface DashboardMetricEntry {
  name: string          // 选手名
  champion: string      // 使用英雄
  value: number         // 聚合值（总计或平均）
  title?: string        // 称号（仅第一名，如"死神降临"）
  profileIconId?: number // 头像 ID（CommunityDragon CDN）
}

export interface DashboardMetric {
  label: string         // 中文标签，如 "击杀王"
  icon: string          // emoji 图标
  color: string         // 霓虹强调色 hex
  ranking: DashboardMetricEntry[]  // Top 3 排名
}

export interface DashboardData {
  meta: {
    round: string       // 轮次名称，如 "第3轮"
    mode: string        // 游戏模式
    playerCount: number // 选手数
    updatedAt: string   // ISO 时间戳
  }
  metrics: Record<string, DashboardMetric>  // key → 指标数据
}
