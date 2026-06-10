<template>
  <div class="ranking-section">
    <h4>{{ selectedCategory?.label }} — 好友排名</h4>
    <n-data-table
      :key="'friend-' + themeKey"
      :columns="friendColumns"
      :data="sortedByMetric"
      :row-key="(row: FriendStats) => row.puuid"
      size="medium"
      striped
      :max-height="tableMaxHeight"
      virtual-scroll
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { NDataTable } from 'naive-ui'
import type { FriendStats, FriendMetricDef } from '@domain/analysis/types'
import { shortName, computeTableMaxHeight } from '@/utils/display'
import { daysAgo, rateDisplay } from '@/utils/format'

const props = defineProps<{
  sortedByMetric: FriendStats[]
  selectedCategory: FriendMetricDef | null
  selectedMetric: string | null
  isItemMetric: boolean
  themeKey: number
}>()

const tableMaxHeight = computed(() => {
  return computeTableMaxHeight(props.sortedByMetric.length)
})

const friendColumns = computed(() => {
  const cat = props.selectedCategory
  const mutedColor = 'var(--text-tertiary)'
  const cols: any[] = [
    {
      title: '#',
      key: 'rank',
      width: 48,
      render: (_row: FriendStats, idx: number) =>
        h('span', {
          style: idx < 3
            ? 'font-weight:700;color:#e8a840;font-size:14px'
            : `color:${mutedColor};font-size:14px`
        }, String(idx + 1)),
    },
    {
      title: '召唤师',
      key: 'name',
      width: 140,
      render: (row: FriendStats) =>
        h('span', { style: 'font-weight:600;font-size:14px' }, shortName(row.name, 10)),
    },
  ]

  if (props.isItemMetric && cat) {
    cols.push(
      {
        title: cat.label,
        key: 'metricValue',
        width: 95,
        render: (row: FriendStats) => {
          const val = cat.getter(row)
          return h('span', {
            style: 'font-weight:700;font-family:monospace;font-size:14px;color:var(--text-primary)'
          }, cat.fmt(val))
        },
      },
      {
        title: '出的场次',
        key: 'itemGames',
        width: 85,
        render: (row: FriendStats) => {
          const v = props.selectedMetric === 'collectorRatio' ? row.collectorGames : row.heartsteelGames
          return h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(v))
        },
      },
      {
        title: '总场次',
        key: 'gamesTogether',
        width: 75,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(row.gamesTogether)),
      },
      {
        title: '胜率',
        key: 'winRate',
        width: 80,
        render: (row: FriendStats) => {
          const r = row.winRate
          const color = r >= 0.55 ? '#2ea86c' : r >= 0.45 ? 'var(--text-primary)' : '#e84057'
          return h('span', { style: `font-weight:600;font-family:monospace;font-size:14px;color:${color}` }, rateDisplay(r))
        },
      },
    )
  } else {
    cols.push(
      {
        title: '指标值',
        key: 'metricValue',
        width: 100,
        render: (row: FriendStats) => {
          if (!cat) return ''
          const val = cat.getter(row)
          let color = 'var(--text-primary)'
          if (cat.key === 'winRate') {
            color = val >= 0.55 ? '#2ea86c' : val >= 0.45 ? 'var(--text-primary)' : '#e84057'
          } else if (cat.key === 'winDelta') {
            color = val > 0.02 ? '#2ea86c' : val < -0.02 ? '#e84057' : 'var(--text-tertiary)'
          }
          return h('span', {
            style: `font-weight:700;font-family:monospace;font-size:14px;color:${color}`
          }, cat.fmt(val))
        },
      },
      {
        title: '一起场次',
        key: 'gamesTogether',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:14px;font-weight:600' }, String(row.gamesTogether)),
      },
      {
        title: '一起时胜率',
        key: 'winRate',
        width: 100,
        render: (row: FriendStats) => {
          const r = row.winRate
          const color = r >= 0.55 ? '#2ea86c' : r >= 0.45 ? 'var(--text-primary)' : '#e84057'
          return h('span', { style: `font-weight:600;font-family:monospace;font-size:14px;color:${color}` }, rateDisplay(r))
        },
      },
      {
        title: '个人胜率',
        key: 'soloWinRate',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-family:monospace;font-size:13px;color:var(--text-tertiary)' }, rateDisplay(row.soloWinRate)),
      },
      {
        title: '最近一起',
        key: 'lastPlayed',
        width: 85,
        render: (row: FriendStats) =>
          h('span', { style: 'font-size:12px;color:var(--text-tertiary)' }, daysAgo(row.lastPlayedTime)),
      },
    )
  }

  return cols
})
</script>

<style scoped>
.ranking-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ranking-section h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
</style>
