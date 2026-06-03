import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
  test: {
    // 只跑 Node 端测试（不需要浏览器环境）
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
