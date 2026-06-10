import { createPinia } from 'pinia'
import { createApp } from 'vue'

import NaiveUIProviderApp from './NaiveUIProviderApp.vue'
import './assets/css/styles.less'
import './assets/css/transition.less'
import { router } from './routes'

// 全局 console 拦截 — 所有 console.log/warn/error 同时写入主进程日志文件
const _rOrig = { log: console.log, warn: console.warn, error: console.error }
function _logToMain(level: 'log' | 'warn' | 'error', args: any[]) {
  try { window.lcuApi?.log?.(level, ...args) } catch { /* 主进程日志不可用时静默降级 */ }
}
console.log = (...a: any[]) => { _rOrig.log(...a); _logToMain('log', a) }
console.warn = (...a: any[]) => { _rOrig.warn(...a); _logToMain('warn', a) }
console.error = (...a: any[]) => { _rOrig.error(...a); _logToMain('error', a) }

console.log('[LCU:APP] Vue 应用启动中...')
console.log(`[LCU:APP] 启动时间: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`)

// 全局错误捕获
window.addEventListener('error', (e) => {
  console.error(`[LCU:APP] 全局错误: ${e.message} at ${e.filename}:${e.lineno}`)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error(`[LCU:APP] 未处理的 Promise 拒绝: ${e.reason}`)
})

try {
  const app = createApp(NaiveUIProviderApp).use(router).use(createPinia())
  app.mount('#app')
  console.log('[LCU:APP] Vue 应用挂载成功')
} catch (error) {
  console.error('[LCU:APP] LOL Match Data 无法正确加载：', error)
}
