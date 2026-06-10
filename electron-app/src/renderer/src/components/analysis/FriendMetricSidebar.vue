<template>
  <div class="metric-sidebar">
    <div class="sidebar-title">好友指标</div>
    <div class="category-group">
      <div class="category-header" @click="$emit('update:collapsed', !collapsed)">
        <n-icon size="16" class="category-arrow" :class="{ expanded: !collapsed }">
          <chevron-forward-outline />
        </n-icon>
        <span class="category-label">基础数据</span>
        <span class="category-count">{{ metrics.length }}</span>
      </div>
      <div v-show="!collapsed" class="category-items">
        <div
          v-for="m in metrics"
          :key="m.key"
          class="metric-item"
          :class="{ active: selectedMetric === m.key }"
          @click="$emit('selectMetric', m.key)"
        >
          <span class="metric-dot" :class="m.colorClass"></span>
          <span class="metric-label">{{ m.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { ChevronForwardOutline } from '@vicons/ionicons5'
import type { FriendMetricDef } from '@domain/analysis/types'

defineProps<{
  metrics: FriendMetricDef[]
  selectedMetric: string | null
  collapsed: boolean
}>()

defineEmits<{
  'update:collapsed': [value: boolean]
  selectMetric: [key: string]
}>()
</script>

<style scoped>
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
</style>
