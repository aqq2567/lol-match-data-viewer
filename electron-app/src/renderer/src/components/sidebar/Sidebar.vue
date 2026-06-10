<template>
  <div class="app-sidebar">
    <SidebarMenu
      class="sidebar-menu"
      :items="menuItems"
      :model-value="currentMenu"
      @update:model-value="handleMenuChange"
    />
    <div class="padding-zone"></div>
    <SidebarFixed :conn-status="connStatus" :conn-region="connRegion" />
  </div>
</template>

<script setup lang="ts">
import { AnalyticsOutline, PeopleOutline, StatsChartOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { h, ref, watchEffect } from 'vue'
import { useRoute, useRouter, isNavigationFailure, NavigationFailureType } from 'vue-router'
import type { Component as VueComponent } from 'vue'

import SidebarFixed from './SidebarFixed.vue'
import SidebarMenu from './SidebarMenu.vue'

const props = defineProps<{
  connStatus: 'connected' | 'loading' | 'disconnected'
  connRegion: string
}>()

/** 渲染 NIcon 包装的图标 */
function renderIcon(icon: VueComponent) {
  return () => h(NIcon, null, () => h(icon))
}

const router = useRouter()
const route = useRoute()

const currentMenu = ref('match-list')

const menuItems = [
  {
    key: 'match-list',
    icon: renderIcon(AnalyticsOutline),
    name: '对局列表'
  },
  {
    key: 'analysis',
    icon: renderIcon(StatsChartOutline),
    name: '数据分析'
  },
  {
    key: 'friend-analysis',
    icon: renderIcon(PeopleOutline),
    name: '好友分析'
  }
]

async function handleMenuChange(key: string) {
  console.log(`[LCU:SIDEBAR] 菜单点击: ${key}`)
  try {
    await router.replace({ name: key })
    console.log(`[LCU:SIDEBAR] 路由切换成功: → ${key}`)
  } catch (err: unknown) {
    // Vue Router 切换至相同路由时抛出 NavigationDuplicated，不是错误
    if (isNavigationFailure(err, NavigationFailureType.duplicated)) {
      console.log(`[LCU:SIDEBAR] 已在目标页面: ${key}`)
      return
    }
    console.error(`[LCU:SIDEBAR] 路由切换失败: ${err.message || err}`, err)
  }
}

watchEffect(() => {
  if (route.name) {
    currentMenu.value = route.name as string
  }
})
</script>

<style lang="less" scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--sidebar-bg);

  .padding-zone {
    flex: 1;
  }
}
</style>
