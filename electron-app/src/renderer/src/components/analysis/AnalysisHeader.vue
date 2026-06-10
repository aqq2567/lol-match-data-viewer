<template>
  <div class="analysis-header">
    <div class="header-left">
      <n-button text @click="$router.push({ name: 'match-list' })" class="back-btn">
        <template #icon><n-icon><arrow-back-outline /></n-icon></template>
        返回列表
      </n-button>
      <div class="header-mode-name">{{ modeDisplayName }}</div>
    </div>
    <div class="header-stats">
      <n-popover
        v-if="!canFilterTeammates"
        trigger="hover"
        placement="bottom"
        :show-arrow="false"
      >
        <template #trigger>
          <div class="teammate-toggle disabled">
            <span class="toggle-label">只看队友</span>
            <n-switch :value="false" disabled size="small" />
          </div>
        </template>
        <span class="toggle-tip">{{ disableTeammatesReason }}</span>
      </n-popover>
      <div v-else class="teammate-toggle">
        <span class="toggle-label">只看队友</span>
        <n-switch :value="onlyTeammates" size="small" @update:value="$emit('update:onlyTeammates', $event)" />
      </div>
      <div class="stat-card">
        <span class="stat-card-num">{{ gameCount }}</span>
        <span class="stat-card-label">分析局数</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-num win-loss">{{ winCount }}<span class="win-letter">W</span> <span class="lose-letter">{{ loseCount }}L</span></span>
        <span class="stat-card-label">胜负</span>
      </div>
      <div class="stat-card" :class="{ 'wr-good': winRate >= 50, 'wr-bad': winRate < 50 }">
        <span class="stat-card-num">{{ winRate.toFixed(1) }}<span class="wr-pct">%</span></span>
        <span class="stat-card-label">胜率</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon, NPopover, NSwitch } from 'naive-ui'
import { ArrowBackOutline } from '@vicons/ionicons5'

defineProps<{
  modeDisplayName: string
  canFilterTeammates: boolean
  disableTeammatesReason: string
  onlyTeammates: boolean
  gameCount: number
  winCount: number
  loseCount: number
  winRate: number
}>()

defineEmits<{
  'update:onlyTeammates': [value: boolean]
}>()
</script>

<style scoped>
.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--glass-bg);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-mode-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.header-stats {
  display: flex;
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 10px 20px;
  min-width: 90px;
}

.stat-card-num {
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--font-number);
  letter-spacing: -0.02em;
}

.stat-card-num .wr-pct {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-left: 1px;
  color: var(--text-secondary);
}

.stat-card-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.stat-card .win-loss {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-card .win-letter {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--win-color);
}

.stat-card .lose-letter {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--lose-color);
}

.stat-card.wr-good {
  border-color: rgba(46, 168, 108, 0.25);
  box-shadow: 0 0 12px rgba(46, 168, 108, 0.08);
}

.stat-card.wr-good .stat-card-num {
  color: var(--accent-green);
}

.stat-card.wr-bad {
  border-color: rgba(232, 64, 87, 0.25);
  box-shadow: 0 0 12px rgba(232, 64, 87, 0.08);
}

.stat-card.wr-bad .stat-card-num {
  color: var(--accent-red);
}

.back-btn {
  font-size: var(--text-sm);
}

.teammate-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: var(--radius-md);
  transition: background 0.15s;
}

.teammate-toggle:hover {
  background: var(--bg-hover);
}

.teammate-toggle.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.toggle-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
}
</style>
