/** 渲染进程显示工具 */

/** 截断长名称（用于排名表/卡片等有限空间） */
export function shortName(name: string, maxLen = 12): string {
  if (!name) return '?'
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name
}

/** 根据行数计算排名表最大高度（一行 40px + 表头 36px，最多展示 10 行） */
export function computeTableMaxHeight(rowCount: number): number {
  return Math.min(Math.max(rowCount, 1), 10) * 40 + 36
}
