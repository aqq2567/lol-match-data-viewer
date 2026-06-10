<template>
  <div class="metric-sidebar">
    <div class="sidebar-title">数据指标</div>
    <div class="category-group">
      <div class="category-header" @click="$emit('update:basicDataCollapsed', !basicDataCollapsed)">
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
          @click="$emit('selectMetric', cat.key)"
        >
          <span class="metric-dot" :class="cat.colorClass"></span>
          <span class="metric-label">{{ cat.label }}</span>
        </div>
      </div>
    </div>
    <div class="category-group">
      <div class="category-header" @click="$emit('update:advancedDataCollapsed', !advancedDataCollapsed)">
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
          @click="$emit('selectMetric', cat.key)"
        >
          <span class="metric-dot" :class="cat.colorClass"></span>
          <span class="metric-label">{{ cat.label }}</span>
        </div>
        <div v-if="advancedMetrics.length === 0" class="empty-category">暂无高阶指标</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { ChevronForwardOutline } from '@vicons/ionicons5'
import type { MetricDef } from '@shared/utils/mode-analysis-config'

defineProps<{
  basicMetrics: MetricDef[]
  advancedMetrics: MetricDef[]
  selectedMetric: string | null
  basicDataCollapsed: boolean
  advancedDataCollapsed: boolean
}>()

defineEmits<{
  'update:basicDataCollapsed': [value: boolean]
  'update:advancedDataCollapsed': [value: boolean]
  selectMetric: [key: string]
}>()
</script>

<style scoped>
.metric-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--header-bg);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 10px 0;
}

.sidebar-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  padding: 8px 16px 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  border-left: 2px solid transparent;
  margin: 0 8px;
  border-radius: var(--radius-sm);
}

.metric-item:hover {
  background: var(--bg-hover);
}

.metric-item.active {
  background: var(--glass-bg);
  border-left-color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--glass-border);
}

.metric-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.metric-dot.cat-red    { background: #e84057; box-shadow: 0 0 6px rgba(232, 64, 87, 0.4); }
.metric-dot.cat-orange { background: #f0a040; box-shadow: 0 0 6px rgba(240, 160, 64, 0.4); }
.metric-dot.cat-green  { background: #2ea86c; box-shadow: 0 0 6px rgba(46, 168, 108, 0.4); }
.metric-dot.cat-gold   { background: #c8aa2e; box-shadow: 0 0 6px rgba(200, 170, 46, 0.4); }
.metric-dot.cat-blue   { background: #3c8cd0; box-shadow: 0 0 6px rgba(60, 140, 208, 0.4); }
.metric-dot.cat-purple { background: #8b5cf6; box-shadow: 0 0 6px rgba(139, 92, 246, 0.4); }

.metric-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.metric-item.active .metric-label {
  color: var(--text-primary);
  font-weight: 600;
}

.category-group {
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.category-header:hover {
  background: var(--bg-hover);
}

.category-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.category-arrow.expanded {
  transform: rotate(90deg);
}

.category-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.category-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--glass-bg);
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 600;
  font-family: var(--font-number);
}

.category-items .metric-item {
  padding-left: 30px;
  margin-right: 4px;
}

.empty-category {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 16px 12px 28px;
  text-align: center;
}
</style>
