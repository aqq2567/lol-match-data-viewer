<template>
  <div class="friend-page">
    <!-- 加载中 -->
    <div v-if="loading" class="empty-state">
      <n-spin size="large" />
      <p>正在分析好友数据...</p>
    </div>

    <!-- 未连接 LCU -->
    <div v-else-if="!connected" class="empty-state">
      <n-icon size="48" color="rgba(255,255,255,0.1)">
        <people-outline />
      </n-icon>
      <h3>未连接 LCU</h3>
      <p>请先启动英雄联盟客户端</p>
    </div>

    <!-- 无数据 -->
    <div v-else-if="!friends.length && !errorMsg" class="empty-state">
      <n-icon size="48" color="rgba(255,255,255,0.1)">
        <people-outline />
      </n-icon>
      <h3>暂无好友数据</h3>
      <p>对局数量不足，或尚未与任何人一起玩超过 2 场</p>
    </div>

    <!-- 错误 -->
    <div v-else-if="errorMsg" class="empty-state">
      <h3>加载失败</h3>
      <p>{{ errorMsg }}</p>
      <n-button @click="loadData()">重试</n-button>
    </div>

    <template v-else>
      <FriendHeader
        :summary="summary"
        :loading="loading"
        @back="$router.push({ name: 'match-list' })"
        @refresh="loadData()"
      />

      <div class="friend-body">
        <FriendMetricSidebar
          :metrics="friendMetrics"
          :selected-metric="selectedMetric"
          :collapsed="basicCollapsed"
          @select-metric="selectMetric"
          @update:collapsed="basicCollapsed = $event"
        />

        <div class="metric-detail">
          <!-- 未选择时的占位 -->
          <div v-if="!selectedMetric" class="no-selection">
            <n-icon size="48" color="rgba(255,255,255,0.08)">
              <people-outline />
            </n-icon>
            <p>请从左侧选择一个数据指标</p>
            <p class="sub">选择后将展示该指标的好友排名与领奖台</p>
          </div>

          <template v-else>
            <!-- 该指标门槛太高，无人达标 -->
            <div v-if="!sortedByMetric.length" class="no-selection">
              <p>暂无好友达到「{{ selectedCategory?.label }}」的最低场次要求 ({{ selectedCategory?.minGames }} 场)</p>
              <p class="sub">尝试选择其他指标，或多打几局后再来查看</p>
            </div>

            <FriendPodium
              v-else
              :podium="friendPodium"
              :selected-category="selectedCategory"
              :selected-metric="selectedMetric"
              :first-place-title="firstPlaceTitle"
              :is-item-metric="isItemMetric"
            />

            <FriendRankingTable
              v-if="sortedByMetric.length"
              :sorted-by-metric="sortedByMetric"
              :selected-category="selectedCategory"
              :selected-metric="selectedMetric"
              :is-item-metric="isItemMetric"
              :theme-key="themeStore.isDark ? 1 : 0"
            />
          </template>
        </div>
      </div>
      <div class="dev-watermark">本功能正在开发中...可能存在问题OvO</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NIcon, NSpin } from 'naive-ui'
import { PeopleOutline } from '@vicons/ionicons5'
import type { MatchListData } from '@shared/types'
import type { FriendPodiumEntry, FriendStats, FriendSummary } from '@domain/analysis/types'
import { getPlayerDisplayName } from '@shared/utils/mappings'
import { loadFriendAnalysis, analyzeFriends, computeFriendSummary, FRIEND_METRICS, computeSortedByMetric, computeFriendPodium, getFirstPlaceTitle } from '@application/friend-service'
import { createMatchRepository } from '@application/ports'
import { useThemeStore } from '@/stores/theme'
import FriendHeader from '@/components/analysis/FriendHeader.vue'
import FriendMetricSidebar from '@/components/analysis/FriendMetricSidebar.vue'
import FriendPodium from '@/components/analysis/FriendPodium.vue'
import FriendRankingTable from '@/components/analysis/FriendRankingTable.vue'

const themeStore = useThemeStore()

const loading = ref(false)
const connected = ref(true)
const errorMsg = ref('')

const matchData = ref<MatchListData | null>(null)

const basicCollapsed = ref(false)
const selectedMetric = ref<string | null>(null)

function selectMetric(key: string) {
  selectedMetric.value = selectedMetric.value === key ? null : key
}

const friends = computed<FriendStats[]>(() => {
  if (!matchData.value) return []
  return analyzeFriends(matchData.value.games, matchData.value.summoner.puuid, getPlayerDisplayName)
})

const summary = computed<FriendSummary>(() => {
  if (!matchData.value) {
    return { totalFriends: 0, mostPlayed: null, bestWinRate: null, totalGames: 0, bestCollector: null, bestHeartsteel: null }
  }
  return computeFriendSummary(friends.value, matchData.value.games.length)
})

const friendMetrics = FRIEND_METRICS

const selectedCategory = computed(() =>
  friendMetrics.find((m) => m.key === selectedMetric.value) || null
)

const sortedByMetric = computed<FriendStats[]>(() =>
  computeSortedByMetric(friends.value, selectedCategory.value)
)

const friendPodium = computed<FriendPodiumEntry[]>(() => {
  if (!selectedCategory.value) return []
  return computeFriendPodium(sortedByMetric.value, selectedCategory.value)
})

const firstPlaceTitle = computed(() =>
  getFirstPlaceTitle(selectedMetric.value)
)

const isItemMetric = computed(() =>
  selectedMetric.value === 'collectorRatio' || selectedMetric.value === 'heartsteelRatio'
)

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const { matchData: data, participantCount } = await loadFriendAnalysis(createMatchRepository(window.lcuApi))
    matchData.value = data
    console.log(`[LCU:FRIEND] 好友分析加载完成: ${data.games.length} 场 (含队友 ${participantCount} 场), puuid=${data.summoner.puuid.slice(0, 8)}…`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('未连接') || msg.includes('not connected') || msg.includes('LCU')) {
      connected.value = false
    } else {
      errorMsg.value = msg
    }
    console.error(`[LCU:FRIEND] 加载失败: ${msg}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.friend-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

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

.friend-body {
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

.dev-watermark {
  position: fixed;
  right: 12px;
  bottom: 8px;
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.45;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}
</style>
