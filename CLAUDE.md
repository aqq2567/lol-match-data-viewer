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

## LCU API 数据源限制与 SGP 扩展

### 当前状态（v0.4.0）

LCU match-history API 单玩家上限 **~200 场**。经实验验证：

| endIndex | 返回 | 说明 |
|----------|------|------|
| 99 | 100 场 | 仅命中 LCU 本地缓存 |
| 499 | 200 场 | 触发 LCU 从服务端拉取 |
| 1999 | 200 场 | 服务端 gameCount=200，硬上限 |

代码位于 `electron-app/src/main/lcu/extractor.ts`：
- `PAGE_SIZE=500`：单次 `begIndex`/`endIndex` 范围（endIndex 必须 ≥499 触发热加载）
- `fetchMatchPage()`：同时尝试 `begIndex` 和 `beginIndex`，取结果更多的一方，失败时等待 3s 重试
- `fetchAllSummaries()`：所有分页 `Promise.all` 并行发出，`Set<number>` 去重
- `loadDetailMap()`：先查 `gameDetailCache`（会话级 `Map<gameId, detail>`），未命中一次性全量并行拉取
- `MAX_FETCH_COUNT=2000` 为安全阀

### SGP API（未来扩展参考）

LeagueAkari 使用 **双数据源** 突破 200 场上限，详细分析见 `docs/LEAGUEAKARI_ANALYSIS.md`：

**SGP（Service Gateway Proxy）** 是 Riot 后端直连 API，不经过 LCU 代理，支持无限分页。

接入所需步骤：

1. **获取 entitlementsToken**：`GET /entitlements/v1/token` → `{ accessToken: "JWT..." }`
2. **SGP 服务器地址**（国服）：
   - 大区 ID 格式：`TENCENT_{rsoPlatformId}`（如 HN1, NJ100 等）
   - 战绩服务器：`https://{zone}-sgp.lol.qq.com:21019`
   - 全量配置见 `D:\LOL\LeagueAkari\resources\builtin-config\sgp\league-servers.json`
3. **请求战绩**：`GET /match-history-query/v1/products/lol/player/{puuid}/SUMMARY?startIndex=0&count=200`
   - Header：`Authorization: Bearer {entitlementsToken}`
   - 响应包含完整对局数据（无需二次请求详情）
   - 通过递增 `startIndex` 可遍历全部历史

**SGP vs LCU 对比**：

| | LCU API | SGP API |
|--|---------|---------|
| 端点 | `127.0.0.1:{port}` | Riot 远程服务器 |
| 上限 | ~200 场 | 无限制（可分页） |
| 数据 | 摘要，需二次请求 | 完整对局 |
| 认证 | Basic Auth | Bearer JWT |
| 队列过滤 | 不支持 | `tag` 参数（如 `q_420`=排位） |

### LeagueAkari 参考副本

本地克隆位置：`D:\LOL\LeagueAkari`。关键文件：
- `src/shared/data-sources/sgp/index.ts` — SGP HTTP 客户端
- `src/main/shards/sgp/data-mapper.ts` — SGP → LCU 格式映射
- `src/main/shards/sgp/index.ts` — Token 维护与 IPC
- `src/shared/http-api-axios-helper/league-client/match-history.ts` — LCU match-history 端点
- `resources/builtin-config/sgp/league-servers.json` — SGP 服务器地址配置

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
