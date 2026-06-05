/**
 * 分析领域 — 频次统计函数
 * 纯计算，不依赖 Vue/Electron/GameDataStore，可直接单元测试
 */

import type { GameRecord, PlayerStats } from '@shared/types'
import type {
  GlobalChampFreq,
  GlobalItemFreq,
  GlobalAugmentFreq,
  PlayerChampionPool,
  PlayerFavItem,
  PlayerFavAug,
} from '@domain/analysis/types'

// ═══════════════════════════════════════════════════════════
// 全局频次 TOP 10
// ═══════════════════════════════════════════════════════════

export function computeGlobalChampionFreq(
  games: GameRecord[],
  getName: (id: number) => string,
): GlobalChampFreq[] {
  const countMap = new Map<number, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const cid = p.champion_id
      if (cid && cid > 0) {
        countMap.set(cid, (countMap.get(cid) || 0) + 1)
      }
    }
  }

  return Array.from(countMap.entries())
    .map(([championId, count]) => ({ championId, count, name: getName(championId) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function computeGlobalItemFreq(
  games: GameRecord[],
  isBuildItem: (id: number) => boolean,
  getName: (id: number) => string,
  getIconPath: (id: number) => string,
): GlobalItemFreq[] {
  const countMap = new Map<number, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      for (const itemId of p.stats.items) {
        if (isBuildItem(itemId)) {
          countMap.set(itemId, (countMap.get(itemId) || 0) + 1)
        }
      }
    }
  }

  return Array.from(countMap.entries())
    .map(([itemId, count]) => ({
      itemId,
      count,
      name: getName(itemId),
      iconPath: getIconPath(itemId),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function computeGlobalAugmentFreq(
  games: GameRecord[],
  getName: (id: number) => string,
  getIconPath: (id: number) => string,
  getRarity: (id: number) => string,
): GlobalAugmentFreq[] {
  const countMap = new Map<number, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      for (const augId of p.stats.arena.player_augments) {
        if (augId && augId > 0) {
          countMap.set(augId, (countMap.get(augId) || 0) + 1)
        }
      }
    }
  }

  return Array.from(countMap.entries())
    .map(([id, count]) => ({
      id,
      count,
      name: getName(id),
      iconPath: getIconPath(id),
      rarity: getRarity(id),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// ═══════════════════════════════════════════════════════════
// 玩家最爱
// ═══════════════════════════════════════════════════════════

export function computePlayerChampionPools(games: GameRecord[]): PlayerChampionPool[] {
  const playerChamps = new Map<string, Map<number, { count: number; wins: number }>>()
  const playerMeta = new Map<string, { profileIconId: number; totalGames: number; winCount: number }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerChamps.has(name)) {
        playerChamps.set(name, new Map())
        playerMeta.set(name, { profileIconId: p.profile_icon_id, totalGames: 0, winCount: 0 })
      }
      const meta = playerMeta.get(name)!
      meta.totalGames++
      if (p.stats.win) meta.winCount++
      const champMap = playerChamps.get(name)!
      const entry = champMap.get(p.champion_id) || { count: 0, wins: 0 }
      entry.count++
      if (p.stats.win) entry.wins++
      champMap.set(p.champion_id, entry)
    }
  }

  return Array.from(playerChamps.entries())
    .map(([name, champMap]) => {
      let bestId = 0
      let bestCount = 0
      let bestWins = 0
      for (const [id, { count, wins }] of champMap) {
        if (count > bestCount || (count === bestCount && id < bestId)) {
          bestCount = count
          bestWins = wins
          bestId = id
        }
      }
      const meta = playerMeta.get(name)!
      return {
        playerName: name,
        profileIconId: meta.profileIconId,
        uniqueChampions: champMap.size,
        mostPlayedChampionId: bestId,
        mostPlayedChampionCount: bestCount,
        favChampWins: bestWins,
        totalGames: meta.totalGames,
        winCount: meta.winCount,
      }
    })
    .sort((a, b) => b.uniqueChampions - a.uniqueChampions)
}

export function computePlayerFavoriteItems(
  games: GameRecord[],
  isBuildItem: (id: number) => boolean,
  getName: (id: number) => string,
  getIconPath: (id: number) => string,
): PlayerFavItem[] {
  const playerItemMap = new Map<string, Map<number, number>>()
  const playerMeta = new Map<string, { profileIconId: number; totalGames: number }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerItemMap.has(name)) {
        playerItemMap.set(name, new Map())
        playerMeta.set(name, { profileIconId: p.profile_icon_id, totalGames: 0 })
      }
      playerMeta.get(name)!.totalGames++
      const itemCount = playerItemMap.get(name)!
      for (const itemId of p.stats.items) {
        if (isBuildItem(itemId)) {
          itemCount.set(itemId, (itemCount.get(itemId) || 0) + 1)
        }
      }
    }
  }

  return Array.from(playerItemMap.entries())
    .map(([name, itemMap]) => {
      let bestItemId = 0
      let bestCount = 0
      for (const [id, count] of itemMap) {
        if (count > bestCount) {
          bestCount = count
          bestItemId = id
        }
      }
      const meta = playerMeta.get(name)!
      return {
        playerName: name,
        profileIconId: meta.profileIconId,
        itemId: bestItemId,
        itemName: getName(bestItemId),
        iconPath: getIconPath(bestItemId),
        count: bestCount,
        totalGames: meta.totalGames,
      }
    })
    .filter(p => p.itemId > 0)
}

export function computePlayerFavoriteAugments(
  games: GameRecord[],
  getName: (id: number) => string,
  getIconPath: (id: number) => string,
  getRarity: (id: number) => string,
): PlayerFavAug[] {
  const playerAugMap = new Map<string, Map<number, number>>()
  const playerMeta = new Map<string, { profileIconId: number; totalGames: number }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerAugMap.has(name)) {
        playerAugMap.set(name, new Map())
        playerMeta.set(name, { profileIconId: p.profile_icon_id, totalGames: 0 })
      }
      playerMeta.get(name)!.totalGames++
      const augCount = playerAugMap.get(name)!
      for (const augId of p.stats.arena.player_augments) {
        if (augId && augId > 0) {
          augCount.set(augId, (augCount.get(augId) || 0) + 1)
        }
      }
    }
  }

  return Array.from(playerAugMap.entries())
    .map(([name, augMap]) => {
      let bestId = 0
      let bestCount = 0
      for (const [id, count] of augMap) {
        if (count > bestCount) {
          bestCount = count
          bestId = id
        }
      }
      const meta = playerMeta.get(name)!
      return {
        playerName: name,
        profileIconId: meta.profileIconId,
        augmentId: bestId,
        augmentName: getName(bestId),
        iconPath: getIconPath(bestId),
        rarity: getRarity(bestId),
        count: bestCount,
        totalGames: meta.totalGames,
      }
    })
    .filter(p => p.augmentId > 0)
}

// ═══════════════════════════════════════════════════════════
// 使用者查询
// ═══════════════════════════════════════════════════════════

export function getChampionUsers(
  games: GameRecord[],
  championId: number,
): { playerName: string; count: number }[] {
  const playerCount = new Map<string, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      if (p.champion_id === championId) {
        playerCount.set(p.summoner_name, (playerCount.get(p.summoner_name) || 0) + 1)
      }
    }
  }
  return Array.from(playerCount.entries())
    .map(([playerName, count]) => ({ playerName, count }))
    .sort((a, b) => b.count - a.count)
}

export function getItemUsers(
  games: GameRecord[],
  itemId: number,
  isBuildItem: (id: number) => boolean,
): { playerName: string; count: number }[] {
  const playerCount = new Map<string, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      for (const id of p.stats.items) {
        if (id === itemId && isBuildItem(id)) {
          playerCount.set(p.summoner_name, (playerCount.get(p.summoner_name) || 0) + 1)
        }
      }
    }
  }
  return Array.from(playerCount.entries())
    .map(([playerName, count]) => ({ playerName, count }))
    .sort((a, b) => b.count - a.count)
}

export function getAugmentUsers(
  games: GameRecord[],
  augId: number,
): { playerName: string; count: number }[] {
  const playerCount = new Map<string, number>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      for (const id of p.stats.arena.player_augments) {
        if (id === augId) {
          playerCount.set(p.summoner_name, (playerCount.get(p.summoner_name) || 0) + 1)
        }
      }
    }
  }
  return Array.from(playerCount.entries())
    .map(([playerName, count]) => ({ playerName, count }))
    .sort((a, b) => b.count - a.count)
}

/** 按使用频率 (count/totalGames) 降序排列 */
export function sortPlayerAugmentsByFreq(augs: PlayerFavAug[]): PlayerFavAug[] {
  return [...augs].sort((a, b) => {
    const rateA = a.count / a.totalGames
    const rateB = b.count / b.totalGames
    return rateB - rateA
  })
}
