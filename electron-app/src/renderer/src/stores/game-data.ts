/** Pinia store：缓存从 LCU CDN 拉取的完整游戏数据（英雄、装备、技能、符文、队列）
 *  组件通过此 store 获取 iconPath、名称等，无需硬编码
 *  对应 LeagueAkari 的 useLeagueClientStore.gameData */
import { defineStore } from 'pinia'
import { shallowRef, computed } from 'vue'
import type {
  ChampionSimple,
  ItemData,
  SummonerSpellData,
  PerkData,
  PerkstylesData,
  QueueData,
  AugmentData,
  GameDataCache,
} from '@shared/types'
import { createGameDataRepository } from '@application/ports'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const useGameDataStore = defineStore('game-data', () => {
  const champions = shallowRef<Record<number, ChampionSimple>>({})
  const items = shallowRef<Record<number, ItemData>>({})
  const summonerSpells = shallowRef<Record<number, SummonerSpellData>>({})
  const perks = shallowRef<Record<number, PerkData>>({})
  const perkstyles = shallowRef<PerkstylesData>({ schemaVersion: 0, styles: {} })
  const queues = shallowRef<Record<number, QueueData>>({})
  const augments = shallowRef<Record<number, AugmentData>>({})

  const isLoaded = computed(() => Object.keys(champions.value).length > 0)

  /** 连接状态 —— 用于 LcuImage 判断是否可以加载图片 */
  const connected = shallowRef(false)

  async function fetchGameData() {
    console.log('[LCU:STORE] fetchGameData 开始')
    try {
      const repo = createGameDataRepository(window.lcuApi)
      const data: GameDataCache = await repo.load()
      console.log(`[LCU:STORE] fetchGameData 完成: champions=${Object.keys(data.champions).length}, items=${Object.keys(data.items).length}, spells=${Object.keys(data.summonerSpells).length}, perks=${Object.keys(data.perks).length}, queues=${Object.keys(data.queues).length}, augments=${Object.keys(data.augments).length}`)

      champions.value = data.champions
      items.value = data.items
      summonerSpells.value = data.summonerSpells
      perks.value = data.perks
      perkstyles.value = data.perkstyles
      queues.value = data.queues
      augments.value = data.augments
      connected.value = true
      console.log('[LCU:STORE] connected=true, 游戏数据已就绪')
    } catch (err: unknown) {
      console.error(`[LCU:STORE] 拉取游戏数据失败：${errMsg(err)}`, err)
      connected.value = false
    }
  }

  function setConnected(state: boolean) {
    connected.value = state
  }

  return {
    champions,
    items,
    summonerSpells,
    perks,
    perkstyles,
    queues,
    augments,
    isLoaded,
    connected,
    fetchGameData,
    setConnected,
  }
})
