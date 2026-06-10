<template>
  <div class="game-detail-page">
    <!-- 加载中 -->
    <div v-if="loading" class="empty-state">
      <n-spin size="large" />
      <p>加载对局数据...</p>
    </div>

    <!-- 对局不存在 -->
    <div v-else-if="!game" class="empty-state">
      <h3>未找到对局</h3>
      <n-button @click="$router.push(backRoute)">返回列表</n-button>
    </div>

    <template v-else>
      <!-- 顶部概览栏 -->
      <div class="game-header">
        <n-button text @click="$router.push(backRoute)" class="back-btn">
          <template #icon><n-icon><arrow-back-outline /></n-icon></template>
          返回列表
        </n-button>
        <div class="game-meta">
          <span class="game-id">#{{ game.game_id }}</span>
          <n-tag>{{ getGameModeName(game.game_mode) }}</n-tag>
          <n-tag v-if="game.queue_id">{{ getQueueName(game.queue_id, gds.queues) }}</n-tag>
          <n-tag v-if="game.map_id" size="small" :bordered="false">{{ getMapName(game.map_id) }}</n-tag>
          <span class="game-time">{{ formatGameDuration(game.game_duration_min * 60) }}</span>
          <span class="game-version">{{ game.game_version }}</span>
        </div>
        <div class="game-result">
          <n-tag type="success" v-if="game.blue_team.win" size="small">蓝方胜</n-tag>
          <n-tag type="success" v-else size="small">红方胜</n-tag>
        </div>
      </div>

      <!-- 两队数据对比 -->
      <div class="teams-area">
        <!-- 蓝方 -->
        <div class="team-panel blue-panel" :class="{ winner: game.blue_team.win }">
          <div class="team-title">
            <n-tag type="info" :bordered="false">蓝方</n-tag>
            <span v-if="game.blue_team.win" class="win-badge">WIN</span>
            <span v-else class="lose-badge">LOSE</span>
          </div>
          <div class="team-stats-row">
            <span v-if="game.blue_team.baron_kills">男爵×{{ game.blue_team.baron_kills }}</span>
            <span v-if="game.blue_team.dragon_kills">龙×{{ game.blue_team.dragon_kills }}</span>
            <span v-if="game.blue_team.tower_kills">塔×{{ game.blue_team.tower_kills }}</span>
            <span v-if="game.blue_team.inhibitor_kills">水晶×{{ game.blue_team.inhibitor_kills }}</span>
            <span v-if="game.blue_team.first_blood" class="first-badge">一血</span>
            <span v-if="game.blue_team.first_tower" class="first-badge">一塔</span>
          </div>
          <div class="player-cards">
            <div
              v-for="p in game.blue_team.players"
              :key="p.puuid || p.summoner_name"
              class="player-card"
              :class="{ is_winner: p.stats.win }"
            >
              <player-card :player="p" :bests="bests" :all-players="allPlayers" />
            </div>
          </div>
        </div>

        <!-- 红方 -->
        <div class="team-panel red-panel" :class="{ winner: game.red_team.win }">
          <div class="team-title">
            <n-tag type="error" :bordered="false">红方</n-tag>
            <span v-if="game.red_team.win" class="win-badge">WIN</span>
            <span v-else class="lose-badge">LOSE</span>
          </div>
          <div class="team-stats-row">
            <span v-if="game.red_team.baron_kills">男爵×{{ game.red_team.baron_kills }}</span>
            <span v-if="game.red_team.dragon_kills">龙×{{ game.red_team.dragon_kills }}</span>
            <span v-if="game.red_team.tower_kills">塔×{{ game.red_team.tower_kills }}</span>
            <span v-if="game.red_team.inhibitor_kills">水晶×{{ game.red_team.inhibitor_kills }}</span>
            <span v-if="game.red_team.first_blood" class="first-badge">一血</span>
            <span v-if="game.red_team.first_tower" class="first-badge">一塔</span>
          </div>
          <div class="player-cards">
            <div
              v-for="p in game.red_team.players"
              :key="p.puuid || p.summoner_name"
              class="player-card"
              :class="{ is_winner: p.stats.win }"
            >
              <player-card :player="p" :bests="bests" :all-players="allPlayers" />
            </div>
          </div>
        </div>
      </div>

      <!-- 全场最佳汇总 -->
      <div class="bests-summary">
        <h4>全场之最</h4>
        <div class="bests-grid">
          <div v-for="b in bestsList" :key="b.label" class="best-item">
            <n-tag size="tiny" :bordered="false" :type="b.type">{{ b.label }}</n-tag>
            <span class="best-name">{{ b.player?.summoner_name || '-' }}</span>
            <span class="best-value">{{ b.value }}</span>
          </div>
        </div>
      </div>

      <!-- 英雄熟练度 -->
      <div v-if="Object.keys(game.champion_mastery).length" class="mastery-section">
        <h4>本局英雄熟练度</h4>
        <div class="mastery-grid">
          <div v-for="(m, cid) in game.champion_mastery" :key="cid" class="mastery-item">
            <span class="champ-id">{{ gds.champions[Number(cid)]?.name || `英雄${cid}` }}</span>
            <n-progress
              type="line"
              :percentage="m.level / 7 * 100"
              :height="8"
              :show-indicator="false"
              :color="m.level >= 7 ? '#e6c646' : m.level >= 5 ? '#a074c4' : '#4a9e4a'"
              style="width: 60px"
            />
            <span class="mastery-text">Lv{{ m.level }} {{ m.points?.toLocaleString() }}pts</span>
            <n-tag size="tiny" :bordered="false" v-if="m.highest_grade">{{ m.highest_grade }}</n-tag>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NTag, NIcon, NSpin, NProgress, useMessage
} from 'naive-ui'
import { ArrowBackOutline } from '@vicons/ionicons5'
import type { GameRecord, PlayerData, PlayerStats } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import { getGameModeName, getQueueName, getMapName } from '@shared/utils/mappings'
import { formatGameDuration, formatBestValue } from '@/utils/format'
import { findBestStat, findBestPlayer } from '@application/analysis-service'
import { loadGameDetail } from '@application/game-detail-service'
import { createMatchRepository } from '@application/ports'
import PlayerCard from '@/components/PlayerCard.vue'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const gds = useGameDataStore()

const game = ref<GameRecord | null>(null)
const loading = ref(true)

const gameId = computed(() => Number(route.params.gameId))

/** 根据来源决定返回目标：从分析页进入则返回分析页，否则返回战绩列表 */
const backRoute = computed(() => {
  if (route.query.from === 'analysis') {
    return { name: 'analysis' }
  }
  return { name: 'match-list' }
})

onMounted(async () => {
  console.log(`[LCU:GAME_DETAIL] 加载对局详情: gameId=${gameId.value}`)
  loading.value = true
  try {
    game.value = await loadGameDetail(createMatchRepository(window.lcuApi), gameId.value)
    if (game.value) {
      console.log(`[LCU:GAME_DETAIL] 对局加载完成: ${game.value.game_mode} #${game.value.game_id}, ${game.value.game_duration_min}min`)
    } else {
      console.warn(`[LCU:GAME_DETAIL] 未找到对局: ${gameId.value}`)
    }
  } catch (e: unknown) {
    console.error(`[LCU:GAME_DETAIL] 加载失败: ${errMsg(e)}`, e)
    message.error(`加载对局失败: ${errMsg(e)}`)
  } finally {
    loading.value = false
  }
})

/** 所有玩家（跨两队） */
const allPlayers = computed<PlayerData[]>(() => {
  if (!game.value) return []
  return [...game.value.blue_team.players, ...game.value.red_team.players]
})

const BEST_FIELDS: [string, (s: PlayerStats) => number][] = [
  ['damage_total_to_champs', s => s.damage.total_to_champs],
  ['damage_total_taken', s => s.damage.total_taken],
  ['survival_total_heal', s => s.survival.total_heal],
  ['survival_damage_self_mitigated', s => s.survival.damage_self_mitigated],
  ['survival_longest_time_living', s => s.survival.longest_time_living],
  ['cc_total_cc_dealt', s => s.cc.total_cc_dealt],
  ['cs_total', s => s.cs.total],
  ['economy_gold_earned', s => s.economy.gold_earned],
  ['vision_score', s => s.vision.score],
  ['objectives_turret_kills', s => s.objectives.turret_kills],
  ['kills', s => s.kills],
  ['assists', s => s.assists],
]

const BEST_LABELS: Record<string, string> = {
  damage_total_to_champs: '伤害最高', damage_total_taken: '承伤最高',
  survival_total_heal: '治疗最高', survival_damage_self_mitigated: '最硬选手',
  survival_longest_time_living: '不死战神', cc_total_cc_dealt: '控制最强',
  cs_total: '补刀最多', economy_gold_earned: '打钱最多',
  vision_score: '视野最高', objectives_turret_kills: '推塔最多',
  kills: '击杀最多', assists: '助攻最多',
}

const BEST_TAG_TYPES: Record<string, string> = {
  damage_total_to_champs: 'error', damage_total_taken: 'warning',
  survival_total_heal: 'success', survival_damage_self_mitigated: 'info',
  survival_longest_time_living: 'info', cc_total_cc_dealt: 'warning',
  cs_total: 'default', economy_gold_earned: 'warning',
  vision_score: 'info', objectives_turret_kills: 'default',
  kills: 'error', assists: 'success',
}

/** 全场最佳指标列表（供顶部汇总 + 传入子组件高亮） */
const bests = computed(() => {
  const all = allPlayers.value
  const b: Record<string, { player: PlayerData | null; value: number }> = {}
  for (const [key, getter] of BEST_FIELDS) {
    b[key] = { player: findBestPlayer(all, getter), value: findBestStat(all, getter) }
  }
  return b
})

const bestsList = computed(() => {
  return Object.entries(bests.value)
    .filter(([_, v]) => v.value > 0)
    .map(([key, v]) => ({
      key,
      label: BEST_LABELS[key] || key,
      type: BEST_TAG_TYPES[key] || 'default',
      player: v.player,
      value: formatBestValue(key, v.value),
    }))
})

</script>

<style scoped>
.game-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
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

.game-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.back-btn {
  flex-shrink: 0;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.game-id {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.game-time {
  font-size: 13px;
  color: var(--text-secondary);
}

.game-version {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: monospace;
}

.teams-area {
  display: flex;
  gap: 0;
  padding: 12px 16px;
  flex: 1;
  min-height: 0;
}

.team-panel {
  flex: 1;
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
}

.blue-panel {
  margin-right: 8px;
}

.red-panel {
  margin-left: 8px;
}

.team-panel.winner {
  border-color: rgba(200, 180, 60, 0.2);
  box-shadow: 0 0 20px rgba(200, 180, 60, 0.04);
}

.team-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.win-badge {
  font-size: 12px;
  font-weight: 700;
  color: #e6c646;
}

.lose-badge {
  font-size: 12px;
  color: var(--text-tertiary);
}

.team-stats-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.first-badge {
  color: #e6c646;
  font-weight: 500;
}

.player-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-card {
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg-section);
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.player-card.is_winner {
  border-color: rgba(200, 180, 60, 0.1);
  background: rgba(200, 180, 60, 0.02);
}

.bests-summary {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.bests-summary h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.bests-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.best-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.best-name {
  color: var(--text-primary);
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.best-value {
  color: var(--text-tertiary);
  font-family: monospace;
}

.mastery-section {
  padding: 12px 20px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.mastery-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.mastery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mastery-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.champ-id {
  color: var(--text-tertiary);
  width: 54px;
}

.mastery-text {
  color: var(--text-secondary);
  font-size: 11px;
}
</style>
