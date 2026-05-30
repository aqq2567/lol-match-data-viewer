<template>
  <div id="app-title-bar">
    <span class="app-name">LOL Match Data</span>
    <div class="divider" />
    <div class="shard-area">
      <Transition name="fade">
        <KeepAlive>
          <span v-if="$route.name === 'match-list'" class="context-title">对局列表</span>
          <span v-else-if="$route.name === 'game-detail'" class="context-title">对局详情</span>
          <span v-else-if="$route.name === 'analysis'" class="context-title">数据分析</span>
        </KeepAlive>
      </Transition>
    </div>
    <div class="center-status">
      <n-tag v-if="connStatus === 'connected'" type="success" size="small" :bordered="false">
        <template #icon><n-icon><checkmark-circle-outline /></n-icon></template>
        {{ connRegion }}
      </n-tag>
      <n-tag v-else-if="connStatus === 'loading'" type="warning" size="small" :bordered="false">
        检测中...
      </n-tag>
      <n-tag v-else type="default" size="small" :bordered="false">
        未连接
      </n-tag>
    </div>
    <div class="divider" />
    <span class="app-version">v{{ appVersion }}</span>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NTag } from 'naive-ui'
import { CheckmarkCircleOutline } from '@vicons/ionicons5'
import pkg from '../../../../../package.json'

defineProps<{
  connStatus: 'connected' | 'loading' | 'disconnected'
  connRegion: string
}>()

const appVersion = pkg.version
</script>

<style lang="less" scoped>
#app-title-bar {
  display: flex;
  position: relative;
  height: var(--title-bar-height);
  align-items: center;
  -webkit-app-region: drag;
  backdrop-filter: blur(8px);
  background-color: var(--sidebar-bg);
  z-index: 1000000;
}

.app-name {
  padding: 0 4px;
  font-family: 'Comfortaa', 'Microsoft YaHei', sans-serif;
  font-weight: bold;
  font-size: 13px;
  margin-left: 8px;
  color: var(--text-primary);
}

.shard-area {
  height: 100%;
  width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
}

.context-title {
  font-size: 13px;
  color: var(--text-secondary);
}

.center-status {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
}

.divider {
  width: 1px;
  height: 40%;
  box-sizing: border-box;
  margin: 0 8px;
  background-color: var(--divider-color);
}

.app-version {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-right: 12px;
  -webkit-app-region: no-drag;
}
</style>
