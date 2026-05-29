<template>
  <NConfigProvider
    :theme-overrides="currentThemeOverrides"
    :theme="naiveTheme"
    :locale="zhCN"
    :date-locale="dateZhCN"
    abstract
    inline-theme-disabled
  >
    <NMessageProvider
      :container-style="{ top: 'calc(var(--title-bar-height) + 12px)' }"
      placement="top-right"
    >
      <NNotificationProvider placement="bottom-right">
        <NDialogProvider>
          <App />
        </NDialogProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
  darkTheme,
  dateZhCN,
  zhCN,
  type GlobalThemeOverrides
} from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

import App from './App.vue'

const themeStore = useThemeStore()

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : null)

/** Naive UI 暗色主题微调 */
const darkOverrides: GlobalThemeOverrides = {
  Notification: {
    padding: '12px',
    color: '#313131fa'
  },
  Popover: {
    color: '#1f1f1ffa',
    fontSize: '12px'
  },
  Card: {
    colorModal: '#232329'
  },
  Message: {
    colorInfo: 'rgba(45, 45, 55, 1)',
    colorSuccess: 'rgba(45, 45, 55, 1)',
    colorWarning: 'rgba(45, 45, 55, 1)',
    colorError: 'rgba(45, 45, 55, 1)'
  },
  Menu: {
    padding: '1px'
  }
}

/** Naive UI 亮色主题微调 */
const lightOverrides: GlobalThemeOverrides = {
  Notification: {
    padding: '12px',
    color: '#ffffffff'
  },
  Popover: {
    color: '#ffffffff',
    fontSize: '12px'
  },
  Card: {
    colorModal: '#ffffff'
  },
  Message: {
    colorInfo: 'rgba(255, 255, 255, 1)',
    colorSuccess: 'rgba(255, 255, 255, 1)',
    colorWarning: 'rgba(255, 255, 255, 1)',
    colorError: 'rgba(255, 255, 255, 1)'
  },
  Menu: {
    padding: '1px'
  }
}

const currentThemeOverrides = computed(() =>
  themeStore.isDark ? darkOverrides : lightOverrides
)
</script>
