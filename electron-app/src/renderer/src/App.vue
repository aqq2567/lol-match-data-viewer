<template>
  <div id="app-frame">
    <MainWindowTitleBar
      :loading="loading"
      :has-lcu-api="hasLcuApi"
      :conn-status="connStatus"
      :conn-region="connRegion"
      @fetch="fetchData"
    />
    <div id="app-content">
      <RouterView v-slot="{ Component: ViewComponent }">
        <Transition name="fade">
          <KeepAlive>
            <component
              :is="ViewComponent"
              :conn-status="connStatus"
              :conn-region="connRegion"
            />
          </KeepAlive>
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, provide, onErrorCaptured } from 'vue'
import { useMessage } from 'naive-ui'
import type { MatchData } from '@shared/types'

import MainWindowTitleBar from '@/components/title-bar/MainWindowTitleBar.vue'

const matchData = ref<MatchData | null>(null)
const loading = ref(false)
const connStatus = ref<'disconnected' | 'loading' | 'connected'>('disconnected')
const connRegion = ref('')
const hasLcuApi = ref(typeof window.lcuApi !== 'undefined')

const message = useMessage()

provide('matchData', matchData)

/** 标题栏刷新触发器 —— PlayerGamesList 监听此值变化以重新加载 */
const refreshStamp = ref(0)
provide('refreshStamp', refreshStamp)

onErrorCaptured((err, _instance, info) => {
  console.error(`[LCU:APP] 组件渲染错误: ${err}`, info)
  return false // 阻止错误继续传播
})

onMounted(async () => {
  if (!hasLcuApi.value) return
  connStatus.value = 'loading'
  try {
    const conn = await window.lcuApi.checkConnection()
    if (conn) {
      connStatus.value = 'connected'
      connRegion.value = `${conn.region || 'Unknown'} :${conn.port}`
      console.log(`[LCU:APP] LCU 连接成功: region=${conn.region}, port=${conn.port}`)
    } else {
      console.log('[LCU:APP] LCU 未连接：未检测到运行中的 LOL 客户端')
    }
  } catch (err: any) {
    console.error(`[LCU:APP] 检查 LCU 连接时异常: ${err.message || err}`)
    connStatus.value = 'disconnected'
  }
})

/** 标题栏刷新：触发所有 PlayerGamesList 重新加载对局数据 */
function fetchData() {
  if (!window.lcuApi) {
    message.warning('LCU API 不可用，请在 Electron 环境中运行')
    return
  }
  refreshStamp.value++
  message.success('正在刷新所有对局数据...')
}
</script>

<style lang="less">
#app-frame {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: var(--app-min-width);
  min-height: var(--app-min-height);
  background-color: var(--stable-bg);

  > #app-content {
    z-index: 5;
    height: 0;
    flex: 1;
    overflow: hidden;
  }
}
</style>
