/**
 * @deprecated 直接导入路径已拆分，请改为从 './extractors' 导入。
 *   本文件仅保留向后兼容，将在下一大版本中移除。
 */
export {
  safeInt,
  mapById,
  extractPlayerIdentity,
  extractStatsFull,
  extractTeamData,
  extractRankedData,
  extractChampionMasteryForGame,
  fetchMatchList,
  fetchMatchListForPlayer,
  fetchGameDetailsBatched,
  fetchGameData,
  fetchAllMatchData,
} from './extractors'
