/**
 * 管理员模式 — 会话级解锁状态
 * 不持久化：每次启动应用需重新输入密码解锁
 */
import { ref } from 'vue'

/** 当前会话是否已进入管理员模式 */
export const adminUnlocked = ref(false)
