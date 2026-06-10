<template>
  <div class="top-panel">
    <div class="podium-section" v-if="podium.length">
      <h4>{{ selectedCategory?.label }} — 领奖台</h4>
      <div class="podium-row">
        <!-- 第 2 名 -->
        <n-popover v-if="podium[1]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-2">
              <LcuImage :src="profileIconUrl(podium[1].profileIconId)" :size="52" class="spot-avatar" />
              <div class="spot-name">{{ shortName(podium[1].name, 10) }}</div>
              <div class="spot-value">{{ podium[1].displayValue }}</div>
              <div class="spot-stand stand-silver"><span class="spot-rank">2</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <template v-if="isItemMetric">
              <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? podium[1].collectorGames : podium[1].heartsteelGames }}</b></div>
              <div class="pop-item">总场次 <b>{{ podium[1].gamesTogether }}</b></div>
              <div class="pop-item">胜率 <b>{{ rateDisplay(podium[1].winRate) }}</b></div>
            </template>
            <template v-else>
              <div class="pop-item">一起场次 <b>{{ podium[1].gamesTogether }}</b></div>
              <div class="pop-item">一起胜率 <b>{{ rateDisplay(podium[1].winRate) }}</b></div>
              <div class="pop-item">个人胜率 <b>{{ rateDisplay(podium[1].soloWinRate) }}</b></div>
            </template>
          </div>
        </n-popover>
        <!-- 第 1 名 -->
        <n-popover v-if="podium[0]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-1">
              <div class="first-crown-wrapper">
                <div class="crown-glow"></div>
                <n-icon size="28" color="#e8a840" class="crown-icon">
                  <trophy-outline />
                </n-icon>
                <div v-if="firstPlaceTitle" class="first-title-badge">{{ firstPlaceTitle }}</div>
              </div>
              <LcuImage :src="profileIconUrl(podium[0].profileIconId)" :size="68" class="spot-avatar spot-avatar-crowned" />
              <div class="spot-name">{{ shortName(podium[0].name, 10) }}</div>
              <div class="spot-value spot-value-lg">{{ podium[0].displayValue }}</div>
              <div class="spot-stand stand-gold"><span class="spot-rank">1</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <template v-if="isItemMetric">
              <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? podium[0].collectorGames : podium[0].heartsteelGames }}</b></div>
              <div class="pop-item">总场次 <b>{{ podium[0].gamesTogether }}</b></div>
              <div class="pop-item">胜率 <b>{{ rateDisplay(podium[0].winRate) }}</b></div>
            </template>
            <template v-else>
              <div class="pop-item">一起场次 <b>{{ podium[0].gamesTogether }}</b></div>
              <div class="pop-item">一起胜率 <b>{{ rateDisplay(podium[0].winRate) }}</b></div>
              <div class="pop-item">个人胜率 <b>{{ rateDisplay(podium[0].soloWinRate) }}</b></div>
            </template>
          </div>
        </n-popover>
        <!-- 第 3 名 -->
        <n-popover v-if="podium[2]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-3">
              <LcuImage :src="profileIconUrl(podium[2].profileIconId)" :size="52" class="spot-avatar" />
              <div class="spot-name">{{ shortName(podium[2].name, 10) }}</div>
              <div class="spot-value">{{ podium[2].displayValue }}</div>
              <div class="spot-stand stand-bronze"><span class="spot-rank">3</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <template v-if="isItemMetric">
              <div class="pop-item">出的场次 <b>{{ selectedMetric === 'collectorRatio' ? podium[2].collectorGames : podium[2].heartsteelGames }}</b></div>
              <div class="pop-item">总场次 <b>{{ podium[2].gamesTogether }}</b></div>
              <div class="pop-item">胜率 <b>{{ rateDisplay(podium[2].winRate) }}</b></div>
            </template>
            <template v-else>
              <div class="pop-item">一起场次 <b>{{ podium[2].gamesTogether }}</b></div>
              <div class="pop-item">一起胜率 <b>{{ rateDisplay(podium[2].winRate) }}</b></div>
              <div class="pop-item">个人胜率 <b>{{ rateDisplay(podium[2].soloWinRate) }}</b></div>
            </template>
          </div>
        </n-popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NPopover } from 'naive-ui'
import { TrophyOutline } from '@vicons/ionicons5'
import type { FriendMetricDef, FriendPodiumEntry } from '@domain/analysis/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import { rateDisplay } from '@/utils/format'

defineProps<{
  podium: FriendPodiumEntry[]
  selectedCategory: FriendMetricDef | null
  selectedMetric: string | null
  firstPlaceTitle: string
  isItemMetric: boolean
}>()
</script>

<style scoped>
.top-panel {
  flex: 0 0 auto;
}

.podium-section h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.podium-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 32px;
  padding: 12px 0;
}

.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 170px;
}

.spot-avatar {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.spot-name {
  font-size: 14px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  text-align: center;
}

.spot-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: monospace;
  text-align: center;
}

.spot-value-lg {
  font-size: 26px;
}

.spot-stand {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px 3px 0 0;
}

.spot-1 .spot-stand { height: 56px; }
.spot-2 .spot-stand { height: 44px; }
.spot-3 .spot-stand { height: 34px; }

.stand-gold   { background: linear-gradient(180deg, #e8a840 0%, #c88a20 100%); }
.stand-silver { background: linear-gradient(180deg, #a0a8b0 0%, #707880 100%); }
.stand-bronze { background: linear-gradient(180deg, #b08860 0%, #805838 100%); }

.spot-rank {
  font-size: 20px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.5);
}

.first-crown-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: -12px;
  z-index: 1;
}

.crown-glow {
  position: absolute;
  top: -12px;
  width: 80px;
  height: 40px;
  background: radial-gradient(ellipse at center, rgba(232, 168, 64, 0.25) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.crown-icon {
  filter: drop-shadow(0 2px 4px rgba(232, 168, 64, 0.5));
}

.first-title-badge {
  font-size: 13px;
  font-weight: 800;
  color: #1a1a2e;
  background: linear-gradient(135deg, #e8a840 0%, #f0cc60 100%);
  padding: 2px 12px;
  border-radius: 10px;
  letter-spacing: 1px;
  margin-top: -4px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(232, 168, 64, 0.3);
}

.spot-avatar-crowned {
  border: 3px solid rgba(232, 168, 64, 0.6);
  box-shadow: 0 0 16px rgba(232, 168, 64, 0.3);
}

.popover-stats {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
  padding: 4px 2px;
}

.popover-stats .pop-item {
  white-space: nowrap;
}

.popover-stats b {
  color: var(--text-primary);
  margin-left: 4px;
}
</style>
