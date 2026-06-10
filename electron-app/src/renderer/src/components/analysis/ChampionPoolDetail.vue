<template>
  <div>
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
          <div class="detail-popover-players">
            <div class="detail-pop-title">使用过此英雄的玩家</div>
            <div v-for="u in getChampionUsers(champ.championId)" :key="u.playerName" class="detail-pop-row">
              <span class="detail-pop-name">{{ shortName(u.playerName) }}</span>
              <span class="detail-pop-count">{{ u.count }}次</span>
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
            <span class="champ-name-main">{{ championName(p.mostPlayedChampionId) }}</span>
            <span class="champ-meta">
              {{ p.mostPlayedChampionCount }}/{{ p.totalGames }}局 ·
              选取率{{ rateDisplay(p.mostPlayedChampionCount / p.totalGames) }}
              · 胜率<span :class="p.favChampWins / p.mostPlayedChampionCount >= 0.5 ? 'win-green' : 'win-red'">{{ rateDisplay(p.favChampWins / p.mostPlayedChampionCount) }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import type { GlobalChampFreq, PlayerChampionPool } from '@domain/analysis/types'
import { useGameDataStore } from '@/stores/game-data'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { shortName } from '@/utils/display'
import { championIcon as championIconUrl, profileIcon as profileIconUrl } from '@/utils/lcu-images'
import { rateDisplay } from '@/utils/format'
import '@/assets/detail-shared.css'

const gds = useGameDataStore()

defineProps<{
  globalChampionFreq: GlobalChampFreq[]
  playerChampionPools: PlayerChampionPool[]
  getChampionUsers: (id: number) => { playerName: string; count: number }[]
}>()

function championName(id: number): string {
  return gds.champions[id]?.name || '英雄#' + id
}
</script>

<style scoped>
.champ-row {
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
  background: var(--glass-bg);
  border: 1px solid rgba(60, 140, 208, 0.15);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  box-shadow: 0 0 12px rgba(60, 140, 208, 0.06);
}

.pool-badge-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--accent-blue);
  font-family: var(--font-number);
  line-height: 1;
}

.pool-badge-label {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
