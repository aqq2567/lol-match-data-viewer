<template>
  <div class="player-card-root">
    <!-- 左侧: 英雄头像 + 身份 + KDA -->
    <div class="pc-left">
      <div class="pc-identity">
        <ChampionIcon
          class="pc-champion"
          :champion-id="player.champion_id"
          :size="32"
          round
        />
        <div class="pc-name-block">
          <div class="pc-name" :title="player.summoner_name">
            {{ shortName(player.summoner_name) }}
          </div>
          <div class="pc-champion-name">
            {{ gds.champions[player.champion_id]?.name || `英雄${player.champion_id}` }}
          </div>
        </div>
      </div>
      <div class="pc-kda">
        <span class="kda-num">{{ player.stats.kills }}</span>
        <span class="kda-sep">/</span>
        <span class="kda-num">{{ player.stats.deaths }}</span>
        <span class="kda-sep">/</span>
        <span class="kda-num">{{ player.stats.assists }}</span>
        <span class="kda-ratio">({{ player.stats.kda }})</span>
      </div>
      <div class="pc-meta">
        <span>Lv{{ player.stats.champ_level }}</span>
        <span style="color:rgba(255,255,255,0.2);margin:0 4px">|</span>
        <span>{{ player.stats.position.team_position || player.stats.position.lane || '-' }}</span>
      </div>
    </div>

    <!-- 中间: 关键指标（高亮的格子） -->
    <div class="pc-stats">
      <div class="stat-cell" :class="{ highlight: isBest('damage_total_to_champs') }"
        title="对英雄伤害">
        <span class="stat-label">伤害</span>
        <span class="stat-value">{{ fmtNum(player.stats.damage.total_to_champs) }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('damage_total_taken') }"
        title="承伤">
        <span class="stat-label">承伤</span>
        <span class="stat-value">{{ fmtNum(player.stats.damage.total_taken) }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('survival_total_heal') }"
        title="治疗量">
        <span class="stat-label">治疗</span>
        <span class="stat-value">{{ fmtNum(player.stats.survival.total_heal) }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('survival_damage_self_mitigated') }"
        title="自减伤">
        <span class="stat-label">减伤</span>
        <span class="stat-value">{{ fmtNum(player.stats.survival.damage_self_mitigated) }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('cc_time_cc_others') }"
        title="控制时长(秒)">
        <span class="stat-label">控制</span>
        <span class="stat-value">{{ player.stats.cc.time_cc_others }}s</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('cs_total') }"
        title="补刀">
        <span class="stat-label">补刀</span>
        <span class="stat-value">{{ player.stats.cs.total }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('economy_gold_earned') }"
        title="金币">
        <span class="stat-label">金币</span>
        <span class="stat-value">{{ fmtNum(player.stats.economy.gold_earned) }}</span>
      </div>
      <div class="stat-cell" :class="{ highlight: isBest('vision_score') }"
        title="视野分">
        <span class="stat-label">视野</span>
        <span class="stat-value">{{ player.stats.vision.score }}</span>
      </div>
    </div>

    <!-- 右侧: 物品 + 符文 + 召唤师技能 -->
    <div class="pc-right">
      <div class="pc-items">
        <ItemDisplay
          v-for="(item, idx) in validItems"
          :key="idx"
          :item-id="item"
          :size="22"
        />
      </div>
      <div class="pc-spells">
        <SummonerSpellDisplay :spell-id="player.stats.summoner_spells.spell1 ?? undefined" :size="18" />
        <SummonerSpellDisplay :spell-id="player.stats.summoner_spells.spell2 ?? undefined" :size="18" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerData } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'

const gds = useGameDataStore()

const props = defineProps<{
  player: PlayerData
  bests: Record<string, { player: PlayerData | null; value: number }>
  allPlayers: PlayerData[]
}>()

function shortName(name: string): string {
  if (!name) return '?'
  return name.length > 12 ? name.slice(0, 11) + '…' : name
}

function fmtNum(n: number | undefined | null): string {
  if (n == null || n === 0) return '0'
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const validItems = computed(() =>
  props.player.stats.items.filter(i => i && i !== 0).slice(0, 7)
)

function isBest(key: string): boolean {
  const b = props.bests[key]
  if (!b || !b.player) return false
  return b.player === props.player
}
</script>

<style scoped>
.player-card-root {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.pc-left {
  width: 150px;
  flex-shrink: 0;
  min-width: 0;
}

.pc-identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pc-champion {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--bg-hover);
  flex-shrink: 0;
}

.pc-name-block {
  min-width: 0;
}

.pc-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pc-champion-name {
  font-size: 10px;
  color: var(--text-tertiary);
}

.pc-kda {
  display: flex;
  align-items: center;
  gap: 1px;
  margin: 1px 0;
}

.kda-num {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 13px;
}

.kda-sep {
  color: var(--text-muted);
  margin: 0 1px;
}

.kda-ratio {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-left: 3px;
}

.pc-meta {
  font-size: 10px;
  color: var(--text-tertiary);
}

/* 中间指标格子 */
.pc-stats {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
  padding: 2px 4px;
  border-radius: 4px;
  background: var(--bg-card);
  transition: all 0.15s;
}

.stat-cell.highlight {
  background: rgba(200, 180, 60, 0.12);
  box-shadow: 0 0 6px rgba(200, 180, 60, 0.08);
}

.stat-label {
  font-size: 9px;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.stat-value {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.stat-cell.highlight .stat-value {
  color: #e6c646;
}

.stat-cell.highlight .stat-label {
  color: rgba(230, 198, 70, 0.6);
}

/* 右侧物品 + 技能 */
.pc-right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.pc-items {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pc-spells {
  display: flex;
  gap: 4px;
}
</style>
