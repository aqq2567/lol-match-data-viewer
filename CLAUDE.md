# LOL Match Data Viewer

基于 Electron + Vue 3 的《英雄联盟》比赛数据查看器，通过 LCU（League Client Update）本地 API 获取比赛数据，灵感来源于 LeagueAkari 项目。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 34（electron-vite 构建） |
| 前端 | Vue 3.5（Composition API + `<script setup>`） + Vue Router 4 + Pinia 2 |
| UI 组件库 | Naive UI 2.42（暗色主题，中文本地化） |
| 样式 | Less（作用域样式 + 全局样式） |
| 构建 | Vite 6 + electron-vite 3 + TypeScript 5.7 |
| HTTP | Axios（自签名证书 + Basic Auth） |
| 图标 | @vicons/ionicons5 |
| 打包 | electron-builder（Windows NSIS 安装包，自动更新） |
| AI | DeepSeek chat API（deepseek-chat 模型） |

## 目录结构

```
electron-app/                  # 主应用
├── src/
│   ├── main/                  # 主进程：窗口管理、LCU 连接、IPC 处理
│   │   ├── index.ts           # 入口：BrowserWindow、lcu-asset:// 协议、日志、IPC handler
│   │   ├── lcu/
│   │   │   ├── client.ts      # LCU 连接发现 + HTTP 客户端
│   │   │   └── extractor.ts   # 数据提取与转换（原始 LCU JSON → 应用类型）
│   │   ├── ipc/lcu-handlers.ts  # IPC 端点
│   │   └── utils/
│   │       ├── logger.ts      # 文件日志（按日轮转）
│   │       ├── llm.ts         # DeepSeek API 客户端（chat completions）
│   │       ├── settings.ts    # 用户设置持久化
│   │       └── updater.ts     # 自动更新（electron-updater）
│   ├── preload/index.ts       # contextBridge：暴露 window.lcuApi
│   ├── shared/                # 主/渲染进程共享
│   │   ├── types/
│   │   │   ├── lcu-api.ts     # LCU API 原始响应类型
│   │   │   └── app.ts         # 应用层类型
│   │   └── utils/
│   │       ├── analysis.ts    # 分析算法（胜率、KDA、英雄/队友频率）
│   │       ├── format-for-ai.ts  # 对局数据 → AI 可读文本（纯函数）
│   │       ├── mappings.ts    # 映射表（队列/段位/地图中文本地化）
│   │       └── mode-analysis-config.ts  # 模式专属指标定义
│   └── renderer/src/          # Vue 3 前端
│       ├── views/             # Panel（布局）、MatchList、AnalysisView、GameDetail
│       ├── components/        # 比赛卡片、统计面板、侧边栏、标题栏、小部件
│       │   ├── chat/
│       │   │   └── ChatPanel.vue  # AI 对话组件（微信式气泡，Very Peri + Peach Fuzz）
│       │   └── settings/
│       │       └── SettingsDialog.vue  # 设置弹窗（含 API Key）
│       ├── stores/game-data.ts  # Pinia：英雄/物品/符文等静态数据缓存
│       ├── routes/index.ts    # Hash 路由：/panel/matches、/panel/game/:id、/panel/analysis
│       └── utils/             # format.ts（时间/数字）、lcu-images.ts（lcu-asset:// URL）
python/                        # Python CLI 配套工具
├── lcu_client.py              # 独立 LCU 客户端（requests + urllib3）
├── extract_matches.py         # 批量导出比赛 JSON
└── fetch_game.py              # 单场比赛查看器
docs/                          # 文档
├── DATA_DIMENSIONS.md         # LCU API 170+ 数据维度参考
└── superpowers/               # 设计文档与实现计划
    ├── specs/                 # 设计规格
    └── plans/                 # 实现计划
```

## 开发命令

所有命令在 `electron-app/` 目录下执行：

```bash
npm run dev          # 启动开发服务器（electron-vite）
npm run build        # 生产构建
npm run typecheck    # TypeScript 类型检查（vue-tsc）
npm run package      # 构建 + electron-builder 打包（Windows NSIS）
npm run preview      # 预览生产构建
```

## 架构模式

### 数据流

1. 主进程通过原生插件 `akari-tools-win64.node` 查找 `LeagueClientUx.exe`，从命令行参数解析 `--app-port` 和 `--remoting-auth-token`
2. 渲染进程通过 `window.lcuApi`（contextBridge）调用 IPC → 主进程执行 LCU API 请求
3. 比赛列表获取采用两阶段：(1) `fetchAllSummaries()` 分页拉取（按 `gameCount` 智能终止）；(2) `loadDetailMap()` 先查会话级 `gameDetailCache`，未命中分批并行拉取（并发 30）；单玩家上限 ~200 场
4. `fetchMatchPage()` 同时尝试 `begIndex` 和 `beginIndex` 参数，取结果更多的一方（国服缩写 vs Riot 完整拼写兼容）
5. 静态游戏数据（英雄、物品、技能、符文、队列、海克斯强化）通过 `fetchGameData()` 并行加载
6. 图片通过自定义 `lcu-asset://` 协议代理（并发限制 8），避免 CORS 问题
7. 比赛中选 ID 通过 `sessionStorage` 跨页面传递

### AI 对话功能（v0.4.0 Beta）

- **入口**：分析页选中指标后，排名表下方显示 ChatPanel
- **数据注入**：`formatGamesForAI()` 将选中对局的全部字段 + 高阶聚合指标格式化为结构化文本，作为 system message 的 `content` 注入
- **API**：DeepSeek chat API（`deepseek-chat`），120s 超时，默认 Key 硬编码 + 用户可在设置中自定义
- **对话管理**：模块级 `ref` 确保切换指标时消息不丢失；game_id 指纹检测确保切换对局数据时才清空对话
- **提示词优先级**：用户自定义 Key > 默认 Key
- **关键文件**：
  - `src/main/utils/llm.ts` — API 客户端
  - `src/shared/utils/format-for-ai.ts` — 数据格式化纯函数
  - `src/renderer/src/components/chat/ChatPanel.vue` — 对话 UI

### 关键约定

- **类型系统**：`shared/types/lcu-api.ts` 定义原始 LCU 响应类型，`shared/types/app.ts` 定义应用层转换后类型。新增数据维度时两处都要更新
- **分析指标**：模式专属指标在 `shared/utils/mode-analysis-config.ts` 中注册，`basicMetrics` 和 `advancedMetrics` 各有 label/getter/fmt
- **中文本地化**：队列名、段位、地图、游戏模式等映射集中在 `shared/utils/mappings.ts`
- **日志**：主进程使用 `utils/logger.ts`（文件日志），渲染进程使用 `window.lcuApi.log()`（通过 IPC 写入同一日志文件）
- **日志位置**：`%APPDATA%/lol-match-data-viewer/logs/main-YYYY-MM-DDTHH-mm-ss.log`
- **本地 SQLite 持久化**：`src/main/db/` 层使用 sql.js 实现本地数据存储。对局摘要（games 表）无限累积，详情（game_details 表）按需缓存。启动时从 DB 预加载最近 200 场，秒显数据；LCU API 拉取新数据后自动追加。写失败降级运行（不阻止 UI）
- **LeagueAkari 兼容**：架构风格和命名约定参考 LeagueAkari，尽量保持一致性
- **安全红线**：API Key 不从代码暴露，`.env` 已 gitignored，日志不记录 Key

### 路径别名

- `@main/*` → `src/main/*`
- `@shared/*` → `src/shared/*`
- `@/*` → `src/renderer/src/*`

## SGP 数据源（Phase 1 已完成）

> **参考实现**: LeagueAkari (`D:\LOL\LeagueAkari`) — 凡是 SGP 行为不清楚时，优先读 LeagueAkari 源码。

### 架构概览

```
启动 → LCU checkConnection → 获取 entitlements JWT
  ├─ 成功 → SgpManager.init() → SGP 通道就绪
  │         后续所有对局请求走 SGP（一次调用出列表+详情）
  └─ 失败 → 标记不可用 → 全链路降级 LCU（现有逻辑不变）
```

### SGP 响应特征

**SGP `/SUMMARY` 端点返回 `{ games: [...] }`，没有 `gameCount` / `totalGames` 字段。**
这意味着无法提前知道玩家总共多少场——只能分页拉到返回空为止。

LeagueAkari 的处理方式：data-mapper 把 `gameCount` 设为请求时的 `count` 参数（假值），
UI 用传统的"上一页/下一页"按钮导航，不做自动全量拉取。

### 分页策略

| 参数 | 值 | 说明 |
|------|-----|------|
| `SGP_PAGE_SIZE` | 200 | 单次请求上限（LeagueAkari 同样封顶 200） |
| `SGP_MAX_GAMES` | 500 | 目标拉取上限（用户体验限制，非 API 限制） |

分页逻辑在 `match-list.ts` 的 `fetchSgpGamesPaginated()`：
循环 `start=0, count=200` → `start=200, count=200` → `start=400, count=100`，
终止条件：返回数 < 请求数（末页）或返回空或达到 500。

### 服务器地址解析

`config.ts` 使用 **静态 import**（非 `fs.readFileSync`），因为 electron-vite 将所有
主进程代码打包进单一 `out/main/index.js`，运行时文件系统无法定位 JSON。

```
import builtinServers from './tencent-servers.json'
```

查找优先级：
1. `tencent-servers.json` 精确匹配 `TENCENT_*` → `matchHistory` URL
2. 动态拼域名 fallback: `{zone}-sgp.lol.qq.com:21019`

LeagueAkari 使用三层策略（asarUnpack + 用户数据副本 + 远程热更新），我们暂不需要。

### Token 生命周期

- 启动时从 LCU `GET /entitlements/v1/token` 获取 JWT
- SGP 请求 401 → `onTokenExpired` 回调自动续期 → 续期失败标记降级
- 不轮询 refresh，仅在 401 时被动续

### 关键文件

```
electron-app/src/main/sgp/
├── types.ts              # SGP 原始响应类型（13 接口，~110 Participant 字段）
├── config.ts             # 服务器地址解析 + 静态 JSON import
├── client.ts             # axios HTTP 客户端，Bearer auth，401 自动续期
├── extractor.ts          # 纯函数：SGP raw → GameSummary + GameRecord
├── index.ts              # SgpManager 单例：token 生命周期 + fetchGames()
└── tencent-servers.json  # 内置 10 条国服地址（兼容 LeagueAkari 格式）
```

### LeagueAkari 参考文件

本地路径 `D:\LOL\LeagueAkari`，关键参考点：

| 文件 | 参考内容 |
|------|---------|
| `src/shared/data-sources/sgp/index.ts` | HTTP 客户端实现、`getMatchHistory()` 参数 |
| `src/main/shards/sgp/data-mapper.ts` | SGP → LCU 格式映射、`gameCount` 假值处理 |
| `src/main/shards/sgp/index.ts` | Token 维护、三层配置加载、config validation |
| `resources/builtin-config/sgp/league-servers.json` | 全量服务器地址（国服+国际服） |
| `src/renderer/.../MatchHistoryTab.vue` | UI 分页：页数按钮、pageSize 下拉（10/20/30/40/50/100/200） |

### 已知限制

- SGP 单次请求 ≤200 场（LeagueAkari 同样遵守）
- SGP 可能限制总可查询范围（如最近 200 场），具体上限需实测验证
- 国服仅支持 `TENCENT_*` 大区，国际服需扩展 `tencent-servers.json`
- electron-vite 打包导致 `__dirname` 不可用于文件定位 → 静态资源统一用 import

### 构建配置

- electron-builder：`appId: com.lol-match-data.viewer`，`productName: LOL Match Data Viewer`，仅 Windows，NSIS 安装包
- 发布渠道：GitHub Releases（`provider: github`，owner: `aqq2567`，repo: `lol-match-data-viewer`）
- 自动更新：electron-updater（NSIS），首次检查在启动后 10s
- 开发端口：Vite 渲染进程默认 5173

## Release 发布清单

每次发版务必按以下步骤执行，缺一不可：

### 1. 更新版本号

```bash
# 修改 electron-app/package.json 中的 version 字段
```

### 2. 构建 + 打包

```bash
cd electron-app
npm run package
```

构建产物在 `release/` 目录下：
- `LOL-Match-Data-Viewer-Setup-X.Y.Z.exe` — NSIS 安装包
- `LOL-Match-Data-Viewer-Setup-X.Y.Z.exe.blockmap` — 增量更新块映射
- `latest.yml` — **自动更新元数据（必须上传！）**

### 3. 提交 + 打 tag

```bash
git add -A
git commit -m "vX.Y.Z: <功能简述>"
git tag -a vX.Y.Z -m "vX.Y.Z: <功能简述>"
git push origin master
git push origin vX.Y.Z
```

### 4. 创建 GitHub Release（3 个文件缺一不可）

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z: <功能简述>" \
  --notes "<更新内容>" \
  "release/LOL-Match-Data-Viewer-Setup-X.Y.Z.exe" \
  "release/LOL-Match-Data-Viewer-Setup-X.Y.Z.exe.blockmap" \
  "release/latest.yml"
```

**如果漏传 `latest.yml`，自动更新会 404 失效！**
