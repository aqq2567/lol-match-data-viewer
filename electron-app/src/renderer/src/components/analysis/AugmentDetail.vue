<template>
  <div>
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
          <div class="detail-popover-players">
            <div class="detail-pop-title">选择过此海克斯的玩家</div>
            <div v-for="u in getAugmentUsers(aug.id)" :key="u.playerName" class="detail-pop-row">
              <span class="detail-pop-name">{{ shortName(u.playerName) }}</span>
              <span class="detail-pop-count">{{ u.count }}次</span>
            </div>
          </div>
        </n-popover>
        <div v-if="globalAugmentFreq.length === 0" class="empty-hint">该模式无海克斯数据</div>
      </div>
    </div>

    <div class="items-section">
      <h4>各玩家最爱的海克斯</h4>
      <div class="player-items-list">
        <div v-for="p in sortedPlayerFavoriteAugments" :key="p.playerName" class="player-item-row detail-row">
          <LcuImage :src="profileIconUrl(p.profileIconId)" :size="24" class="fav-avatar" />
          <span class="fav-player-name">{{ shortName(p.playerName) }}</span>
          <AugmentDisplay :augment-id="p.augmentId" :size="36" />
          <span class="fav-item-name detail-name">{{ p.augmentName }}</span>
          <span class="fav-count detail-freq">{{ p.count }}/{{ p.totalGames }}局</span>
        </div>
        <div v-if="sortedPlayerFavoriteAugments.length === 0" class="empty-hint">该模式无海克斯数据</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import type { GlobalAugmentFreq, PlayerFavAug } from '@domain/analysis/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import '@/assets/detail-shared.css'

defineProps<{
  globalAugmentFreq: GlobalAugmentFreq[]
  sortedPlayerFavoriteAugments: PlayerFavAug[]
  getAugmentUsers: (id: number) => { playerName: string; count: number }[]
}>()
</script>

