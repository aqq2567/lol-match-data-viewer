<template>
  <div class="champion-icon-container" :class="{ round: round }" :style="{ width: size + 'px', height: size + 'px' }">
    <LcuImage
      class="champion-icon"
      :class="{ 'champion-icon-stretched': stretched }"
      :src="imageUrl"
      :size="size"
    />
  </div>
</template>

<script lang="ts" setup>
/** 英雄头像组件 —— 从 game data store 获取路径
 *  对应 LeagueAkari 的 ChampionIcon.vue */
import { computed } from 'vue'
import LcuImage from './LcuImage.vue'
import { championIcon } from '@/utils/lcu-images'

const { championId = -1, stretched = true, round = false, size = 48 } = defineProps<{
  championId?: number
  round?: boolean
  stretched?: boolean
  size?: number
}>()

const imageUrl = computed(() => championIcon(championId))
</script>

<style lang="less" scoped>
.champion-icon-container {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;

  &.round {
    border-radius: 50%;
  }

  .champion-icon {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .champion-icon-stretched {
    width: 112%;
    height: 112%;
  }
}
</style>
