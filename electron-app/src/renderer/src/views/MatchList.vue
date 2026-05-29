<template>
  <div class="match-list-page">
    <!-- 空状态 / 加载中 -->
    <div v-if="!listData && !loading" class="empty-state">
      <div class="empty-content">
        <n-icon size="64" color="rgba(255,255,255,0.1)">
          <cloud-download-outline />
        </n-icon>
        <h3>等待 LOL 客户端连接</h3>
        <p>应用启动后会自动检测并加载对局数据</p>
        <n-button @click="refreshData()" type="primary" size="large" :loading="loading">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          手动加载
        </n-button>
      </div>
    </div>

    <div v-if="loading && !listData" class="empty-state">
      <n-spin size="large" />
      <p style="margin-top:16px; color: rgba(255,255,255,0.4)">正在从 LCU 拉取对局数据...</p>
    </div>

    <!-- 有数据 -->
    <template v-if="listData">
      <!-- 召唤师信息栏 -->
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

      <!-- 双栏内容区 -->
      <div class="main-content">
        <!-- 左侧面板 -->
        <div class="left-panel">
          <!-- 分页控件 — 对标 LeagueAkari 放在同一组件内 -->
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

          <!-- 统计面板 -->
          <MatchStatsPanel
            :current-page="currentPage"
            :total-games="listData.totalGames"
            :page-size="pageSize"
            :games="currentPageGames"
            :self-puuid="listData.summoner.puuid"
            :loading="loading"
          />
        </div>

        <!-- 右侧卡片列表 -->
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NInputNumber,
  NSelect,
  NIcon,
  NSpin,
  useMessage,
} from 'naive-ui'
import {
  CloudDownloadOutline,
  RefreshOutline,
  AnalyticsOutline,
} from '@vicons/ionicons5'
import type { MatchListData } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import MatchHistoryCard from '@/components/match-history/MatchHistoryCard.vue'
import MatchStatsPanel from '@/components/match-history/MatchStatsPanel.vue'
import LcuImage from '@/components/widgets/LcuImage.vue'

const router = useRouter()
const message = useMessage()
const gds = useGameDataStore()

const listData = ref<MatchListData | null>(null)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const checkedRowKeys = ref<number[]>([])
const inputtingPage = ref(1)

const pageSizeOptions = [10, 20, 30, 50].map(n => ({ label: `${n} 条/页`, value: n }))

// 对标 LeagueAkari: currentPage 变化时同步到输入框
watch(currentPage, (p) => {
  inputtingPage.value = p
})

/**
 * 从对局数据中获取正确的游戏内名称（修复 TENCENT 服 displayName 映射问题）
 * 优先使用参与者的 gameName#tagLine，其次用 LCU summoner name，最后用 PUUID 前缀
 */
const displayName = computed(() => {
  if (!listData.value) return '---'
  // 从第一局对局的参与者数据中匹配当前玩家的 PUUID，获取真实游戏内名称
  const g = listData.value.games[0]
  if (g) {
    const allParticipants = [...g.blueParticipants, ...g.redParticipants]
    const self = allParticipants.find(p => p.puuid === listData.value!.summoner.puuid)
    if (self && self.gameName) {
      return self.tagLine ? `${self.gameName}#${self.tagLine}` : self.gameName
    }
  }
  return listData.value.summoner.name || listData.value.summoner.puuid.slice(0, 16) + '...'
})

/** 总页数 */
const totalPages = computed(() => {
  if (!listData.value) return 1
  return Math.max(1, Math.ceil(listData.value.totalGames / pageSize.value))
})

/** 当前页的对局列表（前端切片） */
const currentPageGames = computed(() => {
  if (!listData.value) return []
  const start = (currentPage.value - 1) * pageSize.value
  return listData.value.games.slice(start, start + pageSize.value)
})

/** 是否还有下一页 */
const hasNextPage = computed(() => {
  return currentPage.value < totalPages.value
})

/**
 * 翻页 — 纯前端切片，不调用 API
 * 仅在请求的页码超出已加载范围时才重新拉取
 */
async function loadPage(page: number) {
  if (page < 1 || page > totalPages.value) {
    console.log(`[LCU:MATCHLIST] 忽略无效页码: ${page} (总页数: ${totalPages.value})`)
    return
  }
  if (page === currentPage.value) {
    console.log(`[LCU:MATCHLIST] 已在第 ${page} 页，无需翻页`)
    return
  }
  console.log(`[LCU:MATCHLIST] 翻页: ${currentPage.value} → ${page} (前端分页)` + `, 已选中 ${checkedRowKeys.value.length} 场`)
  currentPage.value = page
}

/**
 * 从 LCU API 重新拉取对局数据（初始加载 / 手动刷新）
 * 一次拉取最多 100 场，后续翻页纯前端完成
 * 失败后有 3 秒冷却期防止用户狂点刷屏
 */
let _retryCooldown = 0
async function refreshData() {
  if (loading.value) {
    console.log('[LCU:MATCHLIST] refreshData 跳过（正在加载中）')
    return
  }
  // 失败后冷却检查，防止短时间重复请求
  if (Date.now() - _retryCooldown < 3000) {
    console.log('[LCU:MATCHLIST] refreshData 跳过（失败冷却中）')
    return
  }
  console.log('[LCU:MATCHLIST] refreshData 开始拉取数据...')
  message.info('正在从 LCU 拉取对局数据...')
  loading.value = true
  try {
    listData.value = await window.lcuApi.fetchMatchList(1, pageSize.value)
    currentPage.value = 1
    checkedRowKeys.value = []
    _retryCooldown = 0 // 成功后重置冷却
    console.log(`[LCU:MATCHLIST] refreshData 完成: ${listData.value.games.length} 场已加载, total=${listData.value.totalGames}`)
    message.success(`加载完成：已缓存 ${listData.value.games.length} 场对局 (总共 ${listData.value.totalGames} 场)，共 ${totalPages.value} 页`)
  } catch (e: any) {
    console.error(`[LCU:MATCHLIST] refreshData 失败: ${e.message || e}`, e)
    message.error(`加载失败: ${e.message || e}`)
    _retryCooldown = Date.now()
  } finally {
    loading.value = false
  }
}

/** 每页条数变更 — 纯前端，仅改 pageSize 并回到第 1 页 */
function handlePageSizeChange(v: number) {
  console.log(`[LCU:MATCHLIST] 切换每页条数: ${pageSize.value} → ${v}`)
  pageSize.value = v
  currentPage.value = 1
  checkedRowKeys.value = []
}

/** 切换单场对局的选中状态 */
function toggleGame(gameId: number) {
  const idx = checkedRowKeys.value.indexOf(gameId)
  if (idx === -1) {
    checkedRowKeys.value = [...checkedRowKeys.value, gameId]
    console.log(`[LCU:MATCHLIST] 选中对局 #${gameId}（共 ${checkedRowKeys.value.length} 场选中）`)
  } else {
    checkedRowKeys.value = checkedRowKeys.value.filter(id => id !== gameId)
    console.log(`[LCU:MATCHLIST] 取消选中 #${gameId}（共 ${checkedRowKeys.value.length} 场选中）`)
  }
}

function goToAnalysis() {
  if (checkedRowKeys.value.length === 0) return
  console.log(`[LCU:MATCHLIST] 进入数据分析: ${checkedRowKeys.value.length} 场选中, ids=${checkedRowKeys.value.join(',')}`)
  sessionStorage.setItem('analysisGameIds', JSON.stringify(checkedRowKeys.value))
  router.push({ name: 'analysis' })
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none'
}

// 每 60 秒更新相对时间（触发组件 computed 重新计算）
const _relativeTimer = ref(0)
let _timerHandle: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  console.log('[LCU:MATCHLIST] 组件已挂载')
  if (typeof window.lcuApi === 'undefined') {
    console.warn('[LCU:MATCHLIST] window.lcuApi 未定义，preload 可能未执行')
    return
  }
  console.log('[LCU:MATCHLIST] window.lcuApi 已就绪，开始检查连接...')
  try {
    const conn = await window.lcuApi.checkConnection()
    console.log(`[LCU:MATCHLIST] checkConnection 结果: ${conn ? `port=${conn.port}` : 'null（未找到 LCU）'}`)
    if (conn) {
      // 先拉取游戏基础数据，再加载对局列表
      console.log('[LCU:MATCHLIST] 开始拉取游戏数据...')
      try {
        await gds.fetchGameData()
        console.log('[LCU:MATCHLIST] 游戏数据拉取完成')
      } catch (err: any) {
        console.warn(`[LCU:MATCHLIST] 游戏数据拉取失败（不阻塞）: ${err.message || err}`)
      }
      // 开始加载对局列表前检查 loading 状态（防止被外部触发导致重复加载）
      if (loading.value) {
        console.log('[LCU:MATCHLIST] 跳过重复加载（已有正在进行的请求）')
        return
      }
      console.log('[LCU:MATCHLIST] 开始加载对局数据...')
      await refreshData()
      console.log(`[LCU:MATCHLIST] 对局数据加载完成: ${listData.value?.games?.length || 0} 场`)
    } else {
      console.log('[LCU:MATCHLIST] 未连接 LCU，显示空状态')
    }
  } catch (err: any) {
    console.error(`[LCU:MATCHLIST] onMounted 异常: ${err.message || err}`, err)
  }
})

onUnmounted(() => {
  if (_timerHandle) {
    clearInterval(_timerHandle)
    _timerHandle = null
  }
})
</script>

<style lang="less" scoped>
@container-width: 1100px;

.match-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  text-align: center;
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

/* ── 召唤师信息栏 ── */
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

/* ── 双栏主内容区 ── */
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

/* ── 左侧分页控件 ── */
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

  > :first-child {
    min-width: 60px;
  }
  > :last-child {
    flex-shrink: 0;
  }
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

/* TransitionGroup 动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
