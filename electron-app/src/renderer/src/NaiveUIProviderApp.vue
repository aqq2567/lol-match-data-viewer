<template>
  <NConfigProvider
    :theme-overrides="currentThemeOverrides"
    :theme="naiveTheme"
    :locale="zhCN"
    :date-locale="dateZhCN"
    abstract
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
  lightTheme,
  dateZhCN,
  zhCN,
  type GlobalThemeOverrides
} from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

import App from './App.vue'

const themeStore = useThemeStore()

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : lightTheme)

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

// Pantone 11-4201 Cloud Dancer 云上舞白
// Naive UI lightTheme 默认大量组件为纯白 #fff，用 common token 全局覆盖
const CLOUD_DANCER = '#F0EEE9'          // 卡片/弹出层底色
const CLOUD_DANCER_INPUT = '#E9E7E1'     // 输入框底色（略深，形成层次）
const CLOUD_DANCER_HOVER = '#EBE9E3'     // hover 态

/** Naive UI 亮色主题微调 */
const lightOverrides: GlobalThemeOverrides = {
  common: {
    bodyColor: CLOUD_DANCER,
    cardColor: CLOUD_DANCER,
    popoverColor: CLOUD_DANCER,
    modalColor: CLOUD_DANCER,
    inputColor: CLOUD_DANCER_INPUT,
    tableColor: CLOUD_DANCER,
    actionColor: CLOUD_DANCER,
    hoverColor: CLOUD_DANCER_HOVER,
    pressedColor: '#E3E1D9',
    tagColor: CLOUD_DANCER_INPUT,
    tabColor: CLOUD_DANCER,
    buttonColor2: CLOUD_DANCER,
    dividerColor: 'rgba(0, 0, 0, 0.08)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  Notification: {
    padding: '12px',
    color: CLOUD_DANCER + 'ff'
  },
  Popover: {
    color: CLOUD_DANCER + 'ff',
    fontSize: '12px'
  },
  Card: {
    colorModal: CLOUD_DANCER,
    color: CLOUD_DANCER,
  },
  Message: {
    colorInfo: CLOUD_DANCER,
    colorSuccess: CLOUD_DANCER,
    colorWarning: CLOUD_DANCER,
    colorError: CLOUD_DANCER
  },
  DataTable: {
    tdColor: CLOUD_DANCER,
    thColor: CLOUD_DANCER_INPUT,
  },
  Menu: {
    padding: '1px'
  }
}

const currentThemeOverrides = computed(() =>
  themeStore.isDark ? darkOverrides : lightOverrides
)
</script>
