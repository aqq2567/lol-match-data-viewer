/**
 * 将对局数据格式化为 AI 可读的结构化文本
 * 纯函数，包含原始字段 + 所有模式指标的高阶聚合
 */
import type { GameRecord, GameDataCache, PlayerStats } from '@shared/types/app'
import { getModeAnalysisConfig, type MetricDef } from '@shared/utils/mode-analysis-config'

/** 格式化单局对局 */
function formatGame(game: GameRecord, gds: GameDataCache, index: number): string {
  const date = new Date(game.game_creation).toLocaleDateString('zh-CN')
  const dur = `${game.game_duration_min.toFixed(0)}min`
  const lines: string[] = []

  lines.push(`## 对局 #${index + 1} — ${date} · ${dur} · ${gds.queues[game.queue_id]?.shortName || game.game_mode}`)

  const teamLabel = (side: string, win: boolean) => `${side}${win ? ' ✓胜' : ''}`

  // 蓝方
  lines.push(`### ${teamLabel('蓝方', game.blue_team.win)}`)
  for (const p of game.blue_team.players) {
    lines.push(formatPlayer(p, gds))
  }

  // 红方
  lines.push(`### ${teamLabel('红方', game.red_team.win)}`)
  for (const p of game.red_team.players) {
    lines.push(formatPlayer(p, gds))
  }

  return lines.join('\n')
}

/** 格式化单个玩家 */
function formatPlayer(p: { summoner_name: string; champion_id: number; stats: PlayerStats }, gds: GameDataCache): string {
  const s = p.stats
  const champ = gds.champions[p.champion_id]?.name || `英雄#${p.champion_id}`
  const kda = s.deaths > 0 ? ((s.kills + s.assists) / s.deaths).toFixed(2) : String(s.kills + s.assists)

  const items = s.items
    .filter(id => id > 0)
    .map(id => gds.items[id]?.name || id)
    .join(', ')

  const augments = s.arena.player_augments
    .filter(id => id > 0)
    .map(id => gds.augments[id]?.nameTRA || `海克斯#${id}`)
    .join(', ')

  const spells = [s.summoner_spells.spell1, s.summoner_spells.spell2]
    .filter(Boolean)
    .map(id => gds.summonerSpells[id!]?.name || id)
    .join('/')

  const spellCastTotal = s.spell_casts.q + s.spell_casts.w + s.spell_casts.e + s.spell_casts.r

  const parts = [
    `${p.summoner_name}（${champ}）`,
    `K ${s.kills}/${s.deaths}/${s.assists}（KDA ${kda}）`,
    `伤害 ${s.damage.total_to_champs}（物${s.damage.physical_to_champs}/魔${s.damage.magic_to_champs}/真${s.damage.true_to_champs}）`,
    `经济 ${s.economy.gold_earned}（剩余${s.economy.gold_earned - s.economy.gold_spent}）`,
    `补刀 ${s.cs.total}（兵${s.cs.minions}/野${s.cs.neutral_total}）`,
    `视野 ${s.vision.score}`,
    `承伤 ${s.damage.total_taken}`,
    `CC ${s.cc.total_cc_dealt}s`,
    `治疗 ${s.survival.total_heal}`,
    `等级 ${s.champ_level}`,
    `技能释放 ${spellCastTotal}次（Q${s.spell_casts.q}/W${s.spell_casts.w}/E${s.spell_casts.e}/R${s.spell_casts.r}）`,
    `召唤师技能 ${spells}`,
    `装备: ${items}`,
  ]

  // 关键挑战数据（击杀参与率、分均伤害等）
  const topChallenges = [
    s.challenges.killParticipation != null ? `参与率${(s.challenges.killParticipation * 100).toFixed(1)}%` : '',
    s.challenges.damagePerMinute != null ? `分均伤害${s.challenges.damagePerMinute.toFixed(0)}` : '',
    s.challenges.goldPerMinute != null ? `分均经济${s.challenges.goldPerMinute.toFixed(0)}` : '',
    s.challenges.teamDamagePercentage != null ? `团队伤害占比${s.challenges.teamDamagePercentage.toFixed(1)}%` : '',
    s.challenges.soloKills != null ? `单杀${s.challenges.soloKills}` : '',
    s.challenges.abilityUses != null ? `技能总次数${s.challenges.abilityUses}` : '',
  ].filter(Boolean)
  if (topChallenges.length > 0) parts.push(`进阶: ${topChallenges.join(' | ')}`)

  if (augments) parts.push(`海克斯: ${augments}`)

  return `- ${parts.join(' | ')}`
}

/** 计算并格式化模式指标排名 */
function formatMetricRanking(
  games: GameRecord[],
  gds: GameDataCache,
  mode: string,
): string {
  const cfg = getModeAnalysisConfig(mode)
  const allMetrics = [...cfg.basicMetrics, ...cfg.advancedMetrics]
  if (allMetrics.length === 0) return ''

  // 聚合所有玩家
  const playerMap = new Map<string, {
    profileIconId: number
    gameCount: number
    winCount: number
    metrics: Record<string, number>
  }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerMap.has(name)) {
        playerMap.set(name, {
          profileIconId: p.profile_icon_id,
          gameCount: 0,
          winCount: 0,
          metrics: {},
        })
      }
      const agg = playerMap.get(name)!
      agg.gameCount++
      if (p.stats.win) agg.winCount++
      for (const m of allMetrics) {
        agg.metrics[m.key] = (agg.metrics[m.key] || 0) + m.getter(p.stats)
      }
    }
  }

  const lines: string[] = ['\n## 高阶聚合指标\n']

  for (const m of allMetrics) {
    const ranking = Array.from(playerMap.entries())
      .map(([name, agg]) => ({
        name,
        total: agg.metrics[m.key] || 0,
        count: agg.gameCount,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    lines.push(`### ${m.label} TOP 5`)
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i]
      lines.push(`${i + 1}. ${r.name} — ${m.fmt(r.total)}（${r.count}局）`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** 检测 games 中的多数模式 */
function detectMode(games: GameRecord[]): string {
  const modes = new Map<string, number>()
  for (const g of games) {
    modes.set(g.game_mode, (modes.get(g.game_mode) || 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [mode, count] of modes) {
    if (count > bestCount) { bestCount = count; best = mode }
  }
  return best
}

/**
 * 将对局数据格式化为 AI system prompt 文本
 * @param games 选中的对局记录
 * @param gds 游戏数据缓存（英雄名、装备名等）
 * @returns 格式化的 AI 可读文本
 */
export function formatGamesForAI(games: GameRecord[], gds: GameDataCache): string {
  if (!games || games.length === 0) return '（无对局数据）'

  const mode = detectMode(games)
  const modeName = getModeAnalysisConfig(mode).displayName || mode
  const playerNames = new Set<string>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      playerNames.add(p.summoner_name)
    }
  }

  const lines: string[] = [
    `## 对局数据摘要`,
    `模式：${modeName} · 共 ${games.length} 场 · ${playerNames.size} 位玩家`,
    '',
  ]

  // 逐场详情
  for (let i = 0; i < games.length; i++) {
    lines.push(formatGame(games[i], gds, i))
    lines.push('')
  }

  // 高阶聚合指标
  lines.push(formatMetricRanking(games, gds, mode))

  return lines.join('\n')
}
