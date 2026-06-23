<template>
  <div class="match-list-page">
    <TabBar />
    <div class="tab-content">
      <KeepAlive :max="10">
        <PlayerGamesList
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          :tab-id="tab.id"
          :puuid="tab.puuid"
          :name="tab.name"
          :profile-icon-id="tab.profileIconId"
          :summoner-level="tab.summonerLevel"
        />
      </KeepAlive>
    </div>

    <!-- DEMO: 每日总结预览 -->
    <button class="demo-trigger" @click="showDemo = true">📊 预览每日总结</button>
    <DailySummaryCard v-if="showDemo" :puuid="activeTab?.puuid || ''" @close="showDemo = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabStore } from '@/stores/tab'
import { useGameDataStore } from '@/stores/game-data'
import { summonerDisplayName } from '@shared/types'
import { initializeSession } from '@application/connection-service'
import { createSessionRepository } from '@application/ports'
import TabBar from '@/components/sidebar/TabBar.vue'
import PlayerGamesList from './PlayerGamesList.vue'
import DailySummaryCard from '@/components/daily/DailySummaryCard.vue'

const showDemo = ref(false)

const tabStore = useTabStore()
const gds = useGameDataStore()
const { tabs, activeTabId } = storeToRefs(tabStore)
const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))

onMounted(async () => {
  tabStore.ensureDefaultTab()

  if (typeof window.lcuApi === 'undefined') return
  const conn = await window.lcuApi.checkConnection()
  const { connected, summoner } = await initializeSession(createSessionRepository(window.lcuApi))
  if (connected && summoner) {
    tabStore.updateDefaultTab(summoner.puuid, summonerDisplayName(summoner), summoner.profileIconId, summoner.summonerLevel)
    if (!gds.isLoaded) {
      await gds.fetchGameData()
    }
    // Init SGP in background — don't block UI.
    // rsoPlatformId comes from the LCU connection info (e.g. TENCENT_HN1).
    const platform = conn?.rsoPlatformId || ''
    if (platform) {
      window.lcuApi.sgpInit(platform).then(ok => {
        console.log(ok ? '[APP] SGP ready' : '[APP] SGP unavailable, using LCU')
      }).catch(() => {})
    }
  }
})
</script>

<style lang="less" scoped>
.match-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.tab-content {
  flex: 1;
  min-height: 0;
}

/* DEMO 按钮 — 临时 */
.demo-trigger {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9990;
  padding: 8px 18px;
  border: 1px solid rgba(10,200,232,0.3);
  border-radius: 8px;
  background: rgba(10,200,232,0.1);
  color: #0ac8e8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
  &:hover {
    background: rgba(10,200,232,0.2);
    border-color: rgba(10,200,232,0.5);
  }
}
</style>
