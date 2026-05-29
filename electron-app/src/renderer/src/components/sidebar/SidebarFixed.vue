<template>
  <div class="sidebar-fixed">
    <!-- LCU 连接状态图标 -->
    <NPopover placement="right-end" :duration="250">
      <template #trigger>
        <div class="menu-item">
          <div class="menu-item-inner">
            <NIcon v-if="connStatus === 'connected'" class="menu-item-icon conn-ok">
              <CheckmarkCircleOutline />
            </NIcon>
            <NIcon v-else-if="connStatus === 'loading'" class="menu-item-icon conn-loading">
              <SyncOutline />
            </NIcon>
            <NBadge v-else dot :show="true">
              <NIcon class="menu-item-icon conn-err">
                <CloseCircleOutline />
              </NIcon>
            </NBadge>
          </div>
        </div>
      </template>
      <div class="conn-popover">
        <div v-if="connStatus === 'connected'" class="conn-text ok">
          已连接 ({{ connRegion }})
        </div>
        <div v-else-if="connStatus === 'loading'" class="conn-text loading">检测中...</div>
        <div v-else class="conn-text err">未连接 LCU</div>
      </div>
    </NPopover>

    <!-- 主题切换按钮 -->
    <NTooltip placement="right">
      <template #trigger>
        <div class="menu-item" @click="themeStore.toggleTheme()">
          <div class="menu-item-inner">
            <NIcon class="menu-item-icon" :color="iconColor">
              <SunnyOutline v-if="themeStore.isDark" />
              <MoonOutline v-else />
            </NIcon>
          </div>
        </div>
      </template>
      <span class="simple-popover" :style="{ color: textColor }">{{ themeStore.isDark ? '切换亮色主题' : '切换暗色主题' }}</span>
    </NTooltip>

    <!-- 设置按钮 -->
    <NTooltip placement="right">
      <template #trigger>
        <div class="menu-item">
          <div class="menu-item-inner">
            <NIcon class="menu-item-icon" :color="iconColor"><SettingsOutline /></NIcon>
          </div>
        </div>
      </template>
      <span class="simple-popover" :style="{ color: textColor }">设置</span>
    </NTooltip>
  </div>
</template>

<script setup lang="ts">
import { NBadge, NIcon, NPopover, NTooltip } from 'naive-ui'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  MoonOutline,
  SettingsOutline,
  SunnyOutline,
  SyncOutline
} from '@vicons/ionicons5'
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const iconColor = computed(() =>
  themeStore.isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
)
const textColor = computed(() =>
  themeStore.isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)'
)

defineProps<{
  connStatus: 'connected' | 'loading' | 'disconnected'
  connRegion: string
}>()
</script>

<style lang="less" scoped>
.sidebar-fixed {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
  height: 52px;
  width: 52px;
  padding: 2px;
  box-sizing: border-box;
  cursor: pointer;

  .menu-item-inner {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 72%;
    width: 72%;
    border-radius: 2px;
  }

  .menu-item-icon {
    font-size: 24px;
    transition: color 0.2s;
  }
}

[data-theme='dark'] {
  .menu-item {
    &:hover .menu-item-icon {
      color: #fff !important;
    }
    .menu-item-icon {
      color: rgba(255, 255, 255, 0.8) !important;
    }
  }
}

[data-theme='light'] {
  .menu-item {
    &:hover .menu-item-icon {
      color: #000 !important;
    }
    .menu-item-icon {
      color: rgba(0, 0, 0, 0.7) !important;
    }
  }
}

/* 连接状态颜色：置于 [data-theme] 之后以保证覆盖 */
.menu-item {
  .menu-item-icon.conn-ok {
    color: #26dd0e !important;
  }
  .menu-item-icon.conn-loading {
    color: #f0a020 !important;
    animation: spin 1.5s linear infinite;
  }
}

[data-theme='dark'] {
  .menu-item {
    .menu-item-icon.conn-err {
      color: rgba(255, 255, 255, 0.4) !important;
    }
  }
}

[data-theme='light'] {
  .menu-item {
    .menu-item-icon.conn-err {
      color: rgba(0, 0, 0, 0.35) !important;
    }
  }
}

.conn-popover {
  font-size: 12px;

  .conn-text {
    font-weight: bold;
  }
  .ok {
    color: #26dd0e;
  }
  .loading {
    color: #f0a020;
  }
  .err {
    color: var(--text-secondary);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
