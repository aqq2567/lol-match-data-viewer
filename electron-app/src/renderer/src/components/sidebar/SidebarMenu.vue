<template>
  <div
    class="sidebar-menu"
    ref="sidebarMenuRef"
    :style="{
      '--indicator-top': `${indicatorPos.top}px`,
      '--indicator-rail-height': `${indicatorPos.height}px`
    }"
  >
    <NTooltip v-for="item of items" :key="item.key" placement="right">
      <template #trigger>
        <div
          class="menu-item"
          :data-key="item.key"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
        >
          <div class="menu-item-inner">
            <NBadge :show="!!item.inProgress" dot>
              <component :is="item.icon" class="menu-item-icon" />
            </NBadge>
          </div>
        </div>
      </template>
      <span class="menu-item-popover" :style="{ color: textColor }">{{ item.name }}</span>
    </NTooltip>
    <div class="indicator-rail"></div>
  </div>
</template>

<script setup lang="ts">
import { NBadge, NTooltip } from 'naive-ui'
import type { Component as VueComponent } from 'vue'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

defineProps<{
  modelValue?: string
  items: { key: string; icon: VueComponent; name: string; inProgress?: boolean }[]
}>()

defineEmits<{
  'update:modelValue': [key: string]
}>()

const themeStore = useThemeStore()
const textColor = computed(() =>
  themeStore.isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)'
)

/* 活动指示器位置跟踪 */
const sidebarMenuRef = useTemplateRef('sidebarMenuRef')
const indicatorPos = ref({ top: 0, height: 0 })

function updateIndicator() {
  if (!sidebarMenuRef.value) return
  const activeItem = sidebarMenuRef.value.querySelector('.menu-item.active') as HTMLElement
  if (activeItem) {
    const { top: itemTop, height } = activeItem.getBoundingClientRect()
    const { top: sidebarTop } = sidebarMenuRef.value.getBoundingClientRect()
    const h = 0.4 * height
    indicatorPos.value = {
      top: itemTop - sidebarTop + (height - h) / 2,
      height: h
    }
  }
}

watch(
  () => (sidebarMenuRef.value ? true : false),
  () => nextTick(() => updateIndicator()),
  { immediate: true }
)
</script>

<style lang="less" scoped>
.sidebar-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;

  .indicator-rail {
    position: absolute;
    top: 0;
    left: 4px;
    width: 4px;
    height: 100%;
    pointer-events: none;

    &::before,
    &::after {
      content: '';
      position: absolute;
      width: 4px;
      height: var(--indicator-rail-height);
      top: var(--indicator-top);
      border-radius: 2px;
      background-color: #26dd0e;
    }

    &::before {
      transition:
        top 0.2s cubic-bezier(0.65, 0, 0.35, 1),
        height 0.2s cubic-bezier(0.65, 0, 0.35, 1);
    }

    &::after {
      transition:
        top 0.16s cubic-bezier(0.65, 0, 0.35, 1),
        height 0.16s cubic-bezier(0.65, 0, 0.35, 1);
    }
  }
}

.menu-item {
  position: relative;
  height: 52px;
  width: 52px;
  padding: 4px;
  box-sizing: border-box;
  cursor: pointer;

  .menu-item-inner {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    border-radius: 8px;
    transition: background-color 0.2s;
    overflow: hidden;
  }

  .menu-item-icon {
    font-size: 20px;
    transition: color 0.2s;
  }
}

[data-theme='dark'] {
  .menu-item {
    &:hover .menu-item-icon {
      color: #fff !important;
    }
    &:hover .menu-item-inner {
      background-color: #fff1;
    }
    &:active .menu-item-icon {
      color: #fff8 !important;
    }
    .menu-item-icon {
      color: rgba(255, 255, 255, 0.45) !important;
    }
    &.active .menu-item-icon {
      color: #fff !important;
    }
    &.active .menu-item-inner {
      background-color: #fff1;
    }
  }
}

[data-theme='light'] {
  .menu-item {
    &:hover .menu-item-icon {
      color: #000 !important;
    }
    &:hover .menu-item-inner {
      background-color: rgba(0, 0, 0, 0.06);
    }
    &:active .menu-item-icon {
      color: rgba(0, 0, 0, 0.9) !important;
    }
    .menu-item-icon {
      color: rgba(0, 0, 0, 0.45) !important;
    }
    &.active .menu-item-icon {
      color: #000 !important;
    }
    &.active .menu-item-inner {
      background-color: rgba(0, 0, 0, 0.06);
    }
  }
}

.menu-item-popover {
  font-weight: bold;
  font-size: 14px;
}
</style>
