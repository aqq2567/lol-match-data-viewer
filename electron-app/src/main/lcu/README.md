# LCU 模块 (`src/main/lcu/`)

负责与 League Client Update (LCU) API 的全部交互：连接发现、HTTP 通信、数据提取。

## 文件

| 文件 | 职责 |
|------|------|
| `client.ts` | LCU 连接发现 + HTTP 客户端 (`LcuHttpClient`) |
| `client-utils.ts` | 连接发现纯函数（命令行解析、lockfile 解析、PID 检测） |
| `extractor.ts` | 数据提取与转换（原始 LCU JSON → 应用类型），含分页拉取、详情补载、缓存管理 |

---

## 连接发现流程

```
renderer IPC  →  handler  →  findLolClient()
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            方案1: 原生插件              方案2: lockfile 搜索
            (PEB 读命令行)              (文件系统扫描)
                    │                       │
                    ▼                       ▼
               lcuAliveCheck()         lcuAliveCheck()
            (HTTPS 真实请求验证)
                    │
                    ▼
              LcuConnectionInfo
              { port, authToken, pid, region, rsoPlatformId }
```

**方案1（主）**：`akari-tools-win64.node` 从进程 PEB 读取命令行参数，提取 `--app-port` 和 `--remoting-auth-token`。不依赖安装路径、不需要管理员权限。

**方案2（兜底）**：文件系统搜索 Riot Games 目录中的 `lockfile` 文件。仅当原生插件加载失败时使用。

## HTTP 客户端

`LcuHttpClient` 包装 Axios，自动处理：
- 自签名证书 (`rejectUnauthorized: false`)
- Basic Auth (`riot:{authToken}`)
- 3 次重试（仅对 `ECONNREFUSED / ECONNRESET / ETIMEDOUT / 5xx`）
- 15s 超时

## 数据提取器

`extractor.ts` 是整个应用最大的模块（~700 行）。关键函数：

| 函数 | 类型 | 说明 |
|------|------|------|
| `fetchAllSummaries()` | I/O | 分页拉取摘要，`PAGE_SIZE=500`，去重 |
| `loadDetailMap()` | I/O | 批量加载详情，先查缓存，分批并发 30 |
| `buildMatchListData()` | 组装 | 摘要 + 详情 → `MatchListData` |
| `buildGameSummary()` | 纯计算 | 单场对局 → `GameSummary` |
| `extractStatsFull()` | 纯计算 | 原始 Stats → `PlayerStats` |
| `fetchGameData()` | I/O | 并行拉取静态游戏数据（英雄/装备/技能/符文/队列/增幅） |

## 共享状态

- **`gameDetailCache`**：会话级 `Map<gameId, detail>`，跨所有玩家共享，避免重复拉取
- **`_lastConnection`**：最近一次成功发现的 LCU 连接信息，供 `lcu-asset://` 协议使用

## 调用方

- `src/main/ipc/lcu-handlers.ts` — 所有 LCU IPC handler
- `src/main/index.ts` — `getLastConnection()` 用于图片代理

## 待改进

- `extractor.ts` 混合了 I/O 编排和纯数据提取，可拆分
- 部分 extractor 函数内部重复调用 `findLolClient()`（handler 已调用过一次）
- `gameDetailCache` 是模块级可变状态，隐式跨请求共享
