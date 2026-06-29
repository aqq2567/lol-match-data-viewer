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

      <!-- 管理员模式 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">🔐 管理员模式</span>
          <span class="setting-desc" v-if="adminUnlocked">已解锁 — 发布功能已启用</span>
          <span class="setting-desc" v-else-if="savedAdminPasswordHash">输入密码以解锁发布功能</span>
          <span class="setting-desc" v-else>管理员未配置密码，发布功能不可用</span>
        </div>
      </div>

      <div class="setting-row" v-if="!adminUnlocked && savedAdminPasswordHash">
        <n-input
          type="password"
          placeholder="输入管理员密码"
          :value="adminPwdInput"
          style="width: 200px"
          size="small"
          @update:value="adminPwdInput = $event"
          @keyup.enter="verifyAdmin"
        />
        <n-button
          size="small"
          type="primary"
          :disabled="!adminPwdInput"
          @click="verifyAdmin"
        >
          验证
        </n-button>
      </div>

      <div class="setting-row" v-if="adminUnlocked">
        <span style="color: #22c55e; font-size: 13px">✅ 管理员模式已解锁</span>
        <n-button size="small" type="warning" @click="lockAdmin">锁定</n-button>
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
import { adminUnlocked } from '@/stores/admin-mode'
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

// ── 管理员模式 ──
const adminPwdInput = ref('')
const savedAdminPasswordHash = ref('')

/** SHA256 哈希（Web Crypto API） */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyAdmin() {
  const input = adminPwdInput.value.trim()
  if (!input) return

  const inputHash = await sha256(input)
  if (inputHash === savedAdminPasswordHash.value) {
    adminUnlocked.value = true
    adminPwdInput.value = ''
    message.success('管理员模式已解锁')
  } else {
    message.error('密码错误，请重试')
    adminPwdInput.value = ''
  }
}

function lockAdmin() {
  adminUnlocked.value = false
  adminPwdInput.value = ''
  message.info('管理员模式已锁定')
}

const settings = createSettingsRepository(window.lcuApi)

// 每次对话框打开时重新加载设置
watch(() => props.show, async (visible) => {
  if (!visible) return
  try {
    const s = await settings.load()
    autoUpdate.value = s.autoUpdate !== false
    apiKey.value = s.deepseekApiKey || ''
    // 只读取管理员密码（其余 dashboard 配置仅主进程使用，不由前端暴露）
    const dashCfg = (s as any).dashboard
    savedAdminPasswordHash.value = dashCfg?.adminPasswordHash || ''
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
