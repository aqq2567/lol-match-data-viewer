/**
 * 字段映射表 —— 将 LCU API 原始编码值映射为中文显示名称
 * 主进程和渲染进程均可使用（纯数据，无依赖）
 */

// ═══════════════════════════════════════════════════════════
// 游戏模式 (gameMode) → 中文名称
// ═══════════════════════════════════════════════════════════

export const GAME_MODE_MAP: Record<string, string> = {
  CLASSIC: '召唤师峡谷',
  ARAM: '极地大乱斗',
  PRACTICETOOL: '训练模式',
  TUTORIAL: '新手教程',
  CHERRY: '斗魂竞技场',
  KIWI: '海克斯大乱斗',
  URF: '无限火力',
  ONEFORALL: '克隆大作战',
  NEXUSBLITZ: '极限闪击',
  ULTBOOK: '终极魔典',
  ASSASSINATE: '暗杀星',
  DARKSTAR: '暗星',
  DOOMBOTSTEEMO: '末日人机',
  FIRSTBLOOD: '一血模式',
  ODYSSEY: '奥德赛',
  SIEGE: '围城模式',
  STAR: '星之守护者',
  POROKING: '魄罗王',
  ASCENSION: '飞升模式',
  KINGPORO: '国王魄罗',
  SNOWURF: '冰雪无限火力',
  NEMESIS: '宿命对决',
  BILGEWATER: '比尔吉沃特',
  HEXAKILL: '六杀模式',
  BLOODMOON: '血月杀',
  DEFINITELYNOT: '死兆星',
  OVERCHARGE: '过载模式',
  INVASION: '怪兽入侵',
  MELEE: '近战大乱斗',
  GAMEMODEX: '极限闪击2.0',
  STARGUARDIAN: '星之守护者',
  PROJECT: '源计划',
  ODYSSEYINTRO: '奥德赛序章',
  ODYSSEYCADET: '奥德赛学员',
  ODYSSEYCREWMEMBER: '奥德赛船员',
  ODYSSEYCAPTAIN: '奥德赛队长',
  ODYSSEYONSLAUGHT: '奥德赛突袭',
  NEXUSBLITZ2: '极限闪击2',
  TFT: '云顶之弈',
  TFT_TUTORIAL: '云顶教学',
  TFT_DOUBLEUP: '云顶双人',
  SWIFTPLAY: '快速游戏',
  ARURF: '随机无限火力',
  NBATF: '极限闪击',
  QUICKPLAY: '快速对战',
}

// ═══════════════════════════════════════════════════════════
// 地图 ID (mapId) → 地图名称
// ═══════════════════════════════════════════════════════════

export const MAP_ID_MAP: Record<number, string> = {
  1: '召唤师峡谷',
  2: '召唤师峡谷',
  3: '试炼之地',
  4: '扭曲丛林',
  8: '水晶之痕',
  10: '扭曲丛林',
  11: '召唤师峡谷',
  12: '嚎哭深渊',
  14: '屠夫之桥',
  16: '星界裂隙',
  18: '暗星地图',
  19: '星之守护者',
  20: '极限闪击',
  21: '斗魂竞技场',
  22: '云顶之弈',
}

// ═══════════════════════════════════════════════════════════
// 段位 (tier) → 中文名称
// ═══════════════════════════════════════════════════════════

export const TIER_MAP: Record<string, string> = {
  IRON: '黑铁',
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  PLATINUM: '铂金',
  EMERALD: '翡翠',
  DIAMOND: '钻石',
  MASTER: '大师',
  GRANDMASTER: '宗师',
  CHALLENGER: '王者',
}

export const DIVISION_MAP: Record<string, string> = {
  I: 'Ⅰ',
  II: 'Ⅱ',
  III: 'Ⅲ',
  IV: 'Ⅳ',
  V: 'Ⅴ',
}

/** 将段位枚举 + 级别转为中文展示，如 "DIAMOND II" → "钻石Ⅱ" */
export function formatTierDivision(tier: string, division: string): string {
  const tierCn = TIER_MAP[tier] || tier
  const divCn = DIVISION_MAP[division] || division
  if (!divCn) return tierCn
  return `${tierCn}${divCn}`
}

// ═══════════════════════════════════════════════════════════
// 队列名称覆盖（LCU queues.json 中可能缺失或不准确的中文名）
// ═══════════════════════════════════════════════════════════

export const QUEUE_NAME_OVERRIDES: Record<number, string> = {
  0: '自定义',
  2: '5v5 盲选',
  4: '5v5 单双排',
  6: '5v5 征召',
  7: '5v5 人机',
  8: '3v3 人机',
  9: '3v3 灵活排',
  14: '5v5 灵活排',
  16: '5v5 魄罗王',
  17: '5v5 六杀模式',
  25: '魄罗王模式',
  31: '人机入门',
  32: '人机简单',
  33: '人机一般',
  34: '人机困难',
  41: '3v3 排位',
  42: '5v5 排位',
  52: '3v3 征召',
  61: '3v3 人机入门',
  62: '3v3 人机简单',
  63: '3v3 人机一般',
  65: '5v5 ARAM',
  67: 'ARAM',
  70: '无限火力',
  72: '一血模式',
  73: '飞升模式',
  75: '六杀模式',
  76: '随机无限火力',
  78: '镜像模式',
  83: '人机终极',
  91: '末日人机',
  92: '末日人机',
  93: '宿命对决',
  96: '飞升模式',
  98: '海克斯大乱斗',
  100: '5v5 ARAM',
  300: '暗杀星',
  310: '暗星',
  311: '屠夫之桥',
  312: '死兆星',
  313: '血月杀',
  315: '无限火力',
  316: '死兆星',
  317: '极限闪击',
  318: '随机无限火力',
  325: '斗魂竞技场',
  400: '5v5 排位',
  410: '5v5 征召',
  420: '5v5 单双排',
  430: '5v5 盲选',
  440: '5v5 灵活排',
  450: '5v5 ARAM',
  460: '3v3 盲选',
  470: '3v3 排位',
  490: '5v5 征召 (新)',
  700: '峡谷之巅',
  800: '人机入门',
  810: '人机简单',
  820: '人机一般',
  830: '人机困难',
  840: '人机终极',
  850: '人机入门',
  860: '云顶之弈',
  870: '新手教程',
  880: '新手教程',
  890: '新手教程',
  900: '无限火力',
  910: '极限闪击',
  920: '魄罗王',
  940: '极限闪击',
  950: '末日人机',
  960: '末日人机',
  980: '血月杀',
  981: '怪兽入侵',
  982: '怪兽入侵',
  990: '星之守护者',
  1000: '斗魂竞技场',
  1010: '斗魂竞技场',
  1020: '克隆大作战',
  1030: '奥德赛',
  1040: '奥德赛',
  1050: '奥德赛',
  1060: '奥德赛',
  1070: '奥德赛',
  1090: '云顶之弈',
  1100: '云顶排位',
  1110: '云顶教学',
  1111: '云顶教学',
  1130: '云顶双人',
  1160: '云顶双人排位',
  1170: '峡谷之巅',
  1200: '海克斯大乱斗',
  1220: '终极魔典',
  1300: '斗魂竞技场',
  1400: '终极魔典',
  1700: '斗魂竞技场',
  1710: '斗魂竞技场',
  1800: 'STRAWBERRY',
  1810: 'STRAWBERRY',
  1820: 'STRAWBERRY',
  1830: 'STRAWBERRY',
  1840: 'STRAWBERRY',
  1850: 'STRAWBERRY',
  1900: '随机无限火力',
  2000: '人机入门',
  2010: '人机简单',
  2020: '人机一般',
}

// ═══════════════════════════════════════════════════════════
// 游戏模式别名表（某些模式下 LCU 用不同字符串表示同一模式）
// ═══════════════════════════════════════════════════════════

export const GAME_MODE_ALIASES: Record<string, string> = {
  ARURF: 'URF',
  NBATF: 'NEXUSBLITZ',
  QUICKPLAY: 'CLASSIC',
  SWIFTPLAY: 'CLASSIC',
  GAMEMODEX: 'NEXUSBLITZ',
  TFT_DOUBLEUP: 'TFT',
  TFT_TUTORIAL: 'TFT',
  STARGUARDIAN: 'STAR',
  PROJECT: 'STAR',
}

/** 获取游戏模式的中文显示名（含别名解析） */
export function getGameModeName(gameMode: string): string {
  const mode = gameMode?.toUpperCase() || ''
  const resolved = GAME_MODE_ALIASES[mode] || mode
  return GAME_MODE_MAP[resolved] || gameMode || '未知模式'
}

/** 获取队列名称：优先使用 LCU 实时数据，其次覆盖表，最后显示原始 ID */
export function getQueueName(queueId: number, lcuQueues?: Record<number, { name: string }>): string {
  // 优先使用覆盖表中的中文名
  if (QUEUE_NAME_OVERRIDES[queueId]) {
    return QUEUE_NAME_OVERRIDES[queueId]
  }
  // 其次使用 LCU CDN 的实时队列数据
  const q = lcuQueues?.[queueId]
  if (q?.name) return q.name
  return `队列${queueId}`
}

/** 获取地图名称 */
export function getMapName(mapId: number): string {
  return MAP_ID_MAP[mapId] || `地图${mapId}`
}

// ═══════════════════════════════════════════════════════════
// 装备分析排除列表（非出装选择的物品）
// ═══════════════════════════════════════════════════════════

export const EXCLUDED_ITEM_IDS: ReadonlySet<number> = new Set([
  0,     // 空槽位
  2052,  // 魄罗佳肴 (Poro Snax)
  3340,  // 监视图腾
  3363,  // 远见改造
  3364,  // 神谕透镜
])

/** 判断是否为可分析装备（排除消耗品/饰品） */
export function isBuildItem(itemId: number): boolean {
  return itemId > 0 && !EXCLUDED_ITEM_IDS.has(itemId)
}

/** 获取段位中文名称 */
export function getTierName(tier: string): string {
  return TIER_MAP[tier] || tier
}

// ═══════════════════════════════════════════════════════════
// 英雄角色标签 → 中文名称
// ═══════════════════════════════════════════════════════════

export const ROLE_TAG_MAP: Record<string, string> = {
  Fighter: '战士',
  Tank: '坦克',
  Mage: '法师',
  Assassin: '刺客',
  Marksman: '射手',
  Support: '辅助',
}

export function getRoleName(tag: string): string {
  return ROLE_TAG_MAP[tag] || tag
}

/** 获取玩家显示名称：优先 gameName / summonerName，最后回退到 PUUID 前 8 位 */
export function getPlayerDisplayName(p: {
  gameName?: string
  summonerName?: string
  puuid?: string
}): string {
  if (p.gameName) return p.gameName
  if (p.summonerName) return p.summonerName
  if (p.puuid) return p.puuid.slice(0, 8) + '…'
  return '?'
}
