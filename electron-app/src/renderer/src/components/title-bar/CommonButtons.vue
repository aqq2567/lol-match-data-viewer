<template>
  <div class="common-buttons">
    <NTooltip :z-index="75000">
      <template #trigger>
        <div class="common-button-outer" @click="$emit('fetch')">
          <div class="common-button-inner">
            <NIcon :class="{ spinning: loading }"><RefreshOutline /></NIcon>
          </div>
        </div>
      </template>
      刷新对局数据
    </NTooltip>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NTooltip } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'

defineProps<{
  loading: boolean
  hasLcuApi: boolean
}>()

defineEmits<{
  fetch: []
}>()
</script>

<style lang="less" scoped>
.common-buttons {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-around;

  .common-button-outer {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 100%;
    cursor: pointer;
    -webkit-app-region: no-drag;
  }

  .common-button-inner {
    padding: 4px;
    border-radius: 2px;
    transition:
      background-color 0.3s,
      color 0.3s;
    font-size: 16px;

    i {
      display: block;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }
  }
}

[data-theme='dark'] {
  .common-buttons {
    .common-button-outer:hover .common-button-inner {
      background-color: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 1);
    }
    .common-button-outer:active .common-button-inner {
      background-color: rgba(255, 255, 255, 0.1);
    }
    .common-button-inner {
      color: rgba(255, 255, 255, 0.86);
    }
  }
}

[data-theme='light'] {
  .common-buttons {
    .common-button-outer:hover .common-button-inner {
      background-color: rgba(0, 0, 0, 0.1);
      color: rgba(0, 0, 0, 1);
    }
    .common-button-outer:active .common-button-inner {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .common-button-inner {
      color: rgba(0, 0, 0, 0.75);
    }
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
