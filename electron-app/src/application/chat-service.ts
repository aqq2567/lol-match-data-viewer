import type { GameRecord, GameDataCache } from '@shared/types'
import { formatGamesForAI } from '@shared/utils/format-for-ai'

export function buildChatMessages(
  games: GameRecord[],
  gameData: GameDataCache,
  history: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const systemPrompt = buildSystemPrompt(games, gameData)
  return [{ role: 'system', content: systemPrompt }, ...history]
}

function buildSystemPrompt(games: GameRecord[], gameData: GameDataCache): string {
  if (!games.length) return '无对局数据'

  const data = formatGamesForAI(games, gameData)

  return [
    '你是一个英雄联盟对局数据分析师。请严格遵守以下规则：',
    '',
    '1. **仅使用下方提供的对局数据回答问题**，不要使用你的训练知识猜测玩家行为、出装习惯或游戏meta',
    '2. 如果数据中没有相关信息，直接说"数据中没有体现"，不要编造',
    '3. 仔细核对玩家ID、英雄、装备等字段，不要跨对局或跨玩家混淆数据',
    '4. 分析时引用具体数值（KDA、伤害、经济等）作为依据',
    '',
    '---',
    '',
    data,
  ].join('\n')
}
