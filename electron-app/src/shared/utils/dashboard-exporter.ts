/**
 * 比赛看板数据导出器
 * 纯函数：GameRecord[] → DashboardData
 * 不依赖 Electron/Node API，可直接单元测试
 *
 * 输出格式对齐 web-dashboard 冬天杯4.0：
 *   6 指标（score/mvp/kills/deaths/kda/damage）
 *   2×3 横向柱状排行榜 · T1 红黑主题
 *   全部玩家排名 + profileIconId（CDN 头像）
 */
import type { GameRecord, PlayerStats, DashboardData, DashboardMetric } from '@shared/types'

// ═══════════════════════════════════════════════════════════
// 指标顺序（与 web-dashboard/app.js METRIC_ORDER 一致）
// ═══════════════════════════════════════════════════════════

const METRIC_ORDER = ['score', 'mvp', 'kills', 'deaths', 'kda', 'damage'] as const

const METRIC_META: Record<string, { label: string; icon: string; color: string }> = {
  score:  { label: '积分', icon: '🏆', color: '#ffd700' },
  mvp:    { label: 'MVP', icon: '⭐', color: '#ffd700' },
  kills:  { label: '击杀', icon: '⚔️', color: '#ff4655' },
  deaths: { label: '死亡', icon: '💀', color: '#888888' },
  kda:    { label: 'KDA', icon: '🎯', color: '#8b5cf6' },
  damage: { label: '输出', icon: '🗡️', color: '#ff4655' },
}

const FIRST_PLACE_TITLES: Record<string, string> = {
  kills: '死神降临',
  kda: '不死之身',
  damage: '输出机器',
}

// ═══════════════════════════════════════════════════════════
// 指标 getter（总计聚合）
// ═══════════════════════════════════════════════════════════

/** 积分：胜场数（每赢一场积 1 分） */
function scoreGetter(s: PlayerStats): number {
  return s.win ? 1 : 0
}

const GETTERS: Record<string, (s: PlayerStats) => number> = {
  kills:  s => s.kills,
  deaths: s => s.deaths,
  kda:    s => (s.kills + s.assists) / Math.max(s.deaths, 1),
  damage: s => s.damage.total_to_champs,
}

// ═══════════════════════════════════════════════════════════
// 聚合（复刻 computeMetricRanking 逻辑，无需依赖 MetricDef）
// ═══════════════════════════════════════════════════════════

interface PlayerAgg {
  name: string
  profileIconId: number
  total: number
  count: number
}

function aggregateByGetter(games: GameRecord[], getter: (s: PlayerStats) => number): PlayerAgg[] {
  const map = new Map<string, PlayerAgg>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!map.has(name)) {
        map.set(name, { name, profileIconId: p.profile_icon_id, total: 0, count: 0 })
      }
      const agg = map.get(name)!
      agg.total += getter(p.stats)
      agg.count++
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// ═══════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════

export interface ExportOptions {
  round: string              // 轮次名称
  gameMode: string           // 游戏模式
  now?: Date                 // 用于 updatedAt 的时间戳
  championNameMap?: Record<number, string>  // championId → 中文名
}

/**
 * 将 GameRecord[] 转换为 DashboardData（冬天杯4.0 格式）
 */
export function exportDashboardData(
  games: GameRecord[],
  _allMetricDefs?: unknown,   // 保留兼容（不再使用）
  options?: ExportOptions,
): DashboardData {
  const opts = options || { round: '第1轮', gameMode: '', now: new Date(), championNameMap: {} }

  // 收集全部玩家名
  const playerNames = new Set<string>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      playerNames.add(p.summoner_name)
    }
  }

  // ── MVP 暂留空（数据层待定） ──
  const mvpPlaceholder = new Map<string, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      if (!mvpPlaceholder.has(p.summoner_name)) {
        mvpPlaceholder.set(p.summoner_name, 0)
      }
    }
  }

  // ── 构建指标数据 ──
  const metrics: Record<string, DashboardMetric> = {}

  for (const key of METRIC_ORDER) {
    const meta = METRIC_META[key] || { label: key, icon: '📊', color: '#888888' }
    let ranking: PlayerAgg[]

    if (key === 'score') {
      ranking = aggregateByGetter(games, scoreGetter)
    } else if (key === 'mvp') {
      // MVP 暂时全为 0，保留全部玩家占位（头像正常显示）
      ranking = Array.from(mvpPlaceholder.entries())
        .map(([name, total]) => {
          // 查找该玩家的 profileIconId
          let pid = 0
          for (const g of games) {
            for (const p of [...g.blue_team.players, ...g.red_team.players]) {
              if (p.summoner_name === name) { pid = p.profile_icon_id; break }
            }
            if (pid) break
          }
          return { name, profileIconId: pid, total, count: 1 }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    } else {
      const getter = GETTERS[key]
      if (!getter) continue
      ranking = aggregateByGetter(games, getter)
    }

    if (!ranking || ranking.length === 0) continue

    const title = FIRST_PLACE_TITLES[key] || ''

    metrics[key] = {
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      ranking: ranking.map((r, i) => {
        // KDA 取每局平均（非累计），其余指标取总计
        const value = key === 'kda'
          ? (r.count > 0 ? r.total / r.count : 0)
          : r.total
        return {
          name: r.name,
          champion: findChampionForPlayer(games, r.name, opts.championNameMap),
          value: Math.round(value * 100) / 100,
          profileIconId: r.profileIconId || undefined,
          title: i === 0 && title ? title : undefined,
        }
      }),
    }
  }

  return {
    meta: {
      round: opts.round,
      mode: opts.gameMode,
      playerCount: playerNames.size,
      updatedAt: (opts.now ?? new Date()).toISOString(),
    },
    metrics,
  }
}

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

function findChampionForPlayer(
  games: GameRecord[],
  playerName: string,
  championNameMap?: Record<number, string>,
): string {
  for (let i = games.length - 1; i >= 0; i--) {
    for (const p of [...games[i].blue_team.players, ...games[i].red_team.players]) {
      if (p.summoner_name === playerName && p.champion_id) {
        if (championNameMap && championNameMap[p.champion_id]) {
          return championNameMap[p.champion_id]
        }
        return `英雄#${p.champion_id}`
      }
    }
  }
  return ''
}
