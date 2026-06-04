/** 渲染进程显示工具 */

/** 截断长名称（用于排名表/卡片等有限空间） */
export function shortName(name: string, maxLen = 12): string {
  if (!name) return '?'
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name
}
