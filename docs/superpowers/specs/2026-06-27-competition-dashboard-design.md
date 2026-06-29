# 海斗比赛实时数据看板 — 设计规格

> 状态: 已确认 | 日期: 2026-06-27

## 背景

当前 LOL Match Data Viewer 是一个 Electron 桌面应用，数据分析和展示均在本地窗口完成。用户需要将其扩展为**线上比赛数据看板**——裁判在 Electron 端拉取数据后一键发布到网页，参赛选手和观众通过浏览器即可查看实时数据排名。

## 目标

1. Electron 新增"数据导出 + 一键发布"功能，裁判零技术操作
2. 独立纯 HTML 网页看板，电竞直播视觉风格，仪表盘网格布局
3. GitHub Pages 免费托管，全球 CDN 加速

---

## 架构概览

```
┌──────────────────────────────────────────────┐
│               Electron 应用                    │
│                                                │
│  ┌──────────┐  ┌────────────────────────────┐ │
│  │ SGP API  │  │  发布模块（新增）            │ │
│  │   ↓      │  │  dashboard-exporter.ts      │ │
│  │  提取    │  │  github-publisher.ts        │ │
│  │   ↓      │  │                              │ │
│  │  聚合    │  │  Settings UI（新增配置区）    │ │
│  └──────────┘  └────────────────────────────┘ │
│                                                │
│  裁判点「📤 发布」→ GitHub API → Pages 部署   │
└──────────────────────────────────────────────┘
          ↓
┌──────────────────────────────────────────────┐
│               web-dashboard/                   │
│  index.html + data.json + app.js + style.css  │
│  纯静态，零依赖，零构建                        │
│  仪表盘网格 + 电竞直播风                       │
└──────────────────────────────────────────────┘
          ↓
    选手浏览器访问: username.github.io/repo
```

## 关键决策

| # | 决策 | 结论 | 原因 |
|---|------|------|------|
| 1 | 比赛形式 | 线上锦标赛 | 选手分散各地，互联网访问 |
| 2 | 数据源 | Electron + LOL 客户端 | 裁判电脑运行，拉取 SGP 数据 |
| 3 | 更新方式 | 裁判手动发布 | 不需要实时推送，打完一轮更新一次 |
| 4 | 内容范围 | 精简比赛看板 | 只展示核心排名数据，去掉 AI 对话和详细分析 |
| 5 | 数据粒度 | 预聚合导出 | Electron 计算好排名，Web 只做渲染 |
| 6 | 前端形式 | 独立纯 HTML 项目 | 零依赖 Electron 类型系统，可独立部署 |
| 7 | 页面布局 | 仪表盘网格（3 列） | 一屏看全，信息密度高 |
| 8 | 视觉风格 | 电竞直播风 | 深黑底 + 霓虹色条 + 大号数字 |
| 9 | 托管平台 | GitHub Pages | 免费、全球 CDN、API 可自动化 |
| 10 | 指标选择 | 后期自定义 | 裁判可在设置中勾选要展示的指标 |

## 模块设计

### 一、数据导出模块（Electron 新增）

#### 触发位置

分析页（`AnalysisView.vue`）的 `AnalysisHeader` 区域新增 **「📤 导出比赛数据」** 按钮。

#### 计算管线

```
selectedGameIds[]（裁判勾选的对局）
  → 从 DB 读取 GameRecord[]
  → computeMetricRanking(games, metricDefs)  // 复用现有聚合管线
  → 按玩家累加每项指标 → total / count = average
  → DashboardData 输出
```

#### DashboardData 类型

```typescript
interface DashboardData {
  meta: {
    round: string           // 轮次名称，如 "第3轮"
    mode: string            // 游戏模式
    playerCount: number     // 选手数
    updatedAt: string       // ISO 时间戳
  }
  metrics: Record<string, {
    label: string           // 中文标签，如 "击杀王"
    icon: string            // emoji 图标
    color: string           // 霓虹强调色 hex
    ranking: {
      name: string          // 选手名
      champion: string      // 使用英雄
      value: number         // 聚合值
      title?: string        // 称号（仅第一名）
    }[]
  }>
}
```

#### 新增文件

```
electron-app/src/shared/
  └── utils/
      └── dashboard-exporter.ts   # 纯函数（渲染/主进程均可调用）
```

#### IPC 端点

```typescript
// 渲染进程计算好 DashboardData 后，通过此 IPC 上传
ipcMain.handle('publish:dashboard', async (_event, data: DashboardData) => {
  try {
    const url = await publishDashboard(data)
    return { status: 'success', url }
  } catch (err) {
    return { status: 'error', message: err.message }
  }
})
```

### 二、Web 前端看板（独立项目）

#### 项目结构

```
web-dashboard/
├── index.html        # 入口页面，直接 <script type="module" src="app.js">
├── data.json         # 预聚合数据（发布时由 Electron 生成）
├── app.js            # 渲染逻辑（<200 行，纯 DOM 操作）
└── style.css         # 电竞直播风视觉主题
```

零依赖、零构建。浏览器直接打开 `index.html` 即可预览。GitHub Pages 托管同样无构建步骤。

#### 页面布局

```
┌──────────────────────────────────────────┐
│  ═══════ 海斗 S3 总决赛 ═══════           │  ← 顶部霓虹渐变线条
│       ROUND 3 · 召唤师峡谷 · 10名选手      │
│        更新于 14:30  │  裁判: Admin        │
├──────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ ⚔️ 击杀王 │ │ 🛡️ 承伤王 │ │ 💰 打钱王│  │
│  │ ━━━━━━━━ │ │ ━━━━━━━━ │ │ ━━━━━━━━ │  │
│  │   18     │ │   42K    │ │  18.5K   │  │  ← 3 列网格
│  │ 选手A    │ │ 选手E    │ │ 选手A    │  │
│  │ 2.B 15   │ │ 2.F 35K  │ │ 2.D 16K  │  │
│  │ 3.C 12   │ │ 3.B 29K  │ │ 3.C 15K  │  │
│  └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  🎯 KDA  │ │ 🗡️ 伤害  │ │ 💚 治疗  │  │
│  │   6.3    │ │   38K    │ │  8.2K    │  │
│  └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────┤
│  🏆 MVP: 选手A — 击杀18·伤害38K·KDA 6.3 │  ← 底部荣誉栏
└──────────────────────────────────────────┘
```

#### 视觉规格

| 元素 | 值 |
|------|-----|
| 背景色 | `#0a0a0f`（深黑） |
| 卡片背景 | `rgba(255,255,255,0.03)` + `1px solid rgba(255,255,255,0.06)` |
| 卡片顶部色条 | 每个指标独立霓虹色，`height: 3px` |
| 大数字 | `font-size: 48px; font-weight: 900; color: #fff` |
| 标题装饰线 | `linear-gradient(90deg, transparent, #ff4655, transparent)` |
| 字体 | 系统默认（中文）+ 等宽数字 |
| 响应式 | 大屏固定 3 列，小屏自动降为 2 列 / 1 列 |

#### 颜色映射（预定义）

| 指标类型 | 霓虹色 |
|----------|--------|
| 击杀 / 伤害 | `#ff4655`（红） |
| 承伤 / 治疗 | `#54a0ff`（蓝） |
| 经济 | `#ffd700`（金） |
| KDA / 技能 | `#8b5cf6`（紫） |
| 控制 / 推塔 | `#fb923c`（橙） |
| 团队 | `#22c55e`（绿） |

#### app.js 核心逻辑

```javascript
// 1. 加载数据（支持本地开发和 GitHub Pages 两种路径）
const resp = await fetch('data.json')
const data = await resp.json()

// 2. 渲染元信息
document.getElementById('round-name').textContent = data.meta.round
document.getElementById('updated-at').textContent = data.meta.updatedAt

// 3. 渲染指标卡片网格
const grid = document.getElementById('metrics-grid')
for (const [key, metric] of Object.entries(data.metrics)) {
  const card = document.createElement('div')
  card.className = 'metric-card'
  card.style.setProperty('--accent', metric.color)
  card.innerHTML = `
    <div class="card-accent"></div>
    <div class="card-icon">${metric.icon}</div>
    <div class="card-label">${metric.label}</div>
    <div class="card-value">${formatValue(metric.ranking[0]?.value)}</div>
    <div class="card-champ">${metric.ranking[0]?.name} · ${metric.ranking[0]?.champion}</div>
    <div class="card-sub">2. ${metric.ranking[1]?.name} ${formatValue(metric.ranking[1]?.value)} · 3. ${metric.ranking[2]?.name} ${formatValue(metric.ranking[2]?.value)}</div>
  `
  grid.appendChild(card)
}

// 4. 渲染 MVP 栏
const mvp = findMVP(data)
document.getElementById('mvp-bar').textContent = `🏆 本轮 MVP：${mvp.name} — 击杀${mvp.kills}·伤害${mvp.damage}·KDA ${mvp.kda}`
```

### 三、一键发布模块（Electron 新增）

#### 设置 UI

在现有 `SettingsDialog.vue` 中新增「比赛看板」配置区：

| 字段 | 说明 | 持久化 Key |
|------|------|-----------|
| GitHub 用户名 | 用于组成 API URL | `dashboard.ghUser` |
| 仓库名 | 新建或已有 | `dashboard.ghRepo` |
| Personal Access Token | 仅需 `public_repo` 权限 | `dashboard.ghToken` |
| 轮次名称 | 如 "第3轮" | `dashboard.round` |

#### 发布流程

```
裁判点击「📤 发布数据」
  → 读取 settings 中的 token/owner/repo/round
  → 调用 GitHub Contents API:
      PUT /repos/{owner}/{repo}/contents/{path}
      Body: { message, content: base64, sha? }
  → 依次上传:
      1. data.json（DashboardData）
      2. index.html（从 web-dashboard/ 复制）
  → GitHub Pages 自动 rebuild（10-30秒生效）
  → 提示 "✅ 发布成功！看板地址: xxx.github.io/xxx"
```

#### 首次部署额外步骤

自动检测仓库是否存在 → 不存在则：
1. `POST /user/repos` 创建仓库（`auto_init: true`, `private: false`）
2. `POST /repos/{owner}/{repo}/pages` 开启 Pages（`source.branch = 'main'`）
3. 上传初始文件

后续发布跳过 1-2 步，只上传文件。

#### 新增文件

```
electron-app/src/main/
  └── publish/
      └── github-publisher.ts   # GitHub API 封装
```

#### 核心函数

```typescript
// 上传/更新仓库中的单个文件
async function uploadFile(
  token: string,
  owner: string,
  repo: string,
  path: string,          // 如 'index.html'
  content: string,       // 文件内容
  message: string        // commit message
): Promise<void>

// 一键发布入口
async function publishDashboard(data: DashboardData): Promise<string> {
  const { ghToken, ghUser, ghRepo } = getSettings().dashboard
  // 1. 序列化 data → JSON 字符串
  // 2. 读取 web-dashboard/index.html 文本内容
  // 3. 依次上传 data.json + index.html
  // 4. 返回看板 URL: https://{ghUser}.github.io/{ghRepo}
}
```

#### IPC 端点

```typescript
ipcMain.handle('publish:dashboard', async (_event, data: DashboardData) => {
  try {
    const url = await publishDashboard(data)
    return { status: 'success', url }
  } catch (err) {
    return { status: 'error', message: err.message }
  }
})
```

---

## 文件清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `electron-app/src/shared/utils/dashboard-exporter.ts` | GameRecord[] → DashboardData 转换（纯函数，渲染/主进程均可调用） |
| `electron-app/src/main/publish/github-publisher.ts` | GitHub API 封装（上传文件 + 首次仓库初始化） |
| `web-dashboard/index.html` | 看板网页入口 |
| `web-dashboard/app.js` | 渲染逻辑 |
| `web-dashboard/style.css` | 电竞直播风主题 |
| `web-dashboard/data.json` | 预聚合数据（发布时覆盖） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `electron-app/src/main/index.ts` | 注册 `publish:dashboard` IPC handler |
| `electron-app/src/renderer/src/views/AnalysisView.vue` | 新增「📤 导出比赛数据」按钮 |
| `electron-app/src/renderer/src/components/settings/SettingsDialog.vue` | 新增「比赛看板」配置区 |
| `electron-app/src/shared/types/app.ts` | 新增 `DashboardData` 类型 |
| `electron-app/src/main/utils/settings.ts` | 新增 `dashboard` 配置 key 的默认值 |

---

## 裁判工作流

### 一次性配置（首次）

1. 注册 GitHub 账号
2. Settings → Developer settings → Personal access tokens → 生成 token（勾选 `public_repo`）
3. Electron 设置页填入：用户名、仓库名、Token
4. 点「测试连接」确认配置正确

### 每轮比赛

1. 打开 Electron → 对局列表 → 勾选本轮对局
2. 进入分析页 → 确认排名数据
3. 点「📤 发布数据」
4. 等待 3 秒 → 看到 "✅ 发布成功"
5. 把看板链接发到选手群："刷新页面看数据"

---

## 非功能性设计

### 安全性

- Token 存储：写入 `settings.json`（本地文件），不入版本控制。GitHub Pages 仓库设为 public，Token 仅 Electron 本地持有
- 看板无敏感数据：不暴露玩家 PUUID、对局 ID、API Key

### 性能

- `data.json` 预估大小：10 指标 × 3 排名 × 少量字段 ≈ 2-5 KB
- `index.html` + `app.js` + `style.css` ≈ 10 KB
- 首次加载 < 500ms（GitHub Pages CDN），后续浏览器缓存 < 50ms

### 错误处理

- GitHub API 调用失败 → 返回可操作错误信息（"Token 无效，请重新生成" / "仓库不存在，请检查拼写"）
- 首次部署失败 → 分步提示（创建仓库失败 / 开启 Pages 失败 / 上传文件失败）
- 网络超时 → 30s 超时 + 重试提示

### 兼容性

- 网页看板：支持所有现代浏览器（Chrome/Firefox/Safari/Edge 最近两年版本）
- 响应式：桌面 3 列 → 平板 2 列 → 手机 1 列

---

## 未来扩展（不纳入本期）

- **方案 B 服务端直连 SGP**：代理服务器直接调用 SGP API，不依赖 LOL 客户端，定时轮询所有参赛选手数据。实现后裁判无需开电脑
- **实时 WebSocket 推送**：从"手动发布"升级为"对局结束自动推送"，需要后端服务支持
- **多轮次归档**：看板支持切换历史轮次数据，每轮独立 URL
- **自定义指标**：裁判在设置页拖拽勾选要展示的指标，动态调整 3 列网格布局
