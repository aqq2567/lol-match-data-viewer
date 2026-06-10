import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 跨视图分析请求传递 — 替代 sessionStorage。
 * PlayerGamesList 写入 → AnalysisView 消费后自动清空。
 */
export const useAnalysisBridge = defineStore('analysis-bridge', () => {
  const gameIds = ref<number[]>([])
  const pending = ref(false)

  /** 发起分析请求（PlayerGamesList 调用） */
  function request(ids: number[]) {
    gameIds.value = ids
    pending.value = true
  }

  /** 消费并清空（AnalysisView 调用）。无待处理请求时返回 null。 */
  function consume(): number[] | null {
    if (!pending.value) return null
    pending.value = false
    return [...gameIds.value]
  }

  return { gameIds, pending, request, consume }
})
