<template>
  <div id="app-frame">
    <MainWindowTitleBar
      :loading="loading"
      :has-lcu-api="hasLcuApi"
      :conn-status="connStatus"
      :conn-region="connRegion"
      @fetch="fetchData"
      @import="importJson"
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

/** 旧版：拉取完整数据（保留兼容，由标题栏按钮触发） */
async function fetchData() {
  if (!window.lcuApi) {
    message.warning('LCU API 不可用，请在 Electron 环境中运行')
    return
  }

  loading.value = true
  try {
    matchData.value = await window.lcuApi.fetchMatches(10)
    message.success(`成功拉取 ${matchData.value.games_count} 场对局`)
  } catch (e: any) {
    message.error(`拉取失败: ${e.message || e}`)
  } finally {
    loading.value = false
  }
}

/** JSON 文件导入（离线备用） */
function importJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      loading.value = true
      try {
        const text = await file.text()
        matchData.value = JSON.parse(text)
        message.success(`成功导入 ${matchData.value?.games_count || 0} 场对局`)
      } catch (err: any) {
        console.error(`[LCU:APP] 文件导入失败: ${err.message || err}`)
        message.error('文件读取失败')
      } finally {
        loading.value = false
      }
    }
  }
  input.click()
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
