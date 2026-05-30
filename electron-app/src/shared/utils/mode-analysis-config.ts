/**
 * 按游戏模式的统计分析配置
 * 不同模式可能有不同的可用数据维度（如海克斯大乱斗无视野/补刀，斗魂竞技场有海克斯增幅）
 *
 * 添加新模式：在 MODE_CONFIGS 中新增条目即可，不存在的模式回退到 CLASSIC
 * 调整某模式的指标列表：直接修改对应条目中的数组
 */
import type { PlayerStats } from '@shared/types/app'

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

export interface MetricDef {
  key: string
  label: string
  colorClass: string
  getter: (s: PlayerStats) => number
  fmt: (v: number) => string
}

export interface ModeAnalysisConfig {
  /** 中文显示名 */
  displayName: string
  /** 基础数据指标列表 */
  basicMetrics: MetricDef[]
  /** 高阶数据指标列表 */
  advancedMetrics: MetricDef[]
  /** 领奖台称号映射 (metricKey → 称号) */
  podiumTitles: Record<string, string>
  /** 高阶最佳称号 */
  advancedBestTitles: Record<string, string>
  /** 高阶最末称号 */
  advancedWorstTitles: Record<string, string>
}

// ═══════════════════════════════════════════════════════════
// 默认全量指标定义
// ═══════════════════════════════════════════════════════════

const ALL_BASIC_METRICS: MetricDef[] = [
  { key: 'kills', label: '击杀', colorClass: 'cat-red', getter: (s) => s.kills, fmt: (v) => String(Math.round(v)) },
  { key: 'deaths', label: '死亡', colorClass: 'cat-red', getter: (s) => s.deaths, fmt: (v) => String(Math.round(v)) },
  { key: 'assists', label: '助攻', colorClass: 'cat-green', getter: (s) => s.assists, fmt: (v) => String(Math.round(v)) },
  { key: 'kda', label: 'KDA', colorClass: 'cat-purple', getter: (s) => (s.kills + s.assists) / Math.max(s.deaths, 1), fmt: (v) => v.toFixed(2) },
  { key: 'damage', label: '伤害', colorClass: 'cat-red', getter: (s) => s.damage.total_to_champs, fmt: (v) => fmtNum(v) },
  { key: 'tank', label: '承伤', colorClass: 'cat-orange', getter: (s) => s.damage.total_taken, fmt: (v) => fmtNum(v) },
  { key: 'largestCrit', label: '最大暴击', colorClass: 'cat-red', getter: (s) => s.damage.largest_critical_strike, fmt: (v) => fmtNum(v) },
  { key: 'heal', label: '治疗', colorClass: 'cat-green', getter: (s) => s.survival.total_heal, fmt: (v) => fmtNum(v) },
  { key: 'selfMitigated', label: '自我减伤', colorClass: 'cat-blue', getter: (s) => s.survival.damage_self_mitigated, fmt: (v) => fmtNum(v) },
  { key: 'gold', label: '打钱', colorClass: 'cat-gold', getter: (s) => s.economy.gold_earned, fmt: (v) => fmtNum(v) },
  { key: 'goldSpent', label: '花钱', colorClass: 'cat-gold', getter: (s) => s.economy.gold_spent, fmt: (v) => fmtNum(v) },
  { key: 'cs', label: '补刀', colorClass: 'cat-gold', getter: (s) => s.cs.total, fmt: (v) => String(Math.round(v)) },
  { key: 'vision', label: '视野', colorClass: 'cat-blue', getter: (s) => s.vision.score, fmt: (v) => String(Math.round(v)) },
  { key: 'wardsPlaced', label: '插眼', colorClass: 'cat-blue', getter: (s) => s.vision.wards_placed, fmt: (v) => String(Math.round(v)) },
  { key: 'wardsKilled', label: '排眼', colorClass: 'cat-blue', getter: (s) => s.vision.wards_killed, fmt: (v) => String(Math.round(v)) },
  { key: 'ccDealt', label: '控制累计', colorClass: 'cat-purple', getter: (s) => s.cc.total_cc_dealt, fmt: (v) => Math.round(v) + 's' },
  { key: 'firstBlood', label: '一血', colorClass: 'cat-red', getter: (s) => s.firsts.first_blood_kill ? 1 : 0, fmt: (v) => String(Math.round(v)) },
  { key: 'firstTower', label: '一塔', colorClass: 'cat-gold', getter: (s) => s.firsts.first_tower_kill ? 1 : 0, fmt: (v) => String(Math.round(v)) },
  { key: 'turrets', label: '推塔', colorClass: 'cat-gold', getter: (s) => s.objectives.turret_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'dmgToTurrets', label: '对塔伤害', colorClass: 'cat-gold', getter: (s) => s.objectives.damage_to_turrets, fmt: (v) => fmtNum(v) },
  { key: 'doubleKills', label: '双杀', colorClass: 'cat-red', getter: (s) => s.double_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'tripleKills', label: '三杀', colorClass: 'cat-red', getter: (s) => s.triple_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'quadraKills', label: '四杀', colorClass: 'cat-red', getter: (s) => s.quadra_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'pentaKills', label: '五杀', colorClass: 'cat-red', getter: (s) => s.penta_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'inhibitorKills', label: '破水晶', colorClass: 'cat-gold', getter: (s) => s.objectives.inhibitor_kills, fmt: (v) => String(Math.round(v)) },
  { key: 'largestKillingSpree', label: '最大连杀', colorClass: 'cat-red', getter: (s) => s.largest_killing_spree, fmt: (v) => String(Math.round(v)) },
  { key: 'killingSprees', label: '连杀次数', colorClass: 'cat-red', getter: (s) => s.killing_sprees, fmt: (v) => String(Math.round(v)) },
  { key: 'largestMultiKill', label: '最大多杀', colorClass: 'cat-red', getter: (s) => s.largest_multi_kill, fmt: (v) => String(Math.round(v)) },
  { key: 'longestTimeSpentLiving', label: '最长存活(秒)', colorClass: 'cat-green', getter: (s) => s.survival.longest_time_living, fmt: (v) => String(Math.round(v)) },
  { key: 'neutralMinionsKilled', label: '野怪击杀', colorClass: 'cat-gold', getter: (s) => s.cs.neutral_total, fmt: (v) => String(Math.round(v)) },
  { key: 'combatScore', label: '战斗评分', colorClass: 'cat-purple', getter: (s) => s.scores.combat, fmt: (v) => fmtNum(v) },
  { key: 'items', label: '装备', colorClass: 'cat-gold', getter: () => 0, fmt: () => '' },
  { key: 'augments', label: '海克斯', colorClass: 'cat-purple', getter: () => 0, fmt: () => '' },
  { key: 'championPool', label: '英雄池', colorClass: 'cat-blue', getter: () => 0, fmt: () => '' },
]

const ALL_ADVANCED_METRICS: MetricDef[] = [
  { key: 'dmgPerGold', label: '伤害/经济', colorClass: 'cat-red', getter: (s) => s.damage.total_to_champs / Math.max(s.economy.gold_earned, 1), fmt: (v) => v.toFixed(2) },
  { key: 'dmgPerKill', label: '伤害/击杀', colorClass: 'cat-orange', getter: (s) => s.damage.total_to_champs / Math.max(s.kills, 1), fmt: (v) => fmtNum(v) },
  { key: 'dmgPerDeath', label: '伤害/死亡', colorClass: 'cat-purple', getter: (s) => s.damage.total_to_champs / Math.max(s.deaths, 1), fmt: (v) => fmtNum(v) },
  { key: 'dmgShare', label: '伤害占比', colorClass: 'cat-red', getter: () => 0, fmt: (v) => (v * 100).toFixed(1) + '%' },
  { key: 'dmgTakenShare', label: '承伤占比', colorClass: 'cat-blue', getter: () => 0, fmt: (v) => (v * 100).toFixed(1) + '%' },
]

const DEFAULT_PODIUM_TITLES: Record<string, string> = {
  deaths: '无暇赴死',
  assists: '我K不到啊',
  damage: '我真尽力了',
  tank: '耐打王',
  largestCrit: '艺术就是核爆',
  heal: '奶一口奶一口奶一口',
  selfMitigated: '不疼',
  gold: '大富翁',
  cs: 'Choooooooooovy!',
  ccDealt: '就是折磨就是胶粘',
  longestTimeSpentLiving: '赖着不死',
}

const DEFAULT_ADVANCED_BEST: Record<string, string> = {
  dmgPerGold: '吃草挤奶',
  dmgPerKill: 'K头有用',
  dmgPerDeath: '自爆卡车',
  dmgShare: '全靠队友',
  dmgTakenShare: '抗在前面',
}

const DEFAULT_ADVANCED_WORST: Record<string, string> = {
  dmgPerGold: '吃奶挤草',
  dmgShare: '查无此人',
  dmgTakenShare: '躲在后面',
  dmgPerKill: 'Kobe',
  dmgPerDeath: '其实我是辅助',
}

/** 默认 config（未匹配到的模式回退到此） */
const DEFAULT_CONFIG: ModeAnalysisConfig = {
  displayName: '未知模式',
  basicMetrics: ALL_BASIC_METRICS,
  advancedMetrics: ALL_ADVANCED_METRICS,
  podiumTitles: DEFAULT_PODIUM_TITLES,
  advancedBestTitles: DEFAULT_ADVANCED_BEST,
  advancedWorstTitles: DEFAULT_ADVANCED_WORST,
}

// ═══════════════════════════════════════════════════════════
// 各模式独立配置（当前均与默认一致，后续按需删减）
// ═══════════════════════════════════════════════════════════

const MODE_CONFIGS: Record<string, ModeAnalysisConfig> = {
  CLASSIC: {
    displayName: '召唤师峡谷',
    basicMetrics: ALL_BASIC_METRICS,
    advancedMetrics: ALL_ADVANCED_METRICS,
    podiumTitles: DEFAULT_PODIUM_TITLES,
    advancedBestTitles: DEFAULT_ADVANCED_BEST,
    advancedWorstTitles: DEFAULT_ADVANCED_WORST,
  },
  ARAM: {
    displayName: '极地大乱斗',
    basicMetrics: ALL_BASIC_METRICS,
    advancedMetrics: ALL_ADVANCED_METRICS,
    podiumTitles: DEFAULT_PODIUM_TITLES,
    advancedBestTitles: DEFAULT_ADVANCED_BEST,
    advancedWorstTitles: DEFAULT_ADVANCED_WORST,
  },
  CHERRY: {
    displayName: '斗魂竞技场',
    basicMetrics: ALL_BASIC_METRICS,
    advancedMetrics: ALL_ADVANCED_METRICS,
    podiumTitles: DEFAULT_PODIUM_TITLES,
    advancedBestTitles: DEFAULT_ADVANCED_BEST,
    advancedWorstTitles: DEFAULT_ADVANCED_WORST,
  },
  KIWI: {
    displayName: '海克斯大乱斗',
    basicMetrics: ALL_BASIC_METRICS,
    advancedMetrics: ALL_ADVANCED_METRICS,
    podiumTitles: DEFAULT_PODIUM_TITLES,
    advancedBestTitles: DEFAULT_ADVANCED_BEST,
    advancedWorstTitles: DEFAULT_ADVANCED_WORST,
  },
}

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

/**
 * 获取指定模式的统计分析配置
 * 未注册的模式返回 CLASSIC 的默认配置
 */
export function getModeAnalysisConfig(gameMode: string): ModeAnalysisConfig {
  return MODE_CONFIGS[gameMode] || { ...DEFAULT_CONFIG, displayName: gameMode || '未知模式' }
}

/** 列出所有已注册的模式代码 */
export const KNOWN_MODES = Object.keys(MODE_CONFIGS)

function fmtNum(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toFixed(0)
}
