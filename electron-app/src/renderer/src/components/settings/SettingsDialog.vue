<template>
  <n-modal
    :show="show"
    preset="card"
    title="设置"
    style="width: 420px"
    :bordered="false"
    size="huge"
    :on-update:show="onModalUpdateShow"
  >
    <div class="settings-body">
      <!-- 自动更新 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">自动更新</span>
          <span class="setting-desc">启动时自动检查并下载新版本</span>
        </div>
        <n-switch :value="autoUpdate" @update:value="onAutoUpdateToggle" />
      </div>

      <n-divider />

      <!-- DeepSeek API Key -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">DeepSeek API Key</span>
          <span class="setting-desc">可选，留空则使用默认 Key</span>
        </div>
        <n-input
          type="password"
          placeholder="sk-..."
          :value="apiKey"
          style="width: 200px"
          size="small"
          @update:value="onApiKeyChange"
        />
      </div>

      <n-divider />

      <!-- 打开日志目录 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">日志文件</span>
          <span class="setting-desc">打开应用日志所在目录</span>
        </div>
        <n-button size="small" @click="openLogs">打开</n-button>
      </div>

      <n-divider />

      <!-- 意见反馈 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">意见反馈</span>
          <span class="setting-desc">通过 GitHub Issue 提交功能建议或问题报告</span>
        </div>
        <n-button size="small" @click="openFeedback">反馈</n-button>
      </div>

      <n-divider />

      <!-- 关于 -->
      <div class="about-section">
        <span class="setting-title">关于</span>
        <div class="about-info">
          <div class="about-row">
            <span class="about-key">版本</span>
            <span class="about-value">v{{ appVersion }}</span>
          </div>
          <div class="about-row">
            <span class="about-key">项目</span>
            <n-a
              href="https://github.com/aqq2567/lol-match-data-viewer"
              target="_blank"
            >
              GitHub
            </n-a>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NSwitch, NButton, NDivider, NA, NInput, useMessage } from 'naive-ui'
import { createSettingsRepository } from '@application/ports'
import pkg from '../../../../../package.json'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const message = useMessage()
const appVersion = pkg.version
const autoUpdate = ref(true)
const apiKey = ref('')

const settings = createSettingsRepository(window.lcuApi)

// 每次对话框打开时重新加载设置
watch(() => props.show, async (visible) => {
  if (!visible) return
  try {
    const s = await settings.load()
    autoUpdate.value = s.autoUpdate !== false
    apiKey.value = s.deepseekApiKey || ''
  } catch {
    // 使用默认值
  }
})

function onModalUpdateShow(v: boolean) {
  if (!v) emit('close')
}

async function onAutoUpdateToggle(val: boolean) {
  autoUpdate.value = val
  try {
    await settings.setAutoUpdate(val)
    if (val) {
      settings.checkForUpdates().catch(() => {})
    }
  } catch (e: unknown) {
    message.error(`保存设置失败: ${errMsg(e)}`)
    autoUpdate.value = !val
  }
}

async function onApiKeyChange(val: string) {
  apiKey.value = val
  try {
    await settings.setDeepseekApiKey(val || undefined)
  } catch (e: unknown) {
    message.error(`保存 API Key 失败: ${errMsg(e)}`)
  }
}

function openLogs() {
  settings.openLogsDir().catch((e: unknown) => {
    message.error(`打开日志目录失败: ${errMsg(e)}`)
  })
}

function openFeedback() {
  const title = encodeURIComponent('[反馈] ')
  const body = encodeURIComponent([
    '## 问题/建议描述',
    '',
    '## 期望行为',
    '',
    '---',
    `v${appVersion} | ${navigator.platform} | ${navigator.language}`,
  ].join('\n'))
  const url = `https://github.com/aqq2567/lol-match-data-viewer/issues/new?title=${title}&body=${body}`
  console.log('[FEEDBACK] 打开链接:', url)
  settings.openExternal(url).catch((e: unknown) => {
    console.error('[FEEDBACK] 打开失败:', e)
    message.error(`打开浏览器失败: ${errMsg(e)}`)
  })
}
</script>

<style lang="less" scoped>
.settings-body {
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .setting-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .setting-desc {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .about-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .about-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .about-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }

  .about-key {
    color: var(--text-tertiary);
    width: 36px;
  }

  .about-value {
    color: var(--text-secondary);
  }
}
</style>
