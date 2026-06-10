<template>
  <div class="chat-panel">
    <!-- 标题栏 -->
    <div class="chat-header">
      <span class="chat-title">AI 分析助手</span>
      <n-button text size="small" @click="clearChat" :disabled="messages.length === 0">
        清空对话
      </n-button>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <!-- 空状态 -->
      <div v-if="messages.length === 0 && !sending" class="chat-empty">
        <span class="chat-empty-icon">💬</span>
        <p>AI 助手已就绪，共分析 <b>{{ games.length }}</b> 场对局、<b>{{ playerCount }}</b> 位玩家</p>
        <p class="chat-hint">试着问：谁是MVP？谁的输出最高？</p>
      </div>

      <!-- 消息 -->
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="chat-message-row"
        :class="msg.role === 'user' ? 'msg-right' : 'msg-left'"
      >
        <div v-if="msg.role === 'assistant'" class="msg-avatar avatar-ai">🤖</div>
        <div class="msg-bubble-wrapper" :class="msg.role === 'user' ? 'bubble-right' : 'bubble-left'">
          <div class="msg-sender">{{ msg.role === 'user' ? '你' : 'AI 助手' }}</div>
          <div class="msg-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
            {{ msg.content }}
          </div>
        </div>
        <div v-if="msg.role === 'user'" class="msg-avatar avatar-user">👤</div>
      </div>

      <!-- 发送中 -->
      <div v-if="sending" class="chat-message-row msg-left">
        <div class="msg-avatar avatar-ai">🤖</div>
        <div class="msg-bubble-wrapper bubble-left">
          <div class="msg-sender">AI 助手</div>
          <div class="msg-bubble bubble-ai typing-cursor">...</div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="chat-error">
        <span>{{ error }}</span>
        <n-button size="tiny" @click="resend">重新发送</n-button>
      </div>
    </div>

    <!-- 输入栏 -->
    <div class="chat-input-bar">
      <n-input
        v-model:value="inputText"
        type="textarea"
        placeholder="输入你的问题..."
        :disabled="sending"
        :autosize="{ minRows: 1, maxRows: 3 }"
        @keydown="onKeydown"
      />
      <n-button type="primary" :disabled="!inputText.trim() || sending" :loading="sending" @click="sendMessage">
        发送
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NInput } from 'naive-ui'
import type { GameRecord } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import { buildChatMessages } from '@application/chat-service'
import { createChatRepository } from '@application/ports'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const props = defineProps<{
  games: GameRecord[]
}>()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 模块级状态：组件重创建后消息不丢失
const messages = ref<Message[]>([])
const inputText = ref('')
const sending = ref(false)
const error = ref('')
/** 记录已注入的 games 指纹，指纹变了才重置消息 */
let lastGameFp = ''

const gds = useGameDataStore()
const chat = createChatRepository(window.lcuApi)
const messagesContainer = ref<HTMLElement>()

const playerCount = computed(() => {
  const names = new Set<string>()
  for (const g of props.games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      names.add(p.summoner_name)
    }
  }
  return names.size
})

/** 计算 games 的指纹（game_id 排序拼接），用于检测数据是否真的变了 */
function gameFingerprint(games: GameRecord[]): string {
  return [...games].map(g => g.game_id).sort((a, b) => a - b).join(',')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  } else if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault()
    inputText.value += '\n'
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  inputText.value = ''
  error.value = ''
  messages.value.push({ role: 'user', content: text })
  sending.value = true
  scrollToBottom()

  try {
    const apiMessages = buildChatMessages(props.games, gds.$state as GameDataCache, messages.value)
    const result = await chat.sendMessage(apiMessages)
    if (result.status === 'success' && result.content) {
      messages.value.push({ role: 'assistant', content: result.content })
    } else {
      error.value = result.message || 'AI 服务返回异常'
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '请求失败'
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function resend() {
  error.value = ''
  const lastUserIdx = messages.value.map(m => m.role).lastIndexOf('user')
  if (lastUserIdx >= 0) {
    const lastUserMsg = messages.value[lastUserIdx]
    messages.value = messages.value.slice(0, lastUserIdx)
    inputText.value = lastUserMsg.content
    sendMessage()
  }
}

function clearChat() {
  messages.value = []
  error.value = ''
  inputText.value = ''
}

// 仅当 games 数据真实变化时重置消息
const currentFp = gameFingerprint(props.games)
if (lastGameFp && currentFp !== lastGameFp) {
  messages.value = []
  error.value = ''
  inputText.value = ''
}
lastGameFp = currentFp

watch(() => messages.value.length, () => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 280px;
  background: var(--chat-bg);
  border: 1px solid var(--chat-bubble-ai-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 12px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--chat-header-border);
  flex-shrink: 0;
}

.chat-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--chat-title);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 24px;
}

.chat-empty p {
  font-size: 13px;
  margin: 0;
}

.chat-empty b {
  color: var(--chat-highlight);
}

.chat-empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.chat-hint {
  font-size: 11px !important;
  color: var(--text-muted) !important;
}

.chat-message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.chat-message-row.msg-right {
  justify-content: flex-end;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.avatar-ai {
  background: var(--chat-avatar-ai-bg);
}

.avatar-user {
  background: var(--chat-avatar-user-bg);
}

.msg-bubble-wrapper {
  max-width: 75%;
}

.msg-sender {
  font-size: 10px;
  margin-bottom: 3px;
}

.bubble-left .msg-sender {
  color: var(--chat-sender-ai);
  padding-left: 2px;
}

.bubble-right .msg-sender {
  color: var(--chat-sender-user);
  padding-right: 2px;
  text-align: right;
}

.msg-bubble {
  padding: 9px 13px;
  font-size: 13px;
  line-height: 1.55;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-ai {
  background: var(--chat-bubble-ai-bg);
  border: 1px solid var(--chat-bubble-ai-border);
  border-radius: 2px 12px 12px 12px;
  color: var(--chat-bubble-ai-text);
}

.bubble-user {
  background: var(--chat-bubble-user-bg);
  border: 1px solid var(--chat-bubble-user-border);
  border-radius: 12px 2px 12px 12px;
  color: var(--chat-bubble-user-text);
}

.typing-cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.chat-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(232, 64, 87, 0.1);
  border: 1px solid rgba(232, 64, 87, 0.2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: #e84057;
}

.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--chat-input-border);
  flex-shrink: 0;
  background: var(--chat-input-bar-bg);
}

.chat-input-bar :deep(.n-input) {
  flex: 1;
}
</style>
