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
          <span class="meta-text">共 {{ filteredTotalCount }} 场对局</span>
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
          <div class="mode-filter-section">
            <n-select
              size="small"
              :value="modeFilter"
              @update:value="onModeFilterChange"
              :options="modeOptions"
              :consistent-menu-width="false"
            />
          </div>
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
            :total-games="filteredTotalCount"
            :page-size="pageSize"
            :games="currentPageGames"
            :self-puuid="listData.summoner.puuid"
            :loading="loading"
          />
        </div>

        <div
          class="right-panel"
          @mousemove="onPanelMouseMove"
          @mouseup="onDragEnd"
          @mouseleave="onDragEnd"
        >
          <div v-if="currentPageGames.length === 0" class="empty-card-state">
            <span>无对局数据</span>
          </div>
          <TransitionGroup
            v-else
            name="list"
            tag="div"
            @mousedown="onCardMouseDown"
          >
            <MatchHistoryCard
              v-for="(g, idx) in currentPageGames"
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
import { computed, inject, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NInputNumber, NSelect, NIcon, NSpin, useMessage, useDialog,
} from 'naive-ui'
import {
  CloudDownloadOutline, RefreshOutline, AnalyticsOutline, PersonOutline,
} from '@vicons/ionicons5'
import type { MatchListData } from '@shared/types'
import { getGameModeName, getQueueName } from '@shared/utils/mappings'
import { useTabStore } from '@/stores/tab'
import { useGameDataStore } from '@/stores/game-data'
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
const dialog = useDialog()
const tabStore = useTabStore()
const gds = useGameDataStore()

const listData = ref<MatchListData | null>(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const checkedRowKeys = ref<number[]>([])
const inputtingPage = ref(1)

const pageSizeOptions = [10, 20, 30, 50].map(n => ({ label: `${n} 条/页`, value: n }))

/** 模式筛选 */
const modeFilter = ref('__all__')

/** 将 game 映射为统一的模式显示名（与 MatchHistoryCard 的 formattedModeText 保持一致） */
function gameModeLabel(g: { gameMode: string; queueId: number; gameType?: string }): string {
  if (g.gameMode === 'PRACTICETOOL') return '训练模式'
  const modeName = getGameModeName(g.gameMode)
  let base = modeName !== g.gameMode ? modeName : getQueueName(g.queueId, gds.queues)
  if (g.gameType === 'CUSTOM_GAME') base += '（自定义）'
  return base
}

/** 从已加载对局中提取不同模式列表，按出现频次降序 */
const modeOptions = computed(() => {
  if (!listData.value) return [{ label: '全部', value: '__all__' }]
  const countMap = new Map<string, number>()
  for (const g of listData.value.games) {
    const label = gameModeLabel(g)
    countMap.set(label, (countMap.get(label) || 0) + 1)
  }
  const options = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label: `${label} (${count})`, value: label }))
  return [{ label: '全部', value: '__all__' }, ...options]
})

/** 按模式筛选后的对局 */
const filteredGames = computed(() => {
  if (!listData.value) return []
  if (modeFilter.value === '__all__') return listData.value.games
  return listData.value.games.filter(g => gameModeLabel(g) === modeFilter.value)
})

/** 筛选后的总数 */
const filteredTotalCount = computed(() => {
  if (modeFilter.value === '__all__') return listData.value?.totalGames ?? 0
  return filteredGames.value.length
})

watch(currentPage, (p) => { inputtingPage.value = p })

const displayName = computed(() => props.name || '---')

const totalPages = computed(() => {
  if (!listData.value) return 1
  const total = modeFilter.value === '__all__'
    ? listData.value.totalGames
    : filteredGames.value.length
  return Math.max(1, Math.ceil(total / pageSize.value))
})

const currentPageGames = computed(() => {
  if (!listData.value) return []
  const src = filteredGames.value
  const start = (currentPage.value - 1) * pageSize.value
  return src.slice(start, start + pageSize.value)
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

function onModeFilterChange(v: string) {
  modeFilter.value = v
  currentPage.value = 1
  checkedRowKeys.value = []
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

/** 拖拽框选状态 */
const dragState = ref<{ anchorIndex: number; mode: 'select' | 'deselect' } | null>(null)

function applyRange(fromIdx: number, toIdx: number, mode: 'select' | 'deselect') {
  const start = Math.min(fromIdx, toIdx)
  const end = Math.max(fromIdx, toIdx)
  const rangeIds = new Set(
    currentPageGames.value.slice(start, end + 1).map(g => g.gameId)
  )
  if (mode === 'select') {
    const merged = new Set(checkedRowKeys.value)
    for (const id of rangeIds) merged.add(id)
    checkedRowKeys.value = Array.from(merged)
  } else {
    checkedRowKeys.value = checkedRowKeys.value.filter(id => !rangeIds.has(id))
  }
}

function onCardMouseDown(event: MouseEvent) {
  const card = (event.target as HTMLElement).closest('[data-game-id]') as HTMLElement | null
  if (!card) return
  const gameId = Number(card.dataset.gameId)
  const idx = currentPageGames.value.findIndex(g => g.gameId === gameId)
  if (idx === -1) return

  const wasSelected = checkedRowKeys.value.includes(gameId)
  const mode: 'select' | 'deselect' = wasSelected ? 'deselect' : 'select'

  // 如果点在 checkbox 区域内，checkbox 自身的 click 事件会处理 toggle，这里不重复调用
  if (!(event.target as HTMLElement).closest('.zone-checkbox')) {
    toggleGame(gameId)
  }

  dragState.value = { anchorIndex: idx, mode }
}

function onPanelMouseMove(event: MouseEvent) {
  if (!dragState.value) return
  const card = (event.target as HTMLElement).closest('[data-game-id]') as HTMLElement | null
  if (!card) return
  const gameId = Number(card.dataset.gameId)
  const idx = currentPageGames.value.findIndex(g => g.gameId === gameId)
  if (idx === -1 || idx === dragState.value.anchorIndex) return

  const anchor = dragState.value.anchorIndex
  if (idx > anchor) {
    applyRange(anchor + 1, idx, dragState.value.mode)
  } else {
    applyRange(idx, anchor - 1, dragState.value.mode)
  }
}

function onDragEnd() {
  dragState.value = null
}

function goToAnalysis() {
  if (checkedRowKeys.value.length === 0) return

  // 检查选中的对局是否属于同一模式
  if (listData.value) {
    const idSet = new Set(checkedRowKeys.value)
    const selectedGames = listData.value.games.filter(g => idSet.has(g.gameId))
    const modes = new Set(selectedGames.map(g => g.gameMode))
    if (modes.size > 1) {
      const modeNames = Array.from(modes)
        .map(m => gameModeLabel({ gameMode: m, queueId: 0 }))
      dialog.warning({
        title: '模式不一致',
        content: `选中的 ${selectedGames.length} 场对局包含不同模式（${modeNames.join('、')}）。分析不同模式的对局会导致统计数据失真，请仅选择同一模式的对局。`,
        positiveText: '知道了',
      })
      return
    }
  }

  sessionStorage.setItem('analysisGameIds', JSON.stringify(checkedRowKeys.value))
  sessionStorage.setItem('analysisShouldRecalculate', 'true')
  router.push({ name: 'analysis' })
}

// 当 puuid 从空变为有效值时，自动加载数据
watch(() => props.puuid, (newPuuid) => {
  if (newPuuid && !listData.value && !loading.value) {
    refreshData()
  }
})

// 标题栏刷新按钮 → 全局刷新所有标签页
const refreshStamp = inject<Ref<number>>('refreshStamp', ref(0))
let _localStamp = 0
watch(refreshStamp, (val) => {
  if (val > _localStamp) {
    _localStamp = val
    refreshData()
  }
})

onMounted(async () => {
  if (props.puuid && !loading.value) {
    await refreshData()
  }
  window.addEventListener('mouseup', onDragEnd)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onDragEnd)
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

.mode-filter-section {
  margin-bottom: 8px;
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
