<template>
  <div class="analysis-page">
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
      <p>正在拉取对局详情并计算分析数据...</p>
    </div>

    <div v-else-if="!result" class="empty-state">
      <n-icon size="48" color="rgba(255,255,255,0.1)">
        <analytics-outline />
      </n-icon>
      <h3>暂无分析数据</h3>
      <p>请先在对局列表中勾选要分析的对局</p>
      <n-button @click="$router.push({ name: 'match-list' })" type="primary" size="small">
        <template #icon><n-icon><list-outline /></n-icon></template>
        返回对局列表
      </n-button>
    </div>

    <template v-else>
      <AnalysisHeader
        :mode-display-name="modeDisplayName"
        :can-filter-teammates="canFilterTeammates"
        :disable-teammates-reason="disableTeammatesReason"
        :only-teammates="onlyTeammates"
        :game-count="result.gameCount"
        :win-count="result.winCount"
        :lose-count="result.loseCount"
        :win-rate="result.winRate"
        @update:only-teammates="onlyTeammates = $event"
      />

      <div class="analysis-body">
        <MetricSidebar
          :basic-metrics="basicMetrics"
          :advanced-metrics="advancedMetrics"
          :selected-metric="selectedMetric"
          :basic-data-collapsed="basicDataCollapsed"
          :advanced-data-collapsed="advancedDataCollapsed"
          @select-metric="selectMetric"
          @update:basic-data-collapsed="basicDataCollapsed = $event"
          @update:advanced-data-collapsed="advancedDataCollapsed = $event"
        />

        <div class="metric-detail">
          <div v-if="!selectedMetric" class="no-selection">
            <n-icon size="48" color="rgba(255,255,255,0.08)">
              <analytics-outline />
            </n-icon>
            <p>请从左侧选择一个数据指标</p>
            <p class="sub">选择后将展示该指标的玩家排名与领奖台</p>
          </div>

          <template v-else>
            <AugmentDetail
              v-if="selectedMetric === 'augments'"
              :global-augment-freq="globalAugmentFreq"
              :sorted-player-favorite-augments="sortedPlayerFavoriteAugments"
              :get-augment-users="getAugmentUsers"
            />

            <ItemDetail
              v-else-if="selectedMetric === 'items'"
              :global-item-freq="globalItemFreq"
              :player-favorite-items="playerFavoriteItems"
              :get-item-users="getItemUsers"
            />

            <ChampionPoolDetail
              v-else-if="selectedMetric === 'championPool'"
              :global-champion-freq="globalChampionFreq"
              :player-champion-pools="playerChampionPools"
              :get-champion-users="getChampionUsers"
            />

            <template v-else-if="isAdvancedMetric(selectedMetric)">
              <AdvancedDetail
                :ranking="advancedMetricRanking"
                :max-value="maxAdvMetricValue"
                :best-title="advancedBestTitle"
                :worst-title="advancedWorstTitle"
                :label="selectedCategory?.label || ''"
                :fmt="selectedCategory?.fmt || ((v: number) => String(v))"
                :table-max-height="tableMaxHeight"
              />
            </template>

            <template v-else>
              <PodiumDisplay
                :title="(selectedCategory?.label || '') + ' — 领奖台'"
                :podium="metricPodium"
                :first-place-title="firstPlaceTitle"
              />
              <RankingTable
                :title="(selectedCategory?.label || '') + ' — 玩家排名'"
                :ranking="metricRanking"
                :max-value="maxMetricValue.total"
                :fmt="selectedCategory?.fmt || ((v: number) => String(v))"
                :table-max-height="tableMaxHeight"
              />
            </template>

            <ChatPanel :games="analysisGames" />
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NSpin, useMessage } from 'naive-ui'
import { AnalyticsOutline, ListOutline } from '@vicons/ionicons5'
import type { GameRecord, AnalysisResult } from '@shared/types'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import AnalysisHeader from '@/components/analysis/AnalysisHeader.vue'
import MetricSidebar from '@/components/analysis/MetricSidebar.vue'
import PodiumDisplay from '@/components/analysis/PodiumDisplay.vue'
import RankingTable from '@/components/analysis/RankingTable.vue'
import AdvancedDetail from '@/components/analysis/AdvancedDetail.vue'
import AugmentDetail from '@/components/analysis/AugmentDetail.vue'
import ItemDetail from '@/components/analysis/ItemDetail.vue'
import ChampionPoolDetail from '@/components/analysis/ChampionPoolDetail.vue'
import { getModeAnalysisConfig, type MetricDef } from '@shared/utils/mode-analysis-config'
import { useGameDataStore } from '@/stores/game-data'
import { useAnalysisBridge } from '@/stores/analysis-bridge'
import { rateDisplay } from '@/utils/format'
import { computeTableMaxHeight } from '@/utils/display'
import type {
  PodiumEntry,
  MetricRankEntry,
  PlayerFavItem,
  PlayerChampionPool,
  GlobalChampFreq,
  GlobalItemFreq,
  GlobalAugmentFreq,
  PlayerFavAug,
} from '@domain/analysis/types'
import {
  analyzeSelectedGames,
  buildPlayerAggMap, computeMetricRanking, computePodium,
  computeAdvancedMetricRanking,
  isPlayerInAllGames, filterToPlayerTeam,
  computeGlobalChampionFreq, computeGlobalItemFreq, computeGlobalAugmentFreq,
  computePlayerChampionPools, computePlayerFavoriteItems, computePlayerFavoriteAugments,
  sortPlayerAugmentsByFreq,
  getChampionUsers as getChampionUsersPure,
  getItemUsers as getItemUsersPure,
  getAugmentUsers as getAugmentUsersPure,
} from '@application/analysis-service'
import { initializeSession } from '@application/connection-service'
import { createMatchRepository, createSessionRepository } from '@application/ports'
import { isBuildItem, getRoleName } from '@shared/utils/mappings'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const router = useRouter()
const message = useMessage()
const gds = useGameDataStore()
const bridge = useAnalysisBridge()

const loading = ref(false)
const result = ref<AnalysisResult | null>(null)
const _allGames = ref<GameRecord[]>([])

const currentPuuid = ref('')
const onlyTeammates = ref(false)

const canFilterTeammates = computed(() =>
  isPlayerInAllGames(_allGames.value, currentPuuid.value),
)

const disableTeammatesReason = computed(() => {
  if (!currentPuuid.value) return '未检测到登录玩家'
  if (_allGames.value.length === 0) return '无对局数据'
  return '部分对局不属于当前登录玩家，无法使用只看队友'
})

const analysisGames = computed<GameRecord[]>(() => {
  if (!onlyTeammates.value || !currentPuuid.value || !canFilterTeammates.value) return _allGames.value
  return filterToPlayerTeam(_allGames.value, currentPuuid.value)
})

const selectedMetric = ref<string | null>(null)
const currentMode = ref<string>('')

const modeDisplayName = computed(() => {
  if (!currentMode.value) return ''
  return getModeAnalysisConfig(currentMode.value).displayName || currentMode.value
})

const basicDataCollapsed = ref(false)
const advancedDataCollapsed = ref(true)

function selectMetric(key: string) {
  selectedMetric.value = selectedMetric.value === key ? null : key
}

const basicMetrics = computed<MetricDef[]>(() => {
  if (!currentMode.value) return []
  return getModeAnalysisConfig(currentMode.value).basicMetrics
})

const advancedMetrics = computed<MetricDef[]>(() => {
  if (!currentMode.value) return []
  return getModeAnalysisConfig(currentMode.value).advancedMetrics
})

function isAdvancedMetric(key: string | null): boolean {
  return advancedMetrics.value.some((c) => c.key === key)
}

const selectedCategory = computed(() =>
  basicMetrics.value.find((c) => c.key === selectedMetric.value)
  || advancedMetrics.value.find((c) => c.key === selectedMetric.value)
  || null
)

const metricRanking = computed<MetricRankEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value) return []
  return computeMetricRanking(games, selectedCategory.value.getter)
})

const maxMetricValue = computed(() => {
  if (metricRanking.value.length === 0) return { total: 1, average: 1 }
  return {
    total: Math.max(...metricRanking.value.map(r => r.total), 1),
    average: Math.max(...metricRanking.value.map(r => r.average), 1),
  }
})

const advancedMetricRanking = computed<MetricRankEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value || !isAdvancedMetric(selectedMetric.value)) return []
  const key = selectedMetric.value
  if (!key) return []
  return computeAdvancedMetricRanking(
    games,
    key,
    id => gds.champions[id]?.roles || [],
    getRoleName,
    selectedCategory.value.getter,
  )
})

const maxAdvMetricValue = computed(() => {
  if (advancedMetricRanking.value.length === 0) return 1
  return Math.max(...advancedMetricRanking.value.map(r => r.total), 1)
})

const firstPlaceTitle = computed(() => {
  if (!selectedMetric.value || !currentMode.value) return ''
  const cfg = getModeAnalysisConfig(currentMode.value)
  return cfg.podiumTitles[selectedMetric.value] || ''
})

const advancedBestTitle = computed(() => {
  if (!selectedMetric.value || !currentMode.value) return '最佳'
  const cfg = getModeAnalysisConfig(currentMode.value)
  return cfg.advancedBestTitles[selectedMetric.value] || '最佳'
})

const advancedWorstTitle = computed(() => {
  if (!selectedMetric.value || !currentMode.value) return '最末'
  const cfg = getModeAnalysisConfig(currentMode.value)
  return cfg.advancedWorstTitles[selectedMetric.value] || '最末'
})

const tableMaxHeight = computed(() => {
  const count = selectedMetric.value && isAdvancedMetric(selectedMetric.value)
    ? advancedMetricRanking.value.length
    : metricRanking.value.length
  return computeTableMaxHeight(count)
})

const metricPodium = computed<PodiumEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value) return []
  const cat = selectedCategory.value
  const aggMap = buildPlayerAggMap(games)
  return computePodium(games, aggMap, cat.getter, cat.fmt)
})

const globalItemFreq = computed(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computeGlobalItemFreq(
    games,
    isBuildItem,
    id => gds.items[id]?.name || `装备#${id}`,
    id => gds.items[id]?.iconPath || '',
  )
})

const playerFavoriteItems = computed<PlayerFavItem[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computePlayerFavoriteItems(
    games,
    isBuildItem,
    id => gds.items[id]?.name || '',
    id => gds.items[id]?.iconPath || '',
  )
})

const playerChampionPools = computed<PlayerChampionPool[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computePlayerChampionPools(games)
})

const globalChampionFreq = computed<GlobalChampFreq[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computeGlobalChampionFreq(games, id => gds.champions[id]?.name || `英雄#${id}`)
})

function getChampionUsers(championId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
  return getChampionUsersPure(games, championId)
}

const globalAugmentFreq = computed(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computeGlobalAugmentFreq(
    games,
    id => gds.augments[id]?.nameTRA || `海克斯#${id}`,
    id => gds.augments[id]?.augmentSmallIconPath || '',
    id => gds.augments[id]?.rarity || '',
  )
})

const playerFavoriteAugments = computed<PlayerFavAug[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []
  return computePlayerFavoriteAugments(
    games,
    id => gds.augments[id]?.nameTRA || '',
    id => gds.augments[id]?.augmentSmallIconPath || '',
    id => gds.augments[id]?.rarity || '',
  )
})

const sortedPlayerFavoriteAugments = computed(() =>
  sortPlayerAugmentsByFreq(playerFavoriteAugments.value)
)

function getAugmentUsers(augId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
  return getAugmentUsersPure(games, augId)
}

function getItemUsers(itemId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
  return getItemUsersPure(games, itemId, isBuildItem)
}

async function loadAnalysis() {
  const gameIds = bridge.consume()
  if (!gameIds || !gameIds.length) return

  console.log(`[LCU:ANALYSIS] 开始分析: ${gameIds.length} 场对局, ids=${gameIds.join(',')}`)
  selectedMetric.value = null
  loading.value = true
  try {
    const report = await analyzeSelectedGames(createMatchRepository(window.lcuApi), gameIds)
    console.log(`[LCU:ANALYSIS] 对局数据拉取完成: ${report.games.length} 场`)

    currentMode.value = report.currentMode
    if (report.currentMode) {
      const cfg = getModeAnalysisConfig(report.currentMode)
      console.log(`[LCU:ANALYSIS] 检测到模式: ${cfg.displayName} (${report.currentMode})`)
    }

    result.value = report.result
    _allGames.value = report.games
  } catch (e: unknown) {
    message.error(`分析失败: ${errMsg(e)}`)
  } finally {
    loading.value = false
  }
}

onActivated(async () => {
  if (!currentPuuid.value) {
    const { summoner } = await initializeSession(createSessionRepository(window.lcuApi))
    if (summoner) currentPuuid.value = summoner.puuid
  }
  await loadAnalysis()
})
</script>

<style scoped>
.analysis-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
}

.empty-state h3 {
  color: var(--text-secondary);
}

.analysis-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.metric-detail {
  flex: 1;
  overflow: hidden;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
}

.no-selection p {
  font-size: 14px;
}

.no-selection .sub {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
