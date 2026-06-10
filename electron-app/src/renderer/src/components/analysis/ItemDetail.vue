<template>
  <div>
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
          <div class="detail-popover-players">
            <div class="detail-pop-title">购买过此装备的玩家</div>
            <div v-for="u in getItemUsers(item.itemId)" :key="u.playerName" class="detail-pop-row">
              <span class="detail-pop-name">{{ shortName(u.playerName) }}</span>
              <span class="detail-pop-count">{{ u.count }}次</span>
            </div>
          </div>
        </n-popover>
        <div v-if="globalItemFreq.length === 0" class="empty-hint">暂无装备数据</div>
      </div>
    </div>

    <div class="items-section">
      <h4>各玩家最爱装备</h4>
      <div class="player-items-list">
        <div v-for="p in playerFavoriteItems" :key="p.playerName" class="player-item-row detail-row">
          <LcuImage :src="profileIconUrl(p.profileIconId)" :size="24" class="fav-avatar" />
          <span class="fav-player-name">{{ shortName(p.playerName) }}</span>
          <ItemDisplay :item-id="p.itemId" :size="36" />
          <span class="fav-item-name detail-name">{{ p.itemName }}</span>
          <span class="fav-count detail-freq">{{ p.count }}/{{ p.totalGames }}局</span>
        </div>
        <div v-if="playerFavoriteItems.length === 0" class="empty-hint">暂无装备数据</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import type { GlobalItemFreq, PlayerFavItem } from '@domain/analysis/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import '@/assets/detail-shared.css'

defineProps<{
  globalItemFreq: GlobalItemFreq[]
  playerFavoriteItems: PlayerFavItem[]
  getItemUsers: (id: number) => { playerName: string; count: number }[]
}>()
</script>

