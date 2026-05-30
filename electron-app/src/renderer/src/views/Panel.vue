<template>
  <div class="panel">
    <div class="left-side-content">
      <Sidebar :conn-status="connStatus" :conn-region="connRegion" />
    </div>
    <div class="right-side-content">
      <RouterView v-slot="{ Component: ViewComponent }">
        <Transition name="fade">
          <KeepAlive>
            <component :is="ViewComponent" />
          </KeepAlive>
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/components/sidebar/Sidebar.vue'

defineProps<{
  connStatus: 'connected' | 'loading' | 'disconnected'
  connRegion: string
}>()
</script>

<style lang="less" scoped>
.panel {
  display: flex;
  width: 100%;
  height: 100%;

  .right-side-content {
    flex: 1;
    width: 0;
    border-top: 1px solid var(--divider-color);
    border-left: 1px solid var(--divider-color);
    border-top-left-radius: 2px;
  }
}
</style>
