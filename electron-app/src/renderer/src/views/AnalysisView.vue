<template>
  <div class="analysis-page">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
      <p>正在拉取对局详情并计算分析数据...</p>
    </div>

    <!-- 无数据 -->
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
      <!-- 概览栏 -->
      <div class="analysis-header">
        <n-button text @click="$router.push({ name: 'match-list' })" class="back-btn">
          <template #icon><n-icon><arrow-back-outline /></n-icon></template>
          返回列表
        </n-button>
        <div class="header-stats">
          <div class="stat-badge">
            <span class="stat-num">{{ result.gameCount }}</span>
            <span class="stat-label">分析局数</span>
          </div>
          <div class="stat-badge win">
            <span class="stat-num">{{ result.winCount }}W</span>
            <span class="stat-label">{{ result.loseCount }}L</span>
          </div>
          <div class="stat-badge" :class="{ good: result.winRate >= 50 }">
            <span class="stat-num">{{ result.winRate.toFixed(1) }}%</span>
            <span class="stat-label">胜率</span>
          </div>
        </div>
      </div>

      <!-- 主体：左侧指标列表 + 右侧选中指标详情 -->
      <div class="analysis-body">
        <!-- 左侧指标列表 -->
        <div class="metric-sidebar">
          <div class="sidebar-title">数据指标</div>
          <!-- 基础数据：可折叠目录 -->
          <div class="category-group">
            <div class="category-header" @click="basicDataCollapsed = !basicDataCollapsed">
              <n-icon size="16" class="category-arrow" :class="{ expanded: !basicDataCollapsed }">
                <chevron-forward-outline />
              </n-icon>
              <span class="category-label">基础数据</span>
              <span class="category-count">{{ basicMetrics.length }}</span>
            </div>
            <div v-show="!basicDataCollapsed" class="category-items">
              <div
                v-for="cat in basicMetrics"
                :key="cat.key"
                class="metric-item"
                :class="{ active: selectedMetric === cat.key }"
                @click="selectMetric(cat.key)"
              >
                <span class="metric-dot" :class="cat.colorClass"></span>
                <span class="metric-label">{{ cat.label }}</span>
              </div>
            </div>
          </div>
          <!-- 高阶数据：可折叠目录（待扩展） -->
          <div class="category-group">
            <div class="category-header" @click="advancedDataCollapsed = !advancedDataCollapsed">
              <n-icon size="16" class="category-arrow" :class="{ expanded: !advancedDataCollapsed }">
                <chevron-forward-outline />
              </n-icon>
              <span class="category-label">高阶数据</span>
              <span class="category-count">{{ advancedMetrics.length }}</span>
            </div>
            <div v-show="!advancedDataCollapsed" class="category-items">
              <div
                v-for="cat in advancedMetrics"
                :key="cat.key"
                class="metric-item"
                :class="{ active: selectedMetric === cat.key }"
                @click="selectMetric(cat.key)"
              >
                <span class="metric-dot" :class="cat.colorClass"></span>
                <span class="metric-label">{{ cat.label }}</span>
              </div>
              <div v-if="advancedMetrics.length === 0" class="empty-category">暂无高阶指标</div>
            </div>
          </div>
        </div>

        <!-- 右侧详情 -->
        <div class="metric-detail">
          <!-- 未选择指标时的占位提示 -->
          <div v-if="!selectedMetric" class="no-selection">
            <n-icon size="48" color="rgba(255,255,255,0.08)">
              <analytics-outline />
            </n-icon>
            <p>请从左侧选择一个数据指标</p>
            <p class="sub">选择后将展示该指标的玩家排名与领奖台</p>
          </div>

          <template v-else>
            <!-- ═══ 海克斯分析：独立 UI ═══ -->
            <template v-if="selectedMetric === 'augments'">
              <div class="items-section">
                <h4>热门海克斯 TOP 10</h4>
                <div class="global-items-grid">
                  <n-popover v-for="aug in globalAugmentFreq" :key="aug.id" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="global-item-card">
                        <AugmentDisplay :augment-id="aug.id" :size="48" />
                        <div class="item-info">
                          <span class="item-name">{{ aug.name }}</span>
                          <span class="item-freq">{{ aug.count }}次</span>
                        </div>
                      </div>
                    </template>
                    <div class="aug-popover-players">
                      <div class="aug-pop-title">选择过此海克斯的玩家</div>
                      <div v-for="u in getAugmentUsers(aug.id)" :key="u.playerName" class="aug-pop-row">
                        <span class="aug-pop-name">{{ shortName(u.playerName) }}</span>
                        <span class="aug-pop-count">{{ u.count }}次</span>
                      </div>
                    </div>
                  </n-popover>
                  <div v-if="globalAugmentFreq.length === 0" class="empty-hint">该模式无海克斯数据</div>
                </div>
              </div>

              <div class="items-section">
                <h4>各玩家最爱的海克斯</h4>
                <div class="player-items-list">
                  <div v-for="p in sortedPlayerFavoriteAugments" :key="p.playerName" class="player-item-row aug-row">
                    <LcuImage :src="profileIconUrl(p.profileIconId)" :size="24" class="fav-avatar" />
                    <span class="fav-player-name">{{ shortName(p.playerName) }}</span>
                    <AugmentDisplay :augment-id="p.augmentId" :size="36" />
                    <span class="fav-item-name aug-name">{{ p.augmentName }}</span>
                    <span class="fav-count aug-freq">{{ p.count }}/{{ p.totalGames }}局</span>
                  </div>
                  <div v-if="playerFavoriteAugments.length === 0" class="empty-hint">该模式无海克斯数据</div>
                </div>
              </div>
            </template>

            <!-- ═══ 装备分析：独立 UI ═══ -->
            <template v-else-if="selectedMetric === 'items'">
              <div class="items-section">
                <h4>全局最爱出装 TOP 10</h4>
                <div class="global-items-grid">
                  <n-popover v-for="item in globalItemFreq" :key="item.itemId" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="global-item-card">
                        <ItemDisplay :item-id="item.itemId" :size="48" />
                        <div class="item-info">
                          <span class="item-name">{{ item.name }}</span>
                          <span class="item-freq">{{ item.count }}次</span>
                        </div>
                      </div>
                    </template>
                    <div class="aug-popover-players">
                      <div class="aug-pop-title">购买过此装备的玩家</div>
                      <div v-for="u in getItemUsers(item.itemId)" :key="u.playerName" class="aug-pop-row">
                        <span class="aug-pop-name">{{ shortName(u.playerName) }}</span>
                        <span class="aug-pop-count">{{ u.count }}次</span>
                      </div>
                    </div>
                  </n-popover>
                  <div v-if="globalItemFreq.length === 0" class="empty-hint">暂无装备数据</div>
                </div>
              </div>

              <div class="items-section">
                <h4>各玩家最爱装备</h4>
                <div class="player-items-list">
                  <div v-for="p in playerFavoriteItems" :key="p.playerName" class="player-item-row aug-row">
                    <LcuImage :src="profileIconUrl(p.profileIconId)" :size="24" class="fav-avatar" />
                    <span class="fav-player-name">{{ shortName(p.playerName) }}</span>
                    <ItemDisplay :item-id="p.itemId" :size="36" />
                    <span class="fav-item-name aug-name">{{ p.itemName }}</span>
                    <span class="fav-count aug-freq">{{ p.count }}/{{ p.totalGames }}局</span>
                  </div>
                  <div v-if="playerFavoriteItems.length === 0" class="empty-hint">暂无装备数据</div>
                </div>
              </div>
            </template>

            <!-- ═══ 英雄池分析：独立 UI ═══ -->
            <template v-else-if="selectedMetric === 'championPool'">
              <div class="items-section">
                <h4>全局热门英雄 TOP 10</h4>
                <div class="global-items-grid">
                  <n-popover v-for="champ in globalChampionFreq" :key="champ.championId" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="global-item-card">
                        <LcuImage :src="championIconUrl(champ.championId)" :size="48" />
                        <div class="item-info">
                          <span class="item-name">{{ champ.name }}</span>
                          <span class="item-freq">{{ champ.count }}次</span>
                        </div>
                      </div>
                    </template>
                    <div class="aug-popover-players">
                      <div class="aug-pop-title">使用过此英雄的玩家</div>
                      <div v-for="u in getChampionUsers(champ.championId)" :key="u.playerName" class="aug-pop-row">
                        <span class="aug-pop-name">{{ shortName(u.playerName) }}</span>
                        <span class="aug-pop-count">{{ u.count }}次</span>
                      </div>
                    </div>
                  </n-popover>
                  <div v-if="globalChampionFreq.length === 0" class="empty-hint">无英雄数据</div>
                </div>
              </div>

              <div class="items-section">
                <h4>各玩家最常用英雄</h4>
                <div class="player-items-list">
                  <div v-for="p in playerChampionPools" :key="p.playerName" class="player-item-row champ-row">
                    <LcuImage :src="profileIconUrl(p.profileIconId)" :size="28" class="fav-avatar" />
                    <span class="fav-player-name champ-player">{{ shortName(p.playerName) }}</span>
                    <LcuImage :src="championIconUrl(p.mostPlayedChampionId)" :size="44" />
                    <div class="champ-mid-col">
                      <span class="champ-name-main">{{ gds.champions[p.mostPlayedChampionId]?.name || '英雄#' + p.mostPlayedChampionId }}</span>
                      <span class="champ-meta">
                        {{ p.mostPlayedChampionCount }}/{{ p.totalGames }}局 ·
                        选取率{{ (p.mostPlayedChampionCount / p.totalGames * 100).toFixed(0) }}%
                        · 胜率<span :class="p.favChampWins / p.mostPlayedChampionCount >= 0.5 ? 'win-green' : 'win-red'">{{ (p.favChampWins / p.mostPlayedChampionCount * 100).toFixed(0) }}%</span>
                      </span>
                    </div>
                    <div class="champ-pool-badge">
                      <span class="pool-badge-num">{{ p.uniqueChampions }}</span>
                      <span class="pool-badge-label">英雄池</span>
                    </div>
                  </div>
                  <div v-if="playerChampionPools.length === 0" class="empty-hint">暂无英雄数据</div>
                </div>
              </div>
            </template>

            <!-- ═══ 高阶数据：首末名 + 排名表 ═══ -->
            <template v-else-if="isAdvancedMetric(selectedMetric)">
              <!-- 首末名卡片 -->
              <div class="top-panel">
                <div class="advanced-best-worst" v-if="advancedMetricRanking.length">
                  <div class="abw-card abw-best">
                    <div class="abw-tag best">{{ advancedBestTitle }}</div>
                    <LcuImage :src="profileIconUrl(advancedMetricRanking[0].profileIconId)" :size="60" class="abw-avatar" />
                    <div class="abw-name">{{ shortName(advancedMetricRanking[0].playerName) }}</div>
                    <div class="abw-value">{{ selectedCategory?.fmt(advancedMetricRanking[0].total) || '—' }}</div>
                    <div class="abw-meta">{{ advancedMetricRanking[0].gameCount }}局 · 胜率{{ advancedMetricRanking[0].winRate.toFixed(0) }}%</div>
                  </div>
                  <div class="abw-divider"></div>
                  <div class="abw-card abw-worst">
                    <div class="abw-tag worst">{{ advancedWorstTitle }}</div>
                    <LcuImage :src="profileIconUrl(advancedMetricRanking[advancedMetricRanking.length - 1].profileIconId)" :size="60" class="abw-avatar" />
                    <div class="abw-name">{{ shortName(advancedMetricRanking[advancedMetricRanking.length - 1].playerName) }}</div>
                    <div class="abw-value">{{ selectedCategory?.fmt(advancedMetricRanking[advancedMetricRanking.length - 1].total) || '—' }}</div>
                    <div class="abw-meta">{{ advancedMetricRanking[advancedMetricRanking.length - 1].gameCount }}局 · 胜率{{ advancedMetricRanking[advancedMetricRanking.length - 1].winRate.toFixed(0) }}%</div>
                  </div>
                </div>
              </div>

              <!-- 玩家排名表 -->
              <div class="ranking-section">
                <h4>{{ selectedCategory?.label }} — 玩家排名</h4>
                <n-data-table
                  :key="'adv-' + themeStore.isDark"
                  :columns="advancedRankingColumns"
                  :data="advancedMetricRanking"
                  :row-key="(row: MetricRankEntry) => row.playerName"
                  size="medium"
                  striped
                  :max-height="tableMaxHeight"
                  virtual-scroll
                />
              </div>
            </template>

            <!-- ═══ 普通指标：领奖台 + 排名表 ═══ -->
            <template v-else>
            <!-- 领奖台 -->
            <div class="top-panel">
              <div class="podium-section" v-if="metricPodium.length">
                <h4>{{ selectedCategory?.label }} — 领奖台</h4>
                <div class="podium-row">
                  <!-- 第 2 名 -->
                  <n-popover v-if="metricPodium[1]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-2">
                        <LcuImage :src="profileIconUrl(metricPodium[1].profileIconId)" :size="52" class="spot-avatar" />
                        <div class="spot-name">{{ shortName(metricPodium[1].playerName) }}</div>
                        <div class="spot-value">{{ metricPodium[1].displayValue }}</div>
                        <div class="spot-stand stand-silver"><span class="spot-rank">2</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <div class="pop-item">局数 <b>{{ metricPodium[1].gameCount }}</b></div>
                      <div class="pop-item">胜率 <b>{{ podiumWinRate(metricPodium[1]) }}%</b></div>
                      <div class="pop-item">KDA <b>{{ metricPodium[1].avgKda }}</b></div>
                      <div class="pop-item">击杀/死亡/助攻 <b>{{ metricPodium[1].totalKills }}/{{ metricPodium[1].totalDeaths }}/{{ metricPodium[1].totalAssists }}</b></div>
                    </div>
                  </n-popover>
                  <!-- 第 1 名 -->
                  <n-popover v-if="metricPodium[0]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-1">
                        <div class="first-crown-wrapper">
                          <div class="crown-glow"></div>
                          <n-icon size="28" color="#e8a840" class="crown-icon">
                            <trophy-outline />
                          </n-icon>
                          <div v-if="firstPlaceTitle" class="first-title-badge">{{ firstPlaceTitle }}</div>
                        </div>
                        <LcuImage :src="profileIconUrl(metricPodium[0].profileIconId)" :size="68" class="spot-avatar spot-avatar-crowned" />
                        <div class="spot-name">{{ shortName(metricPodium[0].playerName) }}</div>
                        <div class="spot-value spot-value-lg">{{ metricPodium[0].displayValue }}</div>
                        <div class="spot-stand stand-gold"><span class="spot-rank">1</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <div class="pop-item">局数 <b>{{ metricPodium[0].gameCount }}</b></div>
                      <div class="pop-item">胜率 <b>{{ podiumWinRate(metricPodium[0]) }}%</b></div>
                      <div class="pop-item">KDA <b>{{ metricPodium[0].avgKda }}</b></div>
                      <div class="pop-item">击杀/死亡/助攻 <b>{{ metricPodium[0].totalKills }}/{{ metricPodium[0].totalDeaths }}/{{ metricPodium[0].totalAssists }}</b></div>
                    </div>
                  </n-popover>
                  <!-- 第 3 名 -->
                  <n-popover v-if="metricPodium[2]" trigger="hover" placement="top" :show-arrow="false">
                    <template #trigger>
                      <div class="podium-spot spot-3">
                        <LcuImage :src="profileIconUrl(metricPodium[2].profileIconId)" :size="52" class="spot-avatar" />
                        <div class="spot-name">{{ shortName(metricPodium[2].playerName) }}</div>
                        <div class="spot-value">{{ metricPodium[2].displayValue }}</div>
                        <div class="spot-stand stand-bronze"><span class="spot-rank">3</span></div>
                      </div>
                    </template>
                    <div class="popover-stats">
                      <div class="pop-item">局数 <b>{{ metricPodium[2].gameCount }}</b></div>
                      <div class="pop-item">胜率 <b>{{ podiumWinRate(metricPodium[2]) }}%</b></div>
                      <div class="pop-item">KDA <b>{{ metricPodium[2].avgKda }}</b></div>
                      <div class="pop-item">击杀/死亡/助攻 <b>{{ metricPodium[2].totalKills }}/{{ metricPodium[2].totalDeaths }}/{{ metricPodium[2].totalAssists }}</b></div>
                    </div>
                  </n-popover>
                </div>
              </div>
            </div>

            <!-- 玩家排名表 -->
            <div class="ranking-section">
              <h4>{{ selectedCategory?.label }} — 玩家排名</h4>
              <n-data-table
                :key="'basic-' + themeStore.isDark"
                :columns="rankingColumns"
                :data="metricRanking"
                :row-key="(row: MetricRankEntry) => row.playerName"
                size="medium"
                striped
                :max-height="tableMaxHeight"
                virtual-scroll
              />
            </div>
            </template>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NDataTable,
  NButton,
  NIcon,
  NPopover,
  NSpin,
  useMessage,
} from 'naive-ui'
import {
  AnalyticsOutline,
  ArrowBackOutline,
  ListOutline,
  ChevronForwardOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import type { GameRecord, PlayerStats, AnalysisResult, PlayerAnalysis } from '@shared/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'
import { isBuildItem, getRoleName } from '@shared/utils/mappings'
import { getModeAnalysisConfig, type MetricDef } from '@shared/utils/mode-analysis-config'
import { useGameDataStore } from '@/stores/game-data'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const message = useMessage()
const gds = useGameDataStore()
const themeStore = useThemeStore()

const loading = ref(false)
const result = ref<AnalysisResult | null>(null)
/** 响应式对局数据，供所有 computed 属性依赖追踪 */
const analysisGames = ref<GameRecord[]>([])

/** 当前选中的指标 key */
const selectedMetric = ref<string | null>(null)
/** 当前分析的游戏模式（从加载的对局中检测） */
const currentMode = ref<string>('')
/** 基础数据目录是否折叠 */
const basicDataCollapsed = ref(false)
/** 高阶数据目录是否折叠 */
const advancedDataCollapsed = ref(true)

function selectMetric(key: string) {
  selectedMetric.value = selectedMetric.value === key ? null : key
}

/** LCU 资源 URL */
function championIconUrl(championId: number): string {
  return `/lol-game-data/assets/v1/champion-icons/${championId}.png`
}
function profileIconUrl(iconId: number): string {
  return `/lol-game-data/assets/v1/profile-icons/${iconId || 0}.jpg`
}

/** 当前模式的基础指标 */
const basicMetrics = computed<MetricDef[]>(() => {
  if (!currentMode.value) return []
  return getModeAnalysisConfig(currentMode.value).basicMetrics
})

/** 当前模式的高阶指标 */
const advancedMetrics = computed<MetricDef[]>(() => {
  if (!currentMode.value) return []
  return getModeAnalysisConfig(currentMode.value).advancedMetrics
})

/** 判断是否为高阶指标 */
function isAdvancedMetric(key: string | null): boolean {
  return advancedMetrics.value.some((c) => c.key === key)
}

const selectedCategory = computed(() =>
  basicMetrics.value.find((c) => c.key === selectedMetric.value)
  || advancedMetrics.value.find((c) => c.key === selectedMetric.value)
  || null
)

/** 领奖台单条数据 */
interface PodiumEntry {
  playerName: string
  profileIconId: number
  totalValue: number
  displayValue: string
  gameCount: number
  winCount: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  avgKda: string
}

/** 玩家全维度聚合 */
interface PlayerFullAgg {
  profileIconId: number
  gameCount: number
  winCount: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
}

function buildPlayerAggMap(games: GameRecord[]): Map<string, PlayerFullAgg> {
  const map = new Map<string, PlayerFullAgg>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!map.has(name)) {
        map.set(name, { profileIconId: p.profile_icon_id, gameCount: 0, winCount: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0 })
      }
      const agg = map.get(name)!
      agg.gameCount++
      if (p.stats.win) agg.winCount++
      agg.totalKills += p.stats.kills
      agg.totalDeaths += p.stats.deaths
      agg.totalAssists += p.stats.assists
    }
  }
  return map
}

/** 指标排名条目 */
interface MetricRankEntry {
  playerName: string
  profileIconId: number
  total: number
  average: number
  gameCount: number
  winCount: number
  winRate: number
  /** 高阶指标原始数据（可选） */
  raw?: { label: string; value: number }[]
}

/** 当前选中指标的玩家排名（按总计降序） */
const metricRanking = computed<MetricRankEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value) return []

  const getter = selectedCategory.value.getter
  const playerMap = new Map<string, { total: number; count: number; profileIconId: number; winCount: number }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = getter(p.stats)
      if (!playerMap.has(name)) {
        playerMap.set(name, { total: 0, count: 0, profileIconId: p.profile_icon_id, winCount: 0 })
      }
      const entry = playerMap.get(name)!
      entry.total += val
      entry.count++
      if (p.stats.win) entry.winCount++
    }
  }

  return Array.from(playerMap.entries())
    .map(([name, e]) => ({
      playerName: name,
      profileIconId: e.profileIconId,
      total: e.total,
      average: e.total / e.count,
      gameCount: e.count,
      winCount: e.winCount,
      winRate: (e.winCount / e.count) * 100,
    }))
    .sort((a, b) => b.total - a.total)
})

/** 高阶指标排名（按总量比值聚合，而非单局均值简单平均） */
const advancedMetricRanking = computed<MetricRankEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value || !isAdvancedMetric(selectedMetric.value)) return []

  const key = selectedMetric.value
  if (!key) return []

  // 角色率指标：统计每个玩家选了某类英雄的局数占比
  const ROLE_RATE_KEYS = new Set(['fighterRate', 'tankRate', 'mageRate', 'assassinRate', 'marksmanRate', 'supportRate'])
  const ROLE_TAG_REVERSE: Record<string, string> = {
    fighterRate: 'Fighter', tankRate: 'Tank', mageRate: 'Mage',
    assassinRate: 'Assassin', marksmanRate: 'Marksman', supportRate: 'Support',
  }

  if (ROLE_RATE_KEYS.has(key)) {
    const targetTag = ROLE_TAG_REVERSE[key] // e.g. "Fighter"
    const playerRoleData = new Map<string, { profileIconId: number; roleCount: number; gameCount: number; winCount: number }>()
    for (const g of games) {
      for (const p of [...g.blue_team.players, ...g.red_team.players]) {
        const name = p.summoner_name
        if (!playerRoleData.has(name)) {
          playerRoleData.set(name, { profileIconId: p.profile_icon_id, roleCount: 0, gameCount: 0, winCount: 0 })
        }
        const d = playerRoleData.get(name)!
        d.gameCount++
        if (p.stats.win) d.winCount++
        const champ = gds.champions[p.champion_id]
        const champRoles: string[] = (champ as any)?.roles || (champ as any)?.tags || []
        if (champRoles.some(r => r.toLowerCase() === targetTag.toLowerCase())) d.roleCount++      }
    }
    return Array.from(playerRoleData.entries())
      .map(([name, d]) => ({
        playerName: name,
        profileIconId: d.profileIconId,
        total: d.gameCount > 0 ? d.roleCount / d.gameCount : 0,
        average: d.gameCount > 0 ? d.roleCount / d.gameCount : 0,
        gameCount: d.gameCount,
        winCount: d.winCount,
        winRate: d.gameCount > 0 ? (d.winCount / d.gameCount) * 100 : 0,
        raw: [
          { label: getRoleName(targetTag) + '局数', value: d.roleCount },
          { label: '总局数', value: d.gameCount },
        ],
      }))
      .sort((a, b) => b.total - a.total)
  }

  const playerData = new Map<string, { totalDmg: number; totalGold: number; totalKills: number; totalDeaths: number; totalTeamDmg: number; totalDmgTaken: number; totalTeamDmgTaken: number; profileIconId: number; gameCount: number; winCount: number }>()

  for (const g of games) {
    const blueDmg = g.blue_team.players.reduce((s: number, p: any) => s + p.stats.damage.total_to_champs, 0)
    const redDmg = g.red_team.players.reduce((s: number, p: any) => s + p.stats.damage.total_to_champs, 0)
    const blueTaken = g.blue_team.players.reduce((s: number, p: any) => s + p.stats.damage.total_taken, 0)
    const redTaken = g.red_team.players.reduce((s: number, p: any) => s + p.stats.damage.total_taken, 0)
    for (const p of g.blue_team.players) {
      const name = p.summoner_name
      if (!playerData.has(name)) {
        playerData.set(name, { totalDmg: 0, totalGold: 0, totalKills: 0, totalDeaths: 0, totalTeamDmg: 0, totalDmgTaken: 0, totalTeamDmgTaken: 0, profileIconId: p.profile_icon_id, gameCount: 0, winCount: 0 })
      }
      const d = playerData.get(name)!
      d.totalDmg += p.stats.damage.total_to_champs
      d.totalGold += p.stats.economy.gold_earned
      d.totalKills += p.stats.kills
      d.totalDeaths += p.stats.deaths
      d.totalTeamDmg += blueDmg
      d.totalDmgTaken += p.stats.damage.total_taken
      d.totalTeamDmgTaken += blueTaken
      d.gameCount++
      if (p.stats.win) d.winCount++
    }
    for (const p of g.red_team.players) {
      const name = p.summoner_name
      if (!playerData.has(name)) {
        playerData.set(name, { totalDmg: 0, totalGold: 0, totalKills: 0, totalDeaths: 0, totalTeamDmg: 0, totalDmgTaken: 0, totalTeamDmgTaken: 0, profileIconId: p.profile_icon_id, gameCount: 0, winCount: 0 })
      }
      const d = playerData.get(name)!
      d.totalDmg += p.stats.damage.total_to_champs
      d.totalGold += p.stats.economy.gold_earned
      d.totalKills += p.stats.kills
      d.totalDeaths += p.stats.deaths
      d.totalTeamDmg += redDmg
      d.totalDmgTaken += p.stats.damage.total_taken
      d.totalTeamDmgTaken += redTaken
      d.gameCount++
      if (p.stats.win) d.winCount++
    }
  }

  return Array.from(playerData.entries())
    .map(([name, d]) => {
      let ratio: number
      let raw: { label: string; value: number }[]
      if (key === 'dmgPerGold') {
        ratio = d.totalGold > 0 ? d.totalDmg / d.totalGold : 0
        raw = [
          { label: '总伤害', value: d.totalDmg },
          { label: '总经济', value: d.totalGold },
        ]
      } else if (key === 'dmgPerKill') {
        ratio = d.totalKills > 0 ? d.totalDmg / d.totalKills : 0
        raw = [
          { label: '总伤害', value: d.totalDmg },
          { label: '总击杀', value: d.totalKills },
        ]
      } else if (key === 'dmgPerDeath') {
        ratio = d.totalDeaths > 0 ? d.totalDmg / d.totalDeaths : 0
        raw = [
          { label: '总伤害', value: d.totalDmg },
          { label: '总死亡', value: d.totalDeaths },
        ]
      } else if (key === 'dmgShare') {
        ratio = d.totalTeamDmg > 0 ? d.totalDmg / d.totalTeamDmg : 0
        raw = [
          { label: '个人总伤害', value: d.totalDmg },
          { label: '队伍总伤害', value: d.totalTeamDmg },
        ]
      } else if (key === 'dmgTakenShare') {
        ratio = d.totalTeamDmgTaken > 0 ? d.totalDmgTaken / d.totalTeamDmgTaken : 0
        raw = [
          { label: '个人总承伤', value: d.totalDmgTaken },
          { label: '队伍总承伤', value: d.totalTeamDmgTaken },
        ]
      } else {
        ratio = 0
        raw = []
      }
      return {
        playerName: name,
        profileIconId: d.profileIconId,
        total: ratio,
        average: ratio,
        gameCount: d.gameCount,
        winCount: d.winCount,
        winRate: (d.winCount / d.gameCount) * 100,
        raw,
      }
    })
    .sort((a, b) => b.total - a.total)
})

/**
 * 第 1 名领奖台自定义称号映射（从模式配置读取）
 */
const firstPlaceTitle = computed(() => {
  if (!selectedMetric.value || !currentMode.value) return ''
  const cfg = getModeAnalysisConfig(currentMode.value)
  return cfg.podiumTitles[selectedMetric.value] || ''
})

/**
 * 高阶数据首末名标签映射（从模式配置读取）
 */
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

/** 排名表最大高度：约10行 */
const tableMaxHeight = computed(() => {
  const count = selectedMetric.value && isAdvancedMetric(selectedMetric.value)
    ? advancedMetricRanking.value.length
    : metricRanking.value.length
  return Math.min(Math.max(count, 1), 10) * 40 + 36
})

/** 当前选中指标的领奖台 TOP 3 */
const metricPodium = computed<PodiumEntry[]>(() => {
  const games = analysisGames.value
  if (!games || !selectedCategory.value) return []

  const aggMap = buildPlayerAggMap(games)
  const cat = selectedCategory.value

  const playerAgg = new Map<string, { total: number; count: number }>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = cat.getter(p.stats)
      if (!playerAgg.has(name)) {
        playerAgg.set(name, { total: 0, count: 0 })
      }
      const entry = playerAgg.get(name)!
      entry.total += val
      entry.count++
    }
  }

  return Array.from(playerAgg.entries())
    .map(([name, agg]) => {
      const full = aggMap.get(name)!
      const kda = full.totalDeaths > 0
        ? ((full.totalKills + full.totalAssists) / full.totalDeaths).toFixed(2)
        : (full.totalKills + full.totalAssists).toFixed(1)
      const fmt = cat.fmt
      return {
        playerName: name,
        profileIconId: full.profileIconId,
        totalValue: agg.total,
        displayValue: fmt(agg.total),
        gameCount: full.gameCount,
        winCount: full.winCount,
        totalKills: full.totalKills,
        totalDeaths: full.totalDeaths,
        totalAssists: full.totalAssists,
        avgKda: kda,
      }
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 3)
})

function podiumWinRate(e: PodiumEntry): string {
  return e.gameCount > 0 ? ((e.winCount / e.gameCount) * 100).toFixed(0) : '0'
}

/** 全局装备频次 TOP 10 */
const globalItemFreq = computed(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
      name: gds.items[itemId]?.name || `装备#${itemId}`,
      iconPath: gds.items[itemId]?.iconPath || '',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

interface PlayerFavItem {
  playerName: string
  profileIconId: number
  itemId: number
  itemName: string
  iconPath: string
  count: number
  totalGames: number
}

/** 每个玩家最爱装备（取该玩家出现次数最多的装备） */
const playerFavoriteItems = computed<PlayerFavItem[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
        itemName: gds.items[bestItemId]?.name || '',
        iconPath: gds.items[bestItemId]?.iconPath || '',
        count: bestCount,
        totalGames: meta.totalGames,
      }
    })
    .filter(p => p.itemId > 0)
})

interface PlayerChampionPool {
  playerName: string
  profileIconId: number
  uniqueChampions: number
  mostPlayedChampionId: number
  mostPlayedChampionCount: number
  favChampWins: number
  totalGames: number
  winCount: number
}

const playerChampionPools = computed<PlayerChampionPool[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
})

interface GlobalChampFreq {
  championId: number
  count: number
  name: string
}

/** 全局英雄选取频次 TOP 10（所有对局所有玩家） */
const globalChampionFreq = computed<GlobalChampFreq[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
    .map(([championId, count]) => ({
      championId,
      count,
      name: gds.champions[championId]?.name || `英雄#${championId}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

/** 查询某个英雄被哪些玩家使用过（用于热门榜悬浮弹窗） */
function getChampionUsers(championId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
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

/** 全局增幅频次（所有对局所有玩家，排除 0） */
const globalAugmentFreq = computed(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
      name: gds.augments[id]?.nameTRA || `海克斯#${id}`,
      iconPath: gds.augments[id]?.augmentSmallIconPath || '',
      rarity: gds.augments[id]?.rarity || '',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

interface PlayerFavAug {
  playerName: string
  profileIconId: number
  augmentId: number
  augmentName: string
  iconPath: string
  rarity: string
  count: number
  totalGames: number
}

/** 每个玩家最常选的增幅 */
const playerFavoriteAugments = computed<PlayerFavAug[]>(() => {
  const games = analysisGames.value
  if (!games || games.length === 0) return []

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
        augmentName: gds.augments[bestId]?.nameTRA || '',
        iconPath: gds.augments[bestId]?.augmentSmallIconPath || '',
        rarity: gds.augments[bestId]?.rarity || '',
        count: bestCount,
        totalGames: meta.totalGames,
      }
    })
    .filter(p => p.augmentId > 0)
})

/** 按局内频率(count/totalGames)降序排列的玩家最爱海克斯 */
const sortedPlayerFavoriteAugments = computed(() =>
  [...playerFavoriteAugments.value].sort((a, b) => {
    const rateA = a.count / a.totalGames
    const rateB = b.count / b.totalGames
    return rateB - rateA
  })
)

/** 查询某个海克斯被哪些玩家选择过（用于热门榜悬浮弹窗） */
function getAugmentUsers(augId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
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

/** 查询某件装备被哪些玩家购买过（用于热门榜悬浮弹窗） */
function getItemUsers(itemId: number): { playerName: string; count: number }[] {
  const games = analysisGames.value
  if (!games) return []
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

/** 加载分析数据 */
async function loadAnalysis() {
  // 仅"选择对局 + 点击分析按钮"触发计算；侧边栏导航只展示已有结果
  const shouldRecalculate = sessionStorage.getItem('analysisShouldRecalculate') === 'true'
  sessionStorage.removeItem('analysisShouldRecalculate')
  if (!shouldRecalculate) return

  const rawIds = sessionStorage.getItem('analysisGameIds')
  if (!rawIds) return

  const gameIds: number[] = JSON.parse(rawIds)
  if (!gameIds.length) return

  console.log(`[LCU:ANALYSIS] 开始分析: ${gameIds.length} 场对局, ids=${gameIds.join(',')}`)
  selectedMetric.value = null
  loading.value = true
  try {
    const games = await window.lcuApi.fetchGameDetails(gameIds)
    console.log(`[LCU:ANALYSIS] 对局数据拉取完成: ${games.length} 场`)

    // 检测游戏模式
    const modes = new Set(games.map(g => g.game_mode))
    currentMode.value = modes.size === 1 ? [...modes][0] : ''
    if (currentMode.value) {
      const cfg = getModeAnalysisConfig(currentMode.value)
      console.log(`[LCU:ANALYSIS] 检测到模式: ${cfg.displayName} (${currentMode.value})`)
    }

    const playerMap = new Map<string, {
      puuid: string
      summonerName: string
      games: PlayerStats[]
      wins: number
    }>()

    for (const game of games) {
      for (const p of [...game.blue_team.players, ...game.red_team.players]) {
        const key = p.puuid || p.summoner_name
        if (!playerMap.has(key)) {
          playerMap.set(key, {
            puuid: key,
            summonerName: p.summoner_name,
            games: [],
            wins: 0,
          })
        }
        const entry = playerMap.get(key)!
        entry.games.push(p.stats)
        if (p.stats.win) entry.wins++
      }
    }

    const players: PlayerAnalysis[] = Array.from(playerMap.values())
      .map((e) => {
        const n = e.games.length
        const avg = (getter: (s: PlayerStats) => number) =>
          e.games.reduce((sum, s) => sum + getter(s), 0) / n

        return {
          puuid: e.puuid,
          summonerName: e.summonerName,
          gameCount: n,
          winCount: e.wins,
          loseCount: n - e.wins,
          winRate: (e.wins / n) * 100,
          avgKills: avg((s) => s.kills),
          avgDeaths: avg((s) => s.deaths),
          avgAssists: avg((s) => s.assists),
          avgKda: avg((s) => (s.kills + s.assists) / Math.max(s.deaths, 1)),
          avgDamageDealt: avg((s) => s.damage.total_to_champs),
          avgDamageTaken: avg((s) => s.damage.total_taken),
          avgTotalHeal: avg((s) => s.survival.total_heal),
          avgCs: avg((s) => s.cs.total),
          avgGold: avg((s) => s.economy.gold_earned),
          avgVisionScore: avg((s) => s.vision.score),
          avgCcTime: avg((s) => s.cc.total_cc_dealt),
        }
      })
      .sort((a, b) => b.gameCount - a.gameCount)

    const winCount = games.filter(
      (g) => g.blue_team.win || g.red_team.win
    ).length

    result.value = {
      selectedGameIds: gameIds,
      gameCount: games.length,
      winCount,
      winRate: (winCount / games.length) * 100,
      loseCount: games.length - winCount,
      players,
    }

    analysisGames.value = games
  } catch (e: any) {
    message.error(`分析失败: ${e.message || e}`)
  } finally {
    loading.value = false
  }
}

/** 格式化数字 */
function fmtNum(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toFixed(0)
}

/** 短名称 */
function shortName(name: string): string {
  return name.length > 12 ? name.slice(0, 11) + '…' : name
}

/** 排名表列定义 */
const rankingColumns = computed(() => {
  void themeStore.isDark // 依赖主题，确保切换时重新计算
  const mutedColor = 'var(--text-tertiary)'
  return [
    {
      title: '#',
      key: 'rank',
      width: 48,
      render: (_row: MetricRankEntry, idx: number) =>
        h('span', { style: idx < 3 ? 'font-weight:700;color:#e8a840;font-size:14px' : `color:${mutedColor};font-size:14px` }, String(idx + 1)),
    },
    {
      title: '玩家',
      key: 'playerName',
      width: 150,
      render: (row: MetricRankEntry) =>
        h('span', { style: 'font-weight:600;font-size:14px' }, shortName(row.playerName)),
    },
    {
      title: '总计',
      key: 'total',
      width: 100,
      render: (row: MetricRankEntry) =>
        h('span', { style: 'font-weight:700;font-family:monospace;font-size:14px' }, selectedCategory.value?.fmt(row.total) || String(row.total)),
    },
    {
      title: '场均',
      key: 'average',
      width: 100,
      render: (row: MetricRankEntry) =>
        h('span', { style: 'font-family:monospace;font-size:14px' }, selectedCategory.value?.fmt(row.average) || row.average.toFixed(1)),
    },
    { title: '场次', key: 'gameCount', width: 60 },
    {
      title: '胜率',
      key: 'winRate',
      width: 70,
      render: (row: MetricRankEntry) => h('span', { style: 'font-size:14px' }, `${row.winRate.toFixed(0)}%`),
    },
  ]
})

/** 高阶数据排名表列（比值 + 原始数据列） */
const advancedRankingColumns = computed(() => {
  void themeStore.isDark
  const mutedColor = 'var(--text-tertiary)'
  const secondaryColor = 'var(--text-secondary)'
  const cols: any[] = [
    {
      title: '#',
      key: 'rank',
      width: 48,
      render: (_row: MetricRankEntry, idx: number) =>
        h('span', { style: idx === 0 ? 'font-weight:700;color:#e8a840;font-size:14px' : idx === advancedMetricRanking.value.length - 1 ? 'font-weight:700;color:#e84057;font-size:14px' : `color:${mutedColor};font-size:14px` }, String(idx + 1)),
    },
    {
      title: '玩家',
      key: 'playerName',
      width: 140,
      render: (row: MetricRankEntry) =>
        h('span', { style: 'font-weight:600;font-size:14px' }, shortName(row.playerName)),
    },
    {
      title: '比值',
      key: 'total',
      width: 90,
      render: (row: MetricRankEntry) =>
        h('span', { style: 'font-weight:700;font-family:monospace;font-size:14px' }, selectedCategory.value?.fmt(row.total) || row.total.toFixed(2)),
    },
  ]

  // 动态追加原始数据列
  const first = advancedMetricRanking.value[0]
  if (first?.raw) {
    for (const r of first.raw) {
      cols.push({
        title: r.label,
        key: `raw-${r.label}`,
        width: 90,
        render: (row: MetricRankEntry) => {
          const rawItem = row.raw?.find(x => x.label === r.label)
          return h('span', { style: `font-family:monospace;font-size:13px;color:${secondaryColor}` }, rawItem ? fmtNum(rawItem.value) : '-')
        },
      })
    }
  }

  cols.push(
    { title: '场次', key: 'gameCount', width: 55 },
    {
      title: '胜率',
      key: 'winRate',
      width: 65,
      render: (row: MetricRankEntry) => h('span', { style: 'font-size:14px' }, `${row.winRate.toFixed(0)}%`),
    },
  )

  return cols
})

onActivated(() => {
  loadAnalysis()
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

/* ── 概览栏 ── */
.analysis-header {
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
  gap: 20px;
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

.stat-badge.win .stat-num { color: #239b23; }
.stat-badge.good .stat-num { color: #239b23; }

.stat-badge .stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ── 主体双栏布局 ── */
.analysis-body {
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

.metric-dot.cat-red    { background: #e84057; }
.metric-dot.cat-orange { background: #f0a040; }
.metric-dot.cat-green  { background: #2ea86c; }
.metric-dot.cat-gold   { background: #c8aa2e; }
.metric-dot.cat-blue   { background: #3c8cd0; }
.metric-dot.cat-purple { background: #8b5cf6; }

.metric-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.metric-item.active .metric-label {
  color: var(--text-primary);
  font-weight: 600;
}

/* ── 可折叠目录 ── */
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

/* ── 空目录占位 ── */
.empty-category {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 16px 12px 28px;
  text-align: center;
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

/* ── 上方面板：领奖台 / 首末名 (~1/3) ── */
.top-panel {
  flex: 0 0 auto;
}

/* ── 领奖台 ── */
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

/* ── 第 1 名皇冠 + 称号 ── */
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

/* ── 排名表 (~2/3) ── */
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

/* ── 装备分析专用样式 ── */
.items-section {
  margin-bottom: 8px;
}

.items-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.global-items-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.global-item-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-hover);
  border-radius: 6px;
  padding: 8px 12px;
  min-width: 160px;
}

.global-item-card .item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.global-item-card .item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-item-card .item-freq {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: monospace;
}

.player-items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-card);
  border-radius: 4px;
}

.player-item-row .fav-avatar {
  border-radius: 50%;
  flex-shrink: 0;
}

.player-item-row .fav-player-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-item-row .fav-item-name {
  font-size: 14px;
  color: var(--text-secondary);
  flex: 1;
}

.player-item-row .fav-count {
  font-size: 13px;
  color: var(--text-tertiary);
  font-family: monospace;
  flex-shrink: 0;
}

/* ── 高阶数据首末名 ── */
.advanced-best-worst {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg-card);
  border-radius: 8px;
  padding: 24px 24px;
}

.abw-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.abw-divider {
  width: 1px;
  height: 100px;
  background: var(--bg-section);
  flex-shrink: 0;
}

.abw-tag {
  font-size: 13px;
  font-weight: 700;
  padding: 3px 14px;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.abw-tag.best {
  color: #e8a840;
  background: rgba(232, 168, 64, 0.12);
}

.abw-tag.worst {
  color: #e84057;
  background: rgba(232, 64, 87, 0.12);
}

.abw-avatar {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
}

.abw-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.abw-value {
  font-size: 28px;
  font-weight: 800;
  font-family: monospace;
  color: var(--text-primary);
}

.abw-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  padding: 16px;
  text-align: center;
}

/* ── 海克斯悬浮弹窗 ── */
.aug-popover-players {
  font-size: 12px;
  padding: 4px 2px;
  min-width: 140px;
}

.aug-pop-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}

.aug-pop-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  line-height: 1.8;
}

.aug-pop-name {
  color: var(--text-primary);
}

.aug-pop-count {
  color: var(--text-secondary);
  font-family: monospace;
}

/* ── 海克斯玩家列表增强 ── */
.player-item-row.aug-row {
  padding: 8px 12px;
}

.player-item-row .aug-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.player-item-row .aug-freq {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
}

/* ── 英雄池样式 ── */
.player-item-row.champ-row {
  padding: 10px 14px;
}

.champ-player {
  font-size: 14px;
  min-width: 110px;
}

.champ-mid-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.champ-name-main {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.champ-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.win-green {
  color: #2ea86c;
  font-weight: 700;
}

.win-red {
  color: #e84057;
  font-weight: 700;
}

.champ-pool-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 52px;
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 6px 10px;
}

.pool-badge-num {
  font-size: 22px;
  font-weight: 800;
  color: #3c8cd0;
  font-family: monospace;
  line-height: 1;
}

.pool-badge-label {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
