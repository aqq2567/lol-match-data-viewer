# IPC 处理器 (`src/main/ipc/`)

将渲染进程的 LCU 数据请求桥接到主进程。每个 handler 遵循相同的模式：

```
渲染进程 window.lcuApi.xxx()
  → contextBridge (preload/index.ts)
    → ipcRenderer.invoke('lcu:xxx', ...args)
      → ipcMain.handle('lcu:xxx', handler)
        → 主进程执行
```

## Handler 列表

| Channel | 参数 | 返回值 | 调用 extractor |
|---------|------|--------|---------------|
| `check-connection` | (无) | `{ connected, region? }` | — |
| `current-summoner` | (无) | `LcuSummoner` | — |
| `fetch-matches` | `gameCount` | `MatchData` | `fetchAllMatchData()` (已废弃) |
| `fetch-match-list` | `page, pageSize` | `MatchListData` | `fetchMatchList()` |
| `fetch-player-match-list` | `puuid, name, icon, level, page, pageSize` | `MatchListData` | `fetchMatchListForPlayer()` |
| `fetch-game-details` | `gameIds[]` | `GameRecord[]` | `fetchGameDetailsBatched()` |
| `fetch-game` | `gameId` | `GameRecord` | (直接调用客户端) |
| `fetch-game-data` | (无) | `GameDataCache` | `fetchGameData()` |
| `get-champion-mastery` | (无) | `any[]` | (直接调用客户端) |

## 注册入口

```typescript
// src/main/index.ts
import { registerLcuHandlers } from './ipc/lcu-handlers'
registerLcuHandlers()
```

## 待改进

- 每个 handler 重复 `findLolClient() → null check → new LcuHttpClient()` 样板代码（9 次）
- 部分 handler 和对应 extractor 函数**双重发现** LCU 连接（handler 发现一次，extractor 内部又发现一次）
- 应提取 `withClient<T>(fn)` 工厂函数消除重复
