<template>
  <div class="ranking-section">
    <h4>{{ title }}</h4>
    <div class="custom-rank-table">
      <div class="rt-body" :style="{ maxHeight: tableMaxHeight + 'px' }">
        <div
          v-for="(row, idx) in ranking"
          :key="row.playerName"
          class="rt-row table-row-transition"
          :class="{
            'rt-row-top': idx === 0,
            'rt-row-bottom': highlightBottom && idx === ranking.length - 1,
          }"
        >
          <span class="rt-col-rank" :class="rankClass(idx)">{{ idx + 1 }}</span>
          <span class="rt-col-player">
            <LcuImage :src="profileIconUrl(row.profileIconId)" :size="32" class="rt-avatar" />
            <span class="rt-name">{{ shortName(row.playerName) }}</span>
          </span>
          <span class="rt-bar-track">
            <span class="rt-bar-fill" :style="{ width: barPercent(row.total, maxValue) }"></span>
            <span class="rt-bar-val">{{ fmt(row.total) }}</span>
          </span>
          <span
            v-for="r in (row.raw || [])"
            :key="r.label"
            class="rt-raw-tag"
          ><b>{{ fmtNum(r.value) }}</b> {{ r.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MetricRankEntry } from '@domain/analysis/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import { formatCompactNumber as fmtNum } from '@shared/utils/mappings'

defineProps<{
  title: string
  ranking: MetricRankEntry[]
  maxValue: number
  fmt: (v: number) => string
  tableMaxHeight: number
  highlightBottom?: boolean
}>()

function barPercent(value: number, max: number): string {
  return max > 0 ? (value / max * 100).toFixed(1) + '%' : '0%'
}

function rankClass(idx: number): string {
  if (idx === 0) return 'rank-gold'
  if (idx === 1) return 'rank-silver'
  if (idx === 2) return 'rank-bronze'
  return ''
}
</script>

<style scoped>
.ranking-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ranking-section h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
  letter-spacing: 0.02em;
}

.ranking-section h4::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 14px;
  background: var(--text-secondary);
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
  margin-top: -1px;
}

.custom-rank-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  overflow: hidden;
  box-shadow: var(--card-shadow);
}

.rt-body {
  overflow-y: auto;
  padding: 8px 0;
}

.rt-row {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  gap: 12px;
  transition: background 0.15s ease;
}

.rt-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.rt-row.rt-row-top {
  background: rgba(232, 168, 64, 0.05);
}

.rt-row.rt-row-bottom {
  background: rgba(232, 64, 87, 0.03);
}

.rt-col-rank {
  width: 28px;
  flex-shrink: 0;
  text-align: center;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-tertiary);
  font-family: var(--font-number);
}

.rt-col-rank.rank-gold {
  color: var(--accent-gold);
  font-weight: 800;
  font-size: var(--text-lg);
  text-shadow: 0 0 10px rgba(232, 168, 64, 0.4);
  transform: translateX(-2px);
}

.rt-col-rank.rank-silver {
  color: #a0a8b0;
  font-weight: 700;
  font-size: var(--text-base);
  text-shadow: 0 0 8px rgba(160, 168, 176, 0.3);
}

.rt-col-rank.rank-bronze {
  color: #b08860;
  font-weight: 700;
  font-size: var(--text-base);
  text-shadow: 0 0 8px rgba(176, 136, 96, 0.3);
}

.rt-col-player {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-avatar {
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.rt-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rt-bar-track {
  flex: 1;
  height: 26px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
}

.rt-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(96, 160, 220, 0.4), rgba(96, 160, 220, 0.25));
  border-radius: 4px;
  min-width: 0;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.rt-row.rt-row-top .rt-bar-fill {
  background: linear-gradient(90deg, rgba(232, 168, 64, 0.55), rgba(232, 168, 64, 0.3));
}

.rt-row.rt-row-bottom .rt-bar-fill {
  background: linear-gradient(90deg, rgba(232, 64, 87, 0.4), rgba(232, 64, 87, 0.2));
}

.rt-bar-val {
  position: relative;
  z-index: 1;
  margin-left: auto;
  padding-right: 10px;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  font-family: var(--font-number);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}

.rt-raw-tag {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.rt-raw-tag b {
  color: var(--text-secondary);
  font-family: var(--font-number);
}
</style>
