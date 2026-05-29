<template>
  <div class="pgl-root">
    <!-- 等待连接 -->
    <div v-if="!puuid && !loading" class="empty-state">
      <div class="empty-content">
        <n-icon size="64" color="rgba(255,255,255,0.1)">
          <cloud-download-outline />
        </n-icon>
        <h3>等待 LOL 客户端连接</h3>
        <p>应用启动后会自动检测并加载对局数据</p>
        <n-button @click="refreshData()" type="primary" size="large" :loading="loading" :disabled="!puuid">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          手动加载
        </n-button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !listData" class="empty-state">
      <n-spin size="large" />
      <p style="margin-top:16px; color: rgba(255,255,255,0.4)">正在加载对局数据...</p>
    </div>

    <!-- 未加载（有 puuid 但未请求） -->
    <div v-if="!listData && !loading && puuid" class="empty-state">
      <div class="empty-content">
        <n-icon size="48" color="rgba(255,255,255,0.08)">
          <person-outline />
        </n-icon>
        <h3>{{ displayName }}</h3>
        <n-button @click="refreshData()" type="primary" size="large" :loading="loading">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          加载对局数据
        </n-button>
      </div>
    </div>

    <!-- 有数据 -->
    <template v-if="listData">
      <div class="summoner-bar">
        <div class="summoner-info">
          <LcuImage
            class="profile-img"
            :src="`/lol-game-data/assets/v1/profile-icons/${listData.summoner.profileIconId || 0}.jpg`"
            :size="40"
          />
          <span class="summoner-name">{{ displayName }}</span>
        </div>
        <div class="summoner-actions">
          <span class="meta-text">共 {{ listData.totalGames }} 场对局</span>
          <n-button
            v-if="checkedRowKeys.length > 0"
            type="primary"
            size="small"
            @click="goToAnalysis"
          >
            <template #icon><n-icon><analytics-outline /></n-icon></template>
            分析选中的 {{ checkedRowKeys.length }} 场对局
          </n-button>
          <n-button size="small" @click="refreshData()" :loading="loading" tertiary>
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
        </div>
      </div>

      <div class="main-content">
        <div class="left-panel">
          <div class="section">
            <div class="section-title">分页（共 {{ totalPages }} 页）</div>
            <div class="pagination-row">
              <n-input-number
                size="small"
                style="flex:1; min-width:0"
                v-model:value="inputtingPage"
                @blur="inputtingPage = currentPage"
                @keyup.enter="loadPage(inputtingPage || 1)"
                :min="1"
                :max="totalPages"
                :show-button="false"
                :disabled="loading"
              />
              <button
                class="pagination-btn"
                :disabled="currentPage <= 1 || loading"
                @click="loadPage(currentPage - 1)"
              >上一页</button>
              <button
                class="pagination-btn"
                :disabled="loading || !hasNextPage"
                @click="loadPage(currentPage + 1)"
              >下一页</button>
              <n-select
                size="small"
                style="width:86px"
                :value="pageSize"
                @update:value="handlePageSizeChange"
                :options="pageSizeOptions"
                :consistent-menu-width="false"
              />
            </div>
          </div>

          <MatchStatsPanel
            :current-page="currentPage"
            :total-games="listData.totalGames"
            :page-size="pageSize"
            :games="currentPageGames"
            :self-puuid="listData.summoner.puuid"
            :loading="loading"
          />
        </div>

        <div class="right-panel">
          <div v-if="currentPageGames.length === 0" class="empty-card-state">
            <span>无对局数据</span>
          </div>
          <TransitionGroup name="list" tag="div" v-else>
            <MatchHistoryCard
              v-for="g in currentPageGames"
              :key="g.gameId"
              :game="g"
              :self-puuid="listData.summoner.puuid"
              :selected="checkedRowKeys.includes(g.gameId)"
              @toggle-select="() => toggleGame(g.gameId)"
            />
          </TransitionGroup>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NInputNumber, NSelect, NIcon, NSpin, useMessage,
} from 'naive-ui'
import {
  CloudDownloadOutline, RefreshOutline, AnalyticsOutline, PersonOutline,
} from '@vicons/ionicons5'
import type { MatchListData } from '@shared/types'
import { useTabStore } from '@/stores/tab'
import MatchHistoryCard from '@/components/match-history/MatchHistoryCard.vue'
import MatchStatsPanel from '@/components/match-history/MatchStatsPanel.vue'
import LcuImage from '@/components/widgets/LcuImage.vue'

const props = defineProps<{
  puuid: string
  name: string
  profileIconId: number
  summonerLevel: number
}>()

const router = useRouter()
const message = useMessage()
const tabStore = useTabStore()

const listData = ref<MatchListData | null>(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const checkedRowKeys = ref<number[]>([])
const inputtingPage = ref(1)

const pageSizeOptions = [10, 20, 30, 50].map(n => ({ label: `${n} 条/页`, value: n }))

watch(currentPage, (p) => { inputtingPage.value = p })

const displayName = computed(() => props.name || '---')

const totalPages = computed(() => {
  if (!listData.value) return 1
  return Math.max(1, Math.ceil(listData.value.totalGames / pageSize.value))
})

const currentPageGames = computed(() => {
  if (!listData.value) return []
  const start = (currentPage.value - 1) * pageSize.value
  return listData.value.games.slice(start, start + pageSize.value)
})

const hasNextPage = computed(() => currentPage.value < totalPages.value)

function loadPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  if (page === currentPage.value) return
  currentPage.value = page
}

let _retryCooldown = 0
async function refreshData() {
  if (loading.value) return
  if (!props.puuid) return
  if (Date.now() - _retryCooldown < 3000) return
  loading.value = true
  try {
    listData.value = await window.lcuApi.fetchPlayerMatchList(
      props.puuid, props.name, props.profileIconId, props.summonerLevel,
      1, pageSize.value
    )
    currentPage.value = 1
    checkedRowKeys.value = []
    _retryCooldown = 0
    const s = listData.value.summoner
    const tab = tabStore.tabs.find(t => t.puuid === s.puuid)
    if (tab) {
      tab.name = s.name || displayName.value
      tab.profileIconId = s.profileIconId
      tab.summonerLevel = s.level
    }
    message.success(`${displayName.value} — ${listData.value.totalGames} 场对局`)
  } catch (e: any) {
    message.error(`加载失败: ${e.message || e}`)
    _retryCooldown = Date.now()
  } finally {
    loading.value = false
  }
}

function handlePageSizeChange(v: number) {
  pageSize.value = v
  currentPage.value = 1
  checkedRowKeys.value = []
}

function toggleGame(gameId: number) {
  const idx = checkedRowKeys.value.indexOf(gameId)
  if (idx === -1) {
    checkedRowKeys.value = [...checkedRowKeys.value, gameId]
  } else {
    checkedRowKeys.value = checkedRowKeys.value.filter(id => id !== gameId)
  }
}

function goToAnalysis() {
  if (checkedRowKeys.value.length === 0) return
  sessionStorage.setItem('analysisGameIds', JSON.stringify(checkedRowKeys.value))
  router.push({ name: 'analysis' })
}

// 当 puuid 从空变为有效值时，自动加载数据
watch(() => props.puuid, (newPuuid) => {
  if (newPuuid && !listData.value && !loading.value) {
    refreshData()
  }
})

onMounted(async () => {
  if (props.puuid && !loading.value) {
    await refreshData()
  }
})
</script>

<style lang="less" scoped>
@container-width: 1100px;

.pgl-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  h3 {
    margin: 16px 0 8px;
    color: var(--text-secondary);
  }
  p {
    margin-bottom: 24px;
    font-size: 14px;
    line-height: 1.6;
  }
}

.empty-content {
  text-align: center;
}

.summoner-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  flex-shrink: 0;
  padding: 0 20px;
  margin: 0 auto;
  width: @container-width;
  box-sizing: border-box;
}

.summoner-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: var(--bg-hover);
  flex-shrink: 0;
}

.summoner-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.summoner-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meta-text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.main-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  width: @container-width;
  margin: 0 auto;
  padding: 12px 0 0 0;
}

.left-panel {
  flex: 1;
  min-width: 240px;
  max-width: 320px;
  overflow-y: auto;
  padding: 0 12px 12px 20px;
}

.right-panel {
  overflow-y: auto;
  padding: 0 20px 12px 12px;
}

.empty-card-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  width: 740px;
  color: var(--text-muted);
  background-color: var(--bg-card);
  border-radius: 4px;
}

.section {
  padding: 8px 16px;
  background-color: var(--section-color);
  border-radius: 4px;
  margin-bottom: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.pagination-row {
  display: flex;
  gap: 4px;
  > :first-child { min-width: 60px; }
  > :last-child { flex-shrink: 0; }
}

.pagination-btn {
  padding: 0 8px;
  height: 28px;
  font-size: 13px;
  border: 1px solid var(--btn-border);
  border-radius: 3px;
  background: var(--btn-bg);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
