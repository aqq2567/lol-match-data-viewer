<template>
  <div class="tab-bar" v-if="tabs.length > 1">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === activeTabId }"
      @click="setActive(tab.id)"
    >
      <LcuImage
        class="tab-icon"
        :src="profileIcon(tab.profileIconId || 0)"
        :size="24"
      />
      <span class="tab-name">{{ tab.name }}</span>
      <div
        v-if="tab.id !== 'default'"
        class="tab-close"
        @click.stop="closeTab(tab.id)"
      >
        <n-icon size="12"><CloseOutline /></n-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'
import { useTabStore } from '@/stores/tab'
import { storeToRefs } from 'pinia'
import LcuImage from '@/components/widgets/LcuImage.vue'
import { profileIcon } from '@/utils/lcu-images'

const tabStore = useTabStore()
const { tabs, activeTabId } = storeToRefs(tabStore)
const { setActive, closeTab } = tabStore
</script>

<style lang="less" scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 12px;
  gap: 2px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  flex-shrink: 0;

  &::-webkit-scrollbar { height: 0; }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px 0 8px;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
  background: var(--bg-card);

  &.active {
    background: var(--bg-section);
  }

  &:hover {
    background: var(--bg-hover);
  }
}

.tab-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--bg-hover);
}

.tab-name {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .active & {
    color: var(--text-primary);
    font-weight: 600;
  }
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: var(--text-tertiary);
  transition: all 0.15s;

  &:hover {
    background: rgba(128, 128, 128, 0.3);
    color: var(--text-primary);
  }
}
</style>
