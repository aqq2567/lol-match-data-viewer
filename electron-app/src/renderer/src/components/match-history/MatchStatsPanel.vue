<template>
  <div class="stats-panel">
    <!-- 综合统计 -->
    <div class="section">
      <div class="section-title">综合统计</div>
      <div class="stat-item">
        <span class="stat-label">总场次</span>
        <span class="stat-value">{{ totalGamesDisplay }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">当前页</span>
        <span class="stat-value">第 {{ currentPage }} 页（{{ games.length }} 场）</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">平均 KDA</span>
        <span class="stat-value">{{ avgKda }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">胜率</span>
        <span class="stat-value">
          {{ winCount }}W {{ loseCount }}L
          <span :style="{ color: Number(winRate) >= 50 ? '#5ca9f1' : '#e96025' }">
            ({{ winRate }}%)
          </span>
        </span>
      </div>
    </div>

    <!-- 常用英雄 -->
    <div class="section" v-if="frequentChampions.length > 0">
      <div class="section-title">常用英雄</div>
      <div class="champion-grid">
        <div
          v-for="c in frequentChampions"
          :key="c.championId"
          class="champ-item"
          :title="gds.champions[c.championId]?.name"
        >
          <ChampionIcon
            class="champ-icon"
            :champion-id="c.championId"
            :size="32"
            round
          />
          <div class="champ-count">{{ c.count }}</div>
        </div>
      </div>
    </div>

    <!-- 最近队友 -->
    <div class="section" v-if="frequentTeammates.length > 0">
      <div class="section-title">近期队友</div>
      <div
        v-for="m in frequentTeammates"
        :key="m.puuid"
        class="player-row"
      >
        <LcuImage
          class="player-icon"
          :src="`/lol-game-data/assets/v1/profile-icons/${m.profileIconId}.jpg`"
          :size="16"
        />
        <span class="player-name">{{ getPlayerDisplayName(m) }}</span>
        <span class="player-count">{{ m.count }}次</span>
      </div>
    </div>

    <!-- 最近对手 -->
    <div class="section" v-if="frequentOpponents.length > 0">
      <div class="section-title">近期对手</div>
      <div
        v-for="m in frequentOpponents"
        :key="m.puuid"
        class="player-row"
      >
        <LcuImage
          class="player-icon"
          :src="`/lol-game-data/assets/v1/profile-icons/${m.profileIconId}.jpg`"
          :size="16"
        />
        <span class="player-name">{{ getPlayerDisplayName(m) }}</span>
        <span class="player-count">{{ m.count }}次</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameSummary } from '@shared/types'
import { getPlayerDisplayName } from '@shared/utils/mappings'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { useGameDataStore } from '@/stores/game-data'

const gds = useGameDataStore()

const props = defineProps<{
  currentPage: number
  totalGames: number
  pageSize: number
  games: GameSummary[]
  selfPuuid: string
  loading: boolean
}>()

/** 总场次显示 */
const totalGamesDisplay = computed(() => {
  if (props.totalGames > 0 && props.totalGames > props.games.length) {
    return `${props.totalGames} 场`
  }
  if (props.games.length < props.pageSize) {
    return `${(props.currentPage - 1) * props.pageSize + props.games.length} 场`
  }
  return `${(props.currentPage - 1) * props.pageSize + props.games.length}+ 场`
})

/** 平均 KDA */
const avgKda = computed(() => {
  if (props.games.length === 0) return '-'
  const sum = props.games.reduce((s, g) => s + g.kdaRatio, 0)
  return (sum / props.games.length).toFixed(2)
})

/** 胜场/负场/胜率 */
const winCount = computed(() => props.games.filter(g => g.win).length)
const loseCount = computed(() => props.games.filter(g => !g.win && g.gameMode !== 'PRACTICETOOL').length)
const winRate = computed(() => {
  const total = winCount.value + loseCount.value
  if (total === 0) return '0'
  return (winCount.value / total * 100).toFixed(0)
})

/** 常用英雄 */
const frequentChampions = computed(() => {
  const map: Record<number, number> = {}
  for (const g of props.games) {
    map[g.championId] = (map[g.championId] || 0) + 1
  }
  return Object.entries(map)
    .map(([id, count]) => ({ championId: Number(id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})

interface PlayerFreq {
  puuid: string
  gameName: string
  summonerName: string
  profileIconId: number
  count: number
}

function countPlayerFreq(predicate: (g: GameSummary) => { puuid: string; gameName: string; summonerName: string; profileIconId: number }[]): PlayerFreq[] {
  const map = new Map<string, PlayerFreq>()
  for (const g of props.games) {
    for (const p of predicate(g)) {
      if (p.puuid === props.selfPuuid) continue
      const existing = map.get(p.puuid)
      if (existing) {
        existing.count++
      } else {
        map.set(p.puuid, { ...p, count: 1 })
      }
    }
  }
  return Array.from(map.values())
    .filter(f => f.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

const frequentTeammates = computed(() =>
  countPlayerFreq(g => {
    const selfTeam = g.blueParticipants.some(p => p.puuid === props.selfPuuid) ? g.blueParticipants : g.redParticipants
    return selfTeam.filter(p => p.puuid !== props.selfPuuid)
  })
)

const frequentOpponents = computed(() =>
  countPlayerFreq(g => {
    const selfTeam = g.blueParticipants.some(p => p.puuid === props.selfPuuid) ? g.blueParticipants : g.redParticipants
    const oppTeam = selfTeam === g.blueParticipants ? g.redParticipants : g.blueParticipants
    return oppTeam
  })
)
</script>

<style lang="less" scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section {
  padding: 8px 16px;
  background-color: var(--section-color);
  border-radius: 4px;
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #dcdcdc;
  &:not(:last-child) { margin-bottom: 3px; }

  .stat-label {
    font-size: 13px;
    color: var(--text-secondary);
  }
  .stat-value {
    font-size: 13px;
    color: var(--text-secondary);
    text-align: right;
  }
}

.champion-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .champ-item {
    position: relative;
    width: 32px;
    height: 32px;

    .champ-icon {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: var(--bg-hover);
    }
    .champ-count {
      position: absolute;
      bottom: -2px;
      right: -2px;
      font-size: 10px;
      color: #fff;
      background-color: rgba(0, 0, 0, 0.7);
      min-width: 14px;
      height: 14px;
      line-height: 14px;
      text-align: center;
      border-radius: 50%;
      padding: 0 3px;
    }
  }
}

.player-row {
  display: flex;
  align-items: center;
  &:not(:last-child) { margin-bottom: 3px; }

  .player-icon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background-color: var(--bg-hover);
    margin-right: 6px;
    flex-shrink: 0;
  }
  .player-name {
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-count {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-left: 4px;
    flex-shrink: 0;
  }
}
</style>
