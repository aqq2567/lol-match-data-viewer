<template>
  <div id="app-frame">
    <MainWindowTitleBar
      :conn-status="connStatus"
      :conn-region="connRegion"
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
import { ref, onMounted, provide, onErrorCaptured, h } from 'vue'
import { useNotification, NButton } from 'naive-ui'
import type { MatchData } from '@shared/types'

import MainWindowTitleBar from '@/components/title-bar/MainWindowTitleBar.vue'
import { createSessionRepository, createSettingsRepository } from '@application/ports'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const matchData = ref<MatchData | null>(null)
const loading = ref(false)
const connStatus = ref<'disconnected' | 'loading' | 'connected'>('disconnected')
const connRegion = ref('')
const hasLcuApi = ref(typeof window.lcuApi !== 'undefined')
const notification = useNotification()

provide('matchData', matchData)

onErrorCaptured((err, _instance, info) => {
  console.error(`[LCU:APP] 组件渲染错误: ${err}`, info)
  return false // 阻止错误继续传播
})

onMounted(async () => {
  if (!hasLcuApi.value) return
  connStatus.value = 'loading'

  const settings = createSettingsRepository(window.lcuApi)
  const session = createSessionRepository(window.lcuApi)

  // 监听自动更新状态
  let downloadingNotice: ReturnType<typeof notification.info> | null = null
  settings.onUpdateStatus((status: any) => {
    if (status.status === 'downloading') {
      if (!downloadingNotice) {
        downloadingNotice = notification.info({
          title: '检测到新版本',
          content: `正在下载 v${status.version || ''}...`,
          duration: 0,
          closable: false,
        })
      }
    } else if (status.status === 'downloaded') {
      downloadingNotice?.destroy()
      downloadingNotice = null
      notification.success({
        title: '更新已就绪',
        content: '新版本已下载完成，重启应用后生效',
        duration: 0,
        closable: true,
        action: () =>
          h(
            NButton,
            { size: 'small', onClick: () => settings.quitAndInstall() },
            () => '立即重启'
          ),
      })
    } else if (status.status === 'mirror-available') {
      notification.info({
        title: `发现新版本 v${status.version || ''}`,
        content: 'GitHub 直连不可用，请通过镜像下载安装包',
        duration: 0,
        closable: true,
        action: () =>
          h(
            NButton,
            { size: 'small', onClick: () => settings.openExternal(status.url) },
            () => '前往下载'
          ),
      })
    }
  })

  try {
    const conn = await session.checkConnection()
    if (conn) {
      connStatus.value = 'connected'
      connRegion.value = `${conn.region || 'Unknown'} :${conn.port}`
      console.log(`[LCU:APP] LCU 连接成功: region=${conn.region}, port=${conn.port}`)
    } else {
      console.log('[LCU:APP] LCU 未连接：未检测到运行中的 LOL 客户端')
    }
  } catch (err: unknown) {
    console.error(`[LCU:APP] 检查 LCU 连接时异常: ${errMsg(err)}`)
    connStatus.value = 'disconnected'
  }
})
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
