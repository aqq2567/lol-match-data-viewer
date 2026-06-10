<template>
  <div>
    <div class="top-panel">
      <div class="advanced-best-worst" v-if="ranking.length">
        <div class="abw-card abw-best">
          <div class="abw-tag best">{{ bestTitle }}</div>
          <LcuImage :src="profileIconUrl(ranking[0].profileIconId)" :size="60" class="abw-avatar" />
          <div class="abw-name">{{ shortName(ranking[0].playerName) }}</div>
          <div class="abw-value">{{ fmt(ranking[0].total) }}</div>
          <div class="abw-meta">{{ ranking[0].gameCount }}局 · 胜率{{ ranking[0].winRate.toFixed(0) }}%</div>
        </div>
        <div class="abw-divider"></div>
        <div class="abw-card abw-worst">
          <div class="abw-tag worst">{{ worstTitle }}</div>
          <LcuImage :src="profileIconUrl(ranking[ranking.length - 1].profileIconId)" :size="60" class="abw-avatar" />
          <div class="abw-name">{{ shortName(ranking[ranking.length - 1].playerName) }}</div>
          <div class="abw-value">{{ fmt(ranking[ranking.length - 1].total) }}</div>
          <div class="abw-meta">{{ ranking[ranking.length - 1].gameCount }}局 · 胜率{{ ranking[ranking.length - 1].winRate.toFixed(0) }}%</div>
        </div>
      </div>
    </div>

    <RankingTable
      :title="`${label} — 玩家排名`"
      :ranking="ranking"
      :max-value="maxValue"
      :fmt="fmt"
      :table-max-height="tableMaxHeight"
      highlight-bottom
    />
  </div>
</template>

<script setup lang="ts">
import type { MetricRankEntry } from '@domain/analysis/types'
import type { MetricDef } from '@shared/utils/mode-analysis-config'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import RankingTable from './RankingTable.vue'

defineProps<{
  ranking: MetricRankEntry[]
  maxValue: number
  bestTitle: string
  worstTitle: string
  label: string
  fmt: (v: number) => string
  tableMaxHeight: number
}>()
</script>

<style scoped>
.top-panel {
  flex: 0 0 auto;
}

.advanced-best-worst {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  box-shadow: var(--card-shadow);
  position: relative;
  overflow: hidden;
}

.advanced-best-worst::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  background: radial-gradient(ellipse at center bottom, var(--glow-gold), transparent 60%);
  pointer-events: none;
}

.advanced-best-worst::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 50%;
  background: radial-gradient(ellipse at center bottom, var(--glow-red), transparent 60%);
  pointer-events: none;
}

.abw-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.abw-divider {
  width: 1px;
  height: 110px;
  background: var(--glass-border);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.abw-tag {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 14px;
  border-radius: 10px;
  letter-spacing: 0.05em;
}

.abw-tag.best {
  color: var(--accent-gold);
  background: rgba(232, 168, 64, 0.12);
  border: 1px solid rgba(232, 168, 64, 0.2);
}

.abw-tag.worst {
  color: var(--accent-red);
  background: rgba(232, 64, 87, 0.12);
  border: 1px solid rgba(232, 64, 87, 0.2);
}

.abw-avatar {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
}

.abw-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.abw-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  font-family: var(--font-number);
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.abw-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
</style>
