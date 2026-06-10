/** 格式化工具函数 */

/** 秒数 → 游戏时长文字，如 "25分30秒" */
export function formatGameDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}分${sec.toString().padStart(2, '0')}秒`
}

/** 时间戳 → 粗粒度相对时间（天/周/月），适用于好友最后游戏时间等场景 */
export function daysAgo(ts: number): string {
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${Math.floor(days / 30)}月前`
}

/** 小数 → 百分比字符串，如 0.675 → "68%" */
export function rateDisplay(rate: number): string {
  return (rate * 100).toFixed(0) + '%'
}

/** stat key → 格式化值（伤害/金币加千位分隔，时长加秒后缀） */
export function formatBestValue(key: string, v: number): string {
  if (['damage_total_to_champs', 'damage_total_taken', 'survival_total_heal',
    'survival_damage_self_mitigated', 'economy_gold_earned'].includes(key)) {
    return v.toLocaleString()
  }
  if (key === 'survival_longest_time_living') return v + 's'
  return String(v)
}
