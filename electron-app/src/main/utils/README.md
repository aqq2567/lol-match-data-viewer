# 主进程工具 (`src/main/utils/`)

应用级基础设施模块，各自独立，互不依赖。

## 文件

| 文件 | 职责 | 被引用方 |
|------|------|----------|
| `logger.ts` | 文件日志（按进程启动轮转），stdout 双输出 | `index.ts`（全局 console 重写） |
| `settings.ts` | 用户设置持久化（`settings.json`） | `llm.ts`、`updater.ts` |
| `llm.ts` | DeepSeek chat API 客户端 | `index.ts`（`llm:chat` IPC handler） |
| `updater.ts` | electron-updater 自动更新（双通道：直连 + ghproxy 镜像） | `index.ts` |

---

## `logger.ts`

- 日志目录：`%APPDATA%/lol-match-data-viewer/logs/`
- 文件名：`main-{ISO时间戳}.log`
- Tag 格式：`[MODULE:SEVERITY]`（主进程）、`[MODULE:TAG]`（渲染进程）
- `renderer()` 方法的 tag 映射与主进程不同（使用 level 字符串作为 tag），渲染进程的 warning 不会带 `:WARN` 后缀

## `settings.ts`

```typescript
interface UserSettings {
  autoUpdate: boolean        // 默认 true
  deepseekApiKey?: string    // 用户自定义 Key
}
```

读写 `{userData}/settings.json`。内存缓存，`setSetting` 立即持久化。无运行时校验。

## `llm.ts`

```typescript
async function chatWithLLM(messages: ChatMessage[]): Promise<string>
```

- API：`https://api.deepseek.com/chat/completions`
- 模型：`deepseek-chat`
- Key 优先级：用户设置 > `.env` > 内置默认 Key
- 超时 120s

## `updater.ts`

双通道自动更新：

1. **主通道**：`electron-updater` 直连 GitHub Releases
2. **镜像通道**：`ghproxy.com` 代理 GitHub API（仅检查版本，不自动下载）

首次检查在启动后 10s 触发。`autoUpdate: false` 时跳过。
