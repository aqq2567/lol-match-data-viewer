/**
 * 应用层 — 好友分析服务
 * 编排"加载好友分析数据"用例
 */

import type { MatchListData } from '@shared/types'
import type { MatchRepository } from './ports'

// ── 领域纯函数 re-export（渲染层通过应用层访问领域计算）──
export { analyzeFriends, computeFriendSummary, FRIEND_METRICS, computeSortedByMetric, computeFriendPodium, getFirstPlaceTitle } from '@domain/analysis/friends'

export async function loadFriendAnalysis(
  api: MatchRepository,
): Promise<{ matchData: MatchListData; participantCount: number }> {
  const data = await api.findCurrentSummonerMatches(1, 100)
  const participantCount = data.games.filter(
    (g) => g.blueParticipants.length > 0 || g.redParticipants.length > 0,
  ).length
  return { matchData: data, participantCount }
}
