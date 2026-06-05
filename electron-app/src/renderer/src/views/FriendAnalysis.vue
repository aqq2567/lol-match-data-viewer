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
      <!-- 概览栏 -->
      <div class="friend-header">
        <n-button text @click="$router.push({ name: 'match-list' })" class="back-btn">
          <template #icon><n-icon><arrow-back-outline /></n-icon></template>
          返回列表
        </n-button>
        <div class="header-stats">
          <div class="stat-badge">
            <span class="stat-num">{{ summary.totalFriends }}</span>
            <span class="stat-label">好友数</span>
          </div>
          <div class="stat-badge">
            <span class="stat-num">{{ summary.totalGames }}</span>
            <span class="stat-label">分析局数</span>
          </div>
          <div class="stat-badge" v-if="summary.mostPlayed">
            <span class="stat-num">{{ summary.mostPlayed.count }}</span>
            <span class="stat-label">与 {{ shortName(summary.mostPlayed.name, 10) }} 最多</span>
          </div>
          <div class="stat-badge" v-if="summary.bestWinRate">
            <span class="stat-num win">{{ (summary.bestWinRate.rate * 100).toFixed(0) }}%</span>
            <span class="stat-label">{{ shortName(summary.bestWinRate.name, 10) }} 胜率</span>
          </div>
        </div>
        <n-button size="small" @click="loadData()" :loading="loading">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          刷新
        </n-button>
      </div>

      <!-- 主体：左侧指标列表 + 右侧详情 -->
      <div class="friend-body">
        <!-- 左侧指标列表 -->
        <div class="metric-sidebar">
          <div class="sidebar-title">好友指标</div>
          <div class="category-group">
            <div class="category-header" @click="basicCollapsed = !basicCollapsed">
              <n-icon size="16" class="category-arrow" :class="{ expanded: !basicCollapsed }">
                <chevron-forward-outline />
              </n-icon>
              <span class="category-label">基础数据</span>
              <span class="category-count">{{ friendMetrics.length }}</span>
            </div>
            <div v-show="!basicCollapsed" class="category-items">
              <div
                v-for="m in friendMetrics"
                :key="m.key"
                class="metric-item"
                :class="{ active: selectedMetric === m.key }"
                @click="selectMetric(m.key)"
              >
                <span class="metric-dot" :class="m.colorClass"></span>
                <span class="metric-label">{{ m.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧详情 -->
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

            <!-- 领奖台 -->
            <div v-else class="top-panel">
              <div class="podium-section" v-if="friendPodium.length">
                <h4>{{ selectedCategory?.label }} — 领奖台</h4>
                <div class="podium-row">
                  <!-- 第 2 名 -->
                  <n-popover v-if="friendPodium[1]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-2">
                        <LcuImage :src="profileIconUrl(friendPodium[1].profileIconId)" :size="52" class="spot-avatar" />
                        <div class="spot-name">{{ shortName(friendPodium[1].name, 10) }}</div>
                        <div class="spot-value">{{ friendPodium[1].displayValue }}</div>
                        <div class="spot-stand stand-silver"><span class="spot-rank">2</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <template v-if="isItemMetric">
                        <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? friendPodium[1].collectorGames : friendPodium[1].heartsteelGames }}</b></div>
                        <div class="pop-item">总场次 <b>{{ friendPodium[1].gamesTogether }}</b></div>
                        <div class="pop-item">胜率 <b>{{ rateDisplay(friendPodium[1].winRate) }}</b></div>
                      </template>
                      <template v-else>
                        <div class="pop-item">一起场次 <b>{{ friendPodium[1].gamesTogether }}</b></div>
                        <div class="pop-item">一起胜率 <b>{{ rateDisplay(friendPodium[1].winRate) }}</b></div>
                        <div class="pop-item">个人胜率 <b>{{ rateDisplay(friendPodium[1].soloWinRate) }}</b></div>
                      </template>
                    </div>
                  </n-popover>
                  <!-- 第 1 名 -->
                  <n-popover v-if="friendPodium[0]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-1">
                        <div class="first-crown-wrapper">
                          <div class="crown-glow"></div>
                          <n-icon size="28" color="#e8a840" class="crown-icon">
                            <trophy-outline />
                          </n-icon>
                          <div v-if="firstPlaceTitle" class="first-title-badge">{{ firstPlaceTitle }}</div>
                        </div>
                        <LcuImage :src="profileIconUrl(friendPodium[0].profileIconId)" :size="68" class="spot-avatar spot-avatar-crowned" />
                        <div class="spot-name">{{ shortName(friendPodium[0].name, 10) }}</div>
                        <div class="spot-value spot-value-lg">{{ friendPodium[0].displayValue }}</div>
                        <div class="spot-stand stand-gold"><span class="spot-rank">1</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <template v-if="isItemMetric">
                        <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? friendPodium[0].collectorGames : friendPodium[0].heartsteelGames }}</b></div>
                        <div class="pop-item">总场次 <b>{{ friendPodium[0].gamesTogether }}</b></div>
                        <div class="pop-item">胜率 <b>{{ rateDisplay(friendPodium[0].winRate) }}</b></div>
                      </template>
                      <template v-else>
                        <div class="pop-item">一起场次 <b>{{ friendPodium[0].gamesTogether }}</b></div>
                        <div class="pop-item">一起胜率 <b>{{ rateDisplay(friendPodium[0].winRate) }}</b></div>
                        <div class="pop-item">个人胜率 <b>{{ rateDisplay(friendPodium[0].soloWinRate) }}</b></div>
                      </template>
                    </div>
                  </n-popover>
                  <!-- 第 3 名 -->
                  <n-popover v-if="friendPodium[2]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-3">
                        <LcuImage :src="profileIconUrl(friendPodium[2].profileIconId)" :size="52" class="spot-avatar" />
                        <div class="spot-name">{{ shortName(friendPodium[2].name, 10) }}</div>
                        <div class="spot-value">{{ friendPodium[2].displayValue }}</div>
                        <div class="spot-stand stand-bronze"><span class="spot-rank">3</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <template v-if="isItemMetric">
                        <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? friendPodium[2].collectorGames : friendPodium[2].heartsteelGames }}</b></div>
                        <div class="pop-item">总场次 <b>{{ friendPodium[2].gamesTogether }}</b></div>
                        <div class="pop-item">胜率 <b>{{ rateDisplay(friendPodium[2].winRate) }}</b></div>
                      </template>
                      <template v-else>
                        <div class="pop-item">一起场次 <b>{{ friendPodium[2].gamesTogether }}</b></div>
                        <div class="pop-item">一起胜率 <b>{{ rateDisplay(friendPodium[2].winRate) }}</b></div>
                        <div class="pop-item">个人胜率 <b>{{ rateDisplay(friendPodium[2].soloWinRate) }}</b></div>
                      </template>
                    </div>
                  </n-popover>
                </div>
              </div>
            </div>

            <!-- 好友排名表 -->
            <div class="ranking-section">
              <h4>{{ selectedCategory?.label }} — 好友排名</h4>
              <n-data-table
                :key="'friend-' + themeStore.isDark"
                :columns="friendColumns"
                :data="sortedByMetric"
                :row-key="(row: FriendStats) => row.puuid"
                size="medium"
                striped
                :max-height="tableMaxHeight"
                virtual-scroll
              />
            </div>
          </template>
        </div>
      </div>
      <div class="dev-watermark">本功能正在开发中...可能存在问题OvO</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton, NIcon, NPopover, NSpin, NDataTable
} from 'naive-ui'
import {
  PeopleOutline,
  ArrowBackOutline,
  ChevronForwardOutline,
  RefreshOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import type { MatchListData } from '@shared/types'
import {
  analyzeFriends,
  computeFriendSummary,
  type FriendStats,
  type FriendSummary,
} from '@shared/utils/friend-analysis'
import LcuImage from '@/components/widgets/LcuImage.vue'
import type { FriendPodiumEntry } from '@domain/analysis/types'
import { FRIEND_METRICS, computeSortedByMetric, computeFriendPodium, getFirstPlaceTitle } from '@domain/analysis/friends'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const loading = ref(false)
const connected = ref(true)
const errorMsg = ref('')

const matchData = ref<MatchListData | null>(null)

const basicCollapsed = ref(false)

/** 当前选中的指标 key */
const selectedMetric = ref<string | null>(null)

function selectMetric(key: string) {
  selectedMetric.value = selectedMetric.value === key ? null : key
}

const friends = computed<FriendStats[]>(() => {
  if (!matchData.value) return []
  return analyzeFriends(matchData.value.games, matchData.value.summoner.puuid)
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

/** 按选中指标降序排列，并应用指标最低场次门槛 */
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

const tableMaxHeight = computed(() => {
  const count = sortedByMetric.value.length
  return Math.min(Math.max(count, 1), 10) * 40 + 36
})

const isItemMetric = computed(() =>
  selectedMetric.value === 'collectorRatio' || selectedMetric.value === 'heartsteelRatio'
)

/** 排名表列定义 */
const friendColumns = computed(() => {
  void themeStore.isDark
  const cat = selectedCategory.value
  const mutedColor = 'var(--text-tertiary)'
  const cols: any[] = [
    {
      title: '#',
      key: 'rank',
      width: 48,
      render: (_row: FriendStats, idx: number) =>
        h('span', {
          style: idx < 3
            ? 'font-weight:700;color:#e8a840;font-size:14px'
            : `color:${mutedColor};font-size:14px`
        }, String(idx + 1)),
    },
    {
      title: '召唤师',
      key: 'name',
      width: 140,
      render: (row: FriendStats) =>
        h('span', { style: 'font-weight:600;font-size:14px' }, shortName(row.name, 10)),
    },
  ]

  if (isItemMetric.value && cat) {
    // 装备指标：收集者率/心之钢率 | 出的场次 | 总场次 | 胜率
    cols.push(
      {
        title: cat.label,
        key: 'metricValue',
        width: 95,
        render: (row: FriendStats) => {
          const val = cat.getter(row)
          return h('span', {
            style: 'font-weight:700;font-family:monospace;font-size:14px;color:var(--text-primary)'
          }, cat.fmt(val))
        },
      },
      {
        title: '出的场次',
        key: 'itemGames',
        width: 85,
        render: (row: FriendStats) => {
          const v = selectedMetric.value === 'collectorRatio' ? row.collectorGames : row.heartsteelGames
          return h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(v))
        },
      },
      {
        title: '总场次',
        key: 'gamesTogether',
        width: 75,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(row.gamesTogether)),
      },
      {
        title: '胜率',
        key: 'winRate',
        width: 80,
        render: (row: FriendStats) => {
          const r = row.winRate
          const color = r >= 0.55 ? '#2ea86c' : r >= 0.45 ? 'var(--text-primary)' : '#e84057'
          return h('span', { style: `font-weight:600;font-family:monospace;font-size:14px;color:${color}` }, rateDisplay(r))
        },
      },
    )
  } else {
    // 默认列：指标值 | 一起场次 | 一起时胜率 | 个人胜率 | 最近一起
    cols.push(
      {
        title: '指标值',
        key: 'metricValue',
        width: 100,
        render: (row: FriendStats) => {
          if (!cat) return ''
          const val = cat.getter(row)
          let color = 'var(--text-primary)'
          if (cat.key === 'winRate') {
            color = val >= 0.55 ? '#2ea86c' : val >= 0.45 ? 'var(--text-primary)' : '#e84057'
          } else if (cat.key === 'winDelta') {
            color = val > 0.02 ? '#2ea86c' : val < -0.02 ? '#e84057' : 'var(--text-tertiary)'
          }
          return h('span', {
            style: `font-weight:700;font-family:monospace;font-size:14px;color:${color}`
          }, cat.fmt(val))
        },
      },
      {
        title: '一起场次',
        key: 'gamesTogether',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(row.gamesTogether)),
      },
      {
        title: '一起时胜率',
        key: 'winRate',
        width: 100,
        render: (row: FriendStats) => {
          const r = row.winRate
          const color = r >= 0.55 ? '#2ea86c' : r >= 0.45 ? 'var(--text-primary)' : '#e84057'
          return h('span', { style: `font-weight:600;font-family:monospace;font-size:14px;color:${color}` }, rateDisplay(r))
        },
      },
      {
        title: '个人胜率',
        key: 'soloWinRate',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:13px;color:var(--text-tertiary)' }, rateDisplay(row.soloWinRate)),
      },
      {
        title: '最近一起',
        key: 'lastPlayed',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-size:12px;color:var(--text-tertiary)' }, daysAgo(row.lastPlayedTime)),
      },
    )
  }

  return cols
})

function daysAgo(ts: number): string {
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${Math.floor(days / 30)}月前`
}

function rateDisplay(rate: number): string {
  return (rate * 100).toFixed(0) + '%'
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await window.lcuApi.fetchMatchList(1, 100)
    matchData.value = data
    const withP = data.games.filter(g => g.blueParticipants.length > 0 || g.redParticipants.length > 0).length
    console.log(`[LCU:FRIEND] 好友分析加载完成: ${data.games.length} 场 (含队友 ${withP} 场), puuid=${data.summoner.puuid.slice(0, 8)}…`)
  } catch (e: any) {
    const msg = e.message || String(e)
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

/* ── 概览栏 ── */
.friend-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-stats {
  display: flex;
  gap: 24px;
  flex: 1;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-badge .stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-badge .stat-num.win {
  color: #2ea86c;
}

.stat-badge .stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* ── 主体双栏布局 ── */
.friend-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── 左侧指标列表 ── */
.metric-sidebar {
  width: 160px;
  flex-shrink: 0;
  background: var(--header-bg);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 8px 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-tertiary);
  padding: 10px 16px 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.category-group {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 10px 10px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.category-header:hover {
  background: var(--bg-hover);
}

.category-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.category-arrow.expanded {
  transform: rotate(90deg);
}

.category-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}

.category-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-section);
  padding: 1px 6px;
  border-radius: 8px;
}

.category-items .metric-item {
  padding-left: 28px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;
}

.metric-item:hover {
  background: var(--bg-hover);
}

.metric-item.active {
  background: var(--bg-section);
  border-left-color: var(--text-primary);
}

.metric-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.metric-dot.cat-blue   { background: #3c8cd0; }
.metric-dot.cat-green  { background: #2ea86c; }
.metric-dot.cat-purple { background: #8b5cf6; }
.metric-dot.cat-red    { background: #e84057; }
.metric-dot.cat-orange { background: #e8913a; }

.metric-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.metric-item.active .metric-label {
  color: var(--text-primary);
  font-weight: 600;
}

/* ── 右侧详情 ── */
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

/* ── 领奖台 ── */
.top-panel {
  flex: 0 0 auto;
}

.podium-section h4,
.ranking-section h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.podium-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 32px;
  padding: 12px 0;
}

.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 170px;
}

.spot-avatar {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.spot-name {
  font-size: 14px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  text-align: center;
}

.spot-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: monospace;
  text-align: center;
}

.spot-value-lg {
  font-size: 26px;
}

.spot-stand {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px 3px 0 0;
}

.spot-1 .spot-stand { height: 56px; }
.spot-2 .spot-stand { height: 44px; }
.spot-3 .spot-stand { height: 34px; }

.stand-gold   { background: linear-gradient(180deg, #e8a840 0%, #c88a20 100%); }
.stand-silver { background: linear-gradient(180deg, #a0a8b0 0%, #707880 100%); }
.stand-bronze { background: linear-gradient(180deg, #b08860 0%, #805838 100%); }

.spot-rank {
  font-size: 20px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.5);
}

/* 第 1 名皇冠 + 称号 */
.first-crown-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: -12px;
  z-index: 1;
}

.crown-glow {
  position: absolute;
  top: -12px;
  width: 80px;
  height: 40px;
  background: radial-gradient(ellipse at center, rgba(232, 168, 64, 0.25) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.crown-icon {
  filter: drop-shadow(0 2px 4px rgba(232, 168, 64, 0.5));
}

.first-title-badge {
  font-size: 13px;
  font-weight: 800;
  color: #1a1a2e;
  background: linear-gradient(135deg, #e8a840 0%, #f0cc60 100%);
  padding: 2px 12px;
  border-radius: 10px;
  letter-spacing: 1px;
  margin-top: -4px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(232, 168, 64, 0.3);
}

.spot-avatar-crowned {
  border: 3px solid rgba(232, 168, 64, 0.6);
  box-shadow: 0 0 16px rgba(232, 168, 64, 0.3);
}

/* ── 排名表 ── */
.ranking-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── 悬浮弹窗 ── */
.popover-stats {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
  padding: 4px 2px;
}

.popover-stats .pop-item {
  white-space: nowrap;
}

.popover-stats b {
  color: var(--text-primary);
  margin-left: 4px;
}

/* ── 开发中水印 ── */
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
