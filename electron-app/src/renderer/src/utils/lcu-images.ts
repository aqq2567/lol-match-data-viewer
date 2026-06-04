/** LCU 内建 CDN 图片 URL 工具函数（通过 lcu-asset:// 自定义协议代理） */

function assetUrl(path: string): string {
  return `lcu-asset://${path}`
}

/** 英雄头像 (方形，通常用 border-radius: 50% 裁成圆形) */
export function championIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/champion-icons/${id}.png`) : ''
}

/** 召唤师技能图标 */
export function spellIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/spell-icons/${id}.png`) : ''
}

/** 装备图标 */
export function itemIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/item-icons/${id}.png`) : ''
}

/** 召唤师头像 */
export function profileIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/profile-icons/${id}.jpg`) : ''
}

/** 符文图标（单个符文） */
export function perkIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/perk-images/${id}.png`) : ''
}

/** 符文主系风格图标（如 Precision, Domination 等） */
export function perkStyleIcon(id: number): string {
  return id ? assetUrl(`lol-game-data/assets/v1/perkstyles/${id}.png`) : ''
}
