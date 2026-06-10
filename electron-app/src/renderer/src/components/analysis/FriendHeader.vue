<template>
  <div class="friend-header">
    <n-button text @click="$emit('back')" class="back-btn">
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
        <span class="stat-num win">{{ rateDisplay(summary.bestWinRate.rate) }}</span>
        <span class="stat-label">{{ shortName(summary.bestWinRate.name, 10) }} 胜率</span>
      </div>
    </div>
    <n-button size="small" @click="$emit('refresh')" :loading="loading">
      <template #icon><n-icon><refresh-outline /></n-icon></template>
      刷新
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import { ArrowBackOutline, RefreshOutline } from '@vicons/ionicons5'
import type { FriendSummary } from '@domain/analysis/types'
import { shortName } from '@/utils/display'
import { rateDisplay } from '@/utils/format'

defineProps<{
  summary: FriendSummary
  loading: boolean
}>()

defineEmits<{
  back: []
  refresh: []
}>()
</script>

<style scoped>
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
</style>
