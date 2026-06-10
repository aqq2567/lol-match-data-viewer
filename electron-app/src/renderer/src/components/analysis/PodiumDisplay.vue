<template>
  <div class="top-panel">
    <div class="podium-section" v-if="podium.length">
      <h4>{{ title }}</h4>
      <div class="podium-row">
        <!-- 第 2 名 -->
        <n-popover v-if="podium[1]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-2 podium-spot-enter">
              <div class="spot-avatar-ring silver">
                <LcuImage :src="profileIconUrl(podium[1].profileIconId)" :size="52" class="spot-avatar" />
              </div>
              <div class="spot-name">{{ shortName(podium[1].playerName) }}</div>
              <div class="spot-value">{{ podium[1].displayValue }}</div>
              <div class="spot-stand stand-silver"><span class="spot-rank">2</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <div class="pop-item">局数 <b>{{ podium[1].gameCount }}</b></div>
            <div class="pop-item">胜率 <b>{{ podiumWinRate(podium[1]) }}%</b></div>
            <div class="pop-item">KDA <b>{{ podium[1].avgKda }}</b></div>
            <div class="pop-item">击杀/死亡/助攻 <b>{{ podium[1].totalKills }}/{{ podium[1].totalDeaths }}/{{ podium[1].totalAssists }}</b></div>
          </div>
        </n-popover>
        <!-- 第 1 名 -->
        <n-popover v-if="podium[0]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-1 podium-spot-enter">
              <div class="first-crown-wrapper">
                <div class="crown-glow"></div>
                <n-icon size="28" color="#e8a840" class="crown-icon">
                  <trophy-outline />
                </n-icon>
                <div v-if="firstPlaceTitle" class="first-title-badge">{{ firstPlaceTitle }}</div>
              </div>
              <div class="spot-avatar-ring gold">
                <LcuImage :src="profileIconUrl(podium[0].profileIconId)" :size="68" class="spot-avatar" />
              </div>
              <div class="spot-name">{{ shortName(podium[0].playerName) }}</div>
              <div class="spot-value spot-value-lg">{{ podium[0].displayValue }}</div>
              <div class="spot-stand stand-gold"><span class="spot-rank">1</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <div class="pop-item">局数 <b>{{ podium[0].gameCount }}</b></div>
            <div class="pop-item">胜率 <b>{{ podiumWinRate(podium[0]) }}%</b></div>
            <div class="pop-item">KDA <b>{{ podium[0].avgKda }}</b></div>
            <div class="pop-item">击杀/死亡/助攻 <b>{{ podium[0].totalKills }}/{{ podium[0].totalDeaths }}/{{ podium[0].totalAssists }}</b></div>
          </div>
        </n-popover>
        <!-- 第 3 名 -->
        <n-popover v-if="podium[2]" trigger="hover" placement="top" :show-arrow="false">
          <template #trigger>
            <div class="podium-spot spot-3 podium-spot-enter">
              <div class="spot-avatar-ring bronze">
                <LcuImage :src="profileIconUrl(podium[2].profileIconId)" :size="52" class="spot-avatar" />
              </div>
              <div class="spot-name">{{ shortName(podium[2].playerName) }}</div>
              <div class="spot-value">{{ podium[2].displayValue }}</div>
              <div class="spot-stand stand-bronze"><span class="spot-rank">3</span></div>
            </div>
          </template>
          <div class="popover-stats">
            <div class="pop-item">局数 <b>{{ podium[2].gameCount }}</b></div>
            <div class="pop-item">胜率 <b>{{ podiumWinRate(podium[2]) }}%</b></div>
            <div class="pop-item">KDA <b>{{ podium[2].avgKda }}</b></div>
            <div class="pop-item">击杀/死亡/助攻 <b>{{ podium[2].totalKills }}/{{ podium[2].totalDeaths }}/{{ podium[2].totalAssists }}</b></div>
          </div>
        </n-popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NPopover } from 'naive-ui'
import { TrophyOutline } from '@vicons/ionicons5'
import type { PodiumEntry } from '@domain/analysis/types'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { shortName } from '@/utils/display'
import { profileIcon as profileIconUrl } from '@/utils/lcu-images'
import { computePodiumWinRate as podiumWinRate } from '@application/analysis-service'

defineProps<{
  title: string
  podium: PodiumEntry[]
  firstPlaceTitle: string
}>()
</script>

<style scoped>
.top-panel {
  flex: 0 0 auto;
}

.podium-section {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--card-shadow);
}

.podium-section h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
  letter-spacing: 0.02em;
}

.podium-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 36px;
  padding: 8px 0;
}

.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 170px;
}

.spot-avatar-ring {
  border-radius: 50%;
  padding: 3px;
  flex-shrink: 0;
}

.spot-avatar-ring.gold {
  box-shadow: 0 0 0 3px rgba(232, 168, 64, 0.5), 0 0 24px rgba(232, 168, 64, 0.3);
}

.spot-avatar-ring.silver {
  box-shadow: 0 0 0 3px rgba(160, 168, 176, 0.5), 0 0 16px rgba(160, 168, 176, 0.2);
}

.spot-avatar-ring.bronze {
  box-shadow: 0 0 0 3px rgba(176, 136, 96, 0.5), 0 0 16px rgba(176, 136, 96, 0.2);
}

.spot-avatar {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.spot-name {
  font-size: var(--text-base);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  text-align: center;
}

.spot-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--font-number);
  letter-spacing: -0.02em;
  text-align: center;
}

.spot-value-lg {
  font-size: var(--text-3xl);
}

.spot-stand {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px 3px 0 0;
  position: relative;
}

.spot-1 .spot-stand { height: 56px; }
.spot-2 .spot-stand { height: 44px; }
.spot-3 .spot-stand { height: 34px; }

.stand-gold {
  background: linear-gradient(180deg, #e8a840 0%, #c88a20 50%, #a06810 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}

.stand-silver {
  background: linear-gradient(180deg, #b0b8c0 0%, #889098 50%, #606870 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}

.stand-bronze {
  background: linear-gradient(180deg, #c09870 0%, #987050 50%, #705030 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
}

.spot-rank {
  font-size: 22px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.4);
  text-shadow: 0 1px 0 rgba(255,255,255,0.1);
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
  top: -16px;
  width: 100px;
  height: 50px;
  background: radial-gradient(ellipse at center, rgba(232, 168, 64, 0.35) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.crown-icon {
  filter: drop-shadow(0 2px 6px rgba(232, 168, 64, 0.6));
}

.first-title-badge {
  font-size: 13px;
  font-weight: 800;
  color: #1a1a2e;
  background: linear-gradient(135deg, #e8a840 0%, #f0cc60 50%, #e8a840 100%);
  padding: 3px 14px;
  border-radius: 12px;
  letter-spacing: 1px;
  margin-top: -2px;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(232, 168, 64, 0.4);
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
