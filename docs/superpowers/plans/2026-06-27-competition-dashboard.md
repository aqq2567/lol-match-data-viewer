# 海斗比赛实时数据看板 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Electron → GitHub Pages 的比赛数据看板一键发布系统

**Architecture:** 三个独立模块通过 `DashboardData` JSON schema 解耦：`web-dashboard/`（纯静态网页）← `data.json` 格式契约 → `dashboard-exporter.ts`（聚合计算）→ `github-publisher.ts`（API 上传）。模块之间可独立开发、测试、替换。

**Tech Stack:** TypeScript（Electron 主进程）、纯 HTML/CSS/JS（Web 看板，零框架）、GitHub REST API（发布）

## Global Constraints

- Web 看板零依赖、零构建、纯静态，浏览器直接打开即用
- 模块间只通过 `DashboardData` JSON schema 通信，不 import 彼此
- Token 存储本地 `settings.json`，不入版本控制
- 看板不暴露 PUUID、对局 ID、API Key
- 桌面 3 列 → 平板 2 列 → 手机 1 列响应式
- 支持所有现代浏览器（Chrome/Firefox/Safari/Edge 最近两年版本）

---

## 文件结构映射

| 模块 | 文件 | 职责 |
|------|------|------|
| Web 看板 | `web-dashboard/index.html` | 网页入口，零依赖加载 |
| Web 看板 | `web-dashboard/app.js` | 读取 data.json → 渲染卡片网格 + MVP 栏 |
| Web 看板 | `web-dashboard/style.css` | 电竞直播风主题 + 响应式 |
| Web 看板 | `web-dashboard/data.json` | 示例数据（开发预览用，发布时覆盖） |
| 类型契约 | `shared/types/app.ts` | 新增 `DashboardData` 接口 |
| 设置 | `main/utils/settings.ts` | 新增 `dashboard` 配置段 |
| 导出 | `shared/utils/dashboard-exporter.ts` | 纯函数: `GameRecord[]` + `MetricDef[]` → `DashboardData`（渲染/主进程均可调用） |
| 发布 | `main/publish/github-publisher.ts` | GitHub API 封装 |
| IPC | `main/index.ts` | 注册 `export:dashboard` + `publish:dashboard` |
| UI-设置 | `renderer/.../SettingsDialog.vue` | 新增「比赛看板」配置区 |
| UI-分析 | `renderer/.../views/AnalysisView.vue` | 新增「📤 导出比赛数据」按钮 |

---

### Task 1: Web 看板 — 示例数据 + HTML 骨架

**Files:**
- Create: `web-dashboard/data.json`
- Create: `web-dashboard/index.html`

**Interfaces:**
- Produces: `data.json` 的 `DashboardData` 格式（后续 Task 3 的导出模块必须对齐此格式）

- [ ] **Step 1: 创建示例数据 `data.json`**

```json
{
  "meta": {
    "round": "示例轮次",
    "mode": "召唤师峡谷",
    "playerCount": 8,
    "updatedAt": "2026-06-27T12:00:00Z"
  },
  "metrics": {
    "kills": {
      "label": "击杀王",
      "icon": "⚔️",
      "color": "#ff4655",
      "ranking": [
        { "name": "选手A", "champion": "亚索", "value": 18, "title": "死神降临" },
        { "name": "选手B", "champion": "盲僧", "value": 15, "title": "" },
        { "name": "选手C", "champion": "发条", "value": 12, "title": "" }
      ]
    },
    "deaths": {
      "label": "无暇赴死",
      "icon": "💀",
      "color": "#888888",
      "ranking": [
        { "name": "选手F", "champion": "剑姬", "value": 11, "title": "无暇赴死" },
        { "name": "选手G", "champion": "蜘蛛", "value": 9, "title": "" },
        { "name": "选手H", "champion": "维克托", "value": 8, "title": "" }
      ]
    },
    "damage": {
      "label": "伤害王",
      "icon": "🗡️",
      "color": "#ff4655",
      "ranking": [
        { "name": "选手A", "champion": "亚索", "value": 38500, "title": "我真尽力了" },
        { "name": "选手C", "champion": "发条", "value": 31200, "title": "" },
        { "name": "选手D", "champion": "金克斯", "value": 28400, "title": "" }
      ]
    },
    "tank": {
      "label": "承伤王",
      "icon": "🛡️",
      "color": "#54a0ff",
      "ranking": [
        { "name": "选手E", "champion": "蕾欧娜", "value": 42000, "title": "耐打王" },
        { "name": "选手F", "champion": "剑姬", "value": 35000, "title": "" },
        { "name": "选手B", "champion": "盲僧", "value": 29000, "title": "" }
      ]
    },
    "kda": {
      "label": "KDA",
      "icon": "🎯",
      "color": "#8b5cf6",
      "ranking": [
        { "name": "选手A", "champion": "亚索", "value": 6.3, "title": "" },
        { "name": "选手D", "champion": "金克斯", "value": 4.8, "title": "" },
        { "name": "选手C", "champion": "发条", "value": 3.2, "title": "" }
      ]
    },
    "gold": {
      "label": "打钱王",
      "icon": "💰",
      "color": "#ffd700",
      "ranking": [
        { "name": "选手A", "champion": "亚索", "value": 18500, "title": "大富翁" },
        { "name": "选手D", "champion": "金克斯", "value": 16200, "title": "" },
        { "name": "选手C", "champion": "发条", "value": 15800, "title": "" }
      ]
    }
  }
}
```

- [ ] **Step 2: 创建 `index.html` 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>海斗比赛数据看板</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header id="header">
    <div class="header-line top"></div>
    <h1 id="round-name">海斗比赛</h1>
    <p id="round-detail" class="subtitle"></p>
    <p id="meta-line" class="meta-line"></p>
    <div class="header-line bottom"></div>
  </header>

  <main id="metrics-grid" class="metrics-grid"></main>

  <footer id="mvp-bar" class="mvp-bar"></footer>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: 浏览器打开 `index.html` 验证**

在终端执行: `start web-dashboard/index.html`
预期: 空白页面 + 标题"海斗比赛数据看板"（骨架无数据渲染，卡片由 JS 动态创建）

- [ ] **Step 4: Commit**

```bash
git add web-dashboard/
git commit -m "feat(dashboard): add web dashboard HTML skeleton + sample data"
```

---

### Task 2: Web 看板 — CSS 电竞直播风主题

**Files:**
- Create: `web-dashboard/style.css`

**Interfaces:**
- Consumes: `index.html` 中的 DOM 结构（`#header`, `#metrics-grid`, `.metric-card`, `#mvp-bar`）
- Produces: 响应式 CSS 变量体系，JS 可用 `--accent` 自定义属性控制卡片色条

- [ ] **Step 1: 创建 `style.css` 完整主题**

```css
/* ═══════════════════════════════════════════
   海斗比赛看板 — 电竞直播风主题
   深黑底 + 霓虹色条 + 大号数字 + 3列响应式
   ═══════════════════════════════════════════ */

:root {
  --bg: #0a0a0f;
  --card-bg: rgba(255, 255, 255, 0.03);
  --card-border: rgba(255, 255, 255, 0.06);
  --text: #ffffff;
  --text-secondary: #888888;
  --text-muted: #555555;
  --accent: #ff4655;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Microsoft YaHei", sans-serif;
  min-height: 100vh;
  padding: 24px;
  -webkit-font-smoothing: antialiased;
}

/* ── Header ── */
#header {
  text-align: center;
  margin-bottom: 32px;
}

.header-line {
  height: 1px;
  max-width: 600px;
  margin: 0 auto;
}

.header-line.top {
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  margin-bottom: 16px;
}

.header-line.bottom {
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  margin-top: 16px;
}

#round-name {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 6px;
  text-shadow: 0 0 20px rgba(255, 70, 85, 0.5);
  text-transform: uppercase;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 3px;
  margin-top: 4px;
}

.meta-line {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ── Metrics Grid ── */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Metric Card ── */
.metric-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 20px 16px 16px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}

.metric-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
}

.card-icon {
  font-size: 14px;
  margin-bottom: 6px;
}

.card-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 8px;
}

.card-value {
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}

.card-champion {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 8px;
}

.card-champion .role {
  color: var(--text-secondary);
}

.card-sub {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── MVP Bar ── */
.mvp-bar {
  text-align: center;
  margin-top: 32px;
  padding: 14px 24px;
  font-size: 14px;
  font-weight: 700;
  color: #ffd700;
  letter-spacing: 2px;
  background: rgba(255, 215, 0, 0.06);
  border: 1px solid rgba(255, 215, 0, 0.15);
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  #round-name { font-size: 22px; letter-spacing: 4px; }
  .card-value { font-size: 36px; }
}

@media (max-width: 560px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  body { padding: 16px; }
  #round-name { font-size: 18px; letter-spacing: 3px; }
  .card-value { font-size: 32px; }
}
```

- [ ] **Step 2: 浏览器打开验证 CSS**

在终端执行: `start web-dashboard/index.html`
预期: 深黑背景，标题带霓虹渐变线条（卡片仍为空因为 JS 未写）

- [ ] **Step 3: Commit**

```bash
git add web-dashboard/style.css
git commit -m "feat(dashboard): add esports broadcast CSS theme + responsive grid"
```

---

### Task 3: Web 看板 — app.js 渲染逻辑

**Files:**
- Create: `web-dashboard/app.js`

**Interfaces:**
- Consumes: `data.json`（`DashboardData` 格式），`index.html` 的 DOM 元素 ID
- Produces: 渲染完整的卡片网格 + MVP 栏

- [ ] **Step 1: 创建 `app.js`**

```javascript
/**
 * 海斗比赛看板 — 渲染逻辑
 * 读取 data.json → 渲染 Header + 指标卡片网格 + MVP 栏
 * 零框架，纯 DOM 操作
 */

// ── 数字格式化 ──
function fmt(v) {
  if (v == null || Number.isNaN(v)) return '0'
  if (v >= 10000) return (v / 1000).toFixed(1) + 'K'
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

// ── 加载数据 ──
async function loadData() {
  const resp = await fetch('data.json')
  if (!resp.ok) throw new Error(`数据加载失败: ${resp.status}`)
  return resp.json()
}

// ── 渲染 Header ──
function renderHeader(meta) {
  document.getElementById('round-name').textContent = meta.round || '海斗比赛'
  document.getElementById('round-detail').textContent =
    `${meta.mode || ''} · ${meta.playerCount || 0}名选手`
  document.getElementById('meta-line').textContent =
    `更新于 ${new Date(meta.updatedAt).toLocaleString('zh-CN')}`
}

// ── 渲染单张指标卡片 ──
function createCard(metric) {
  const card = document.createElement('div')
  card.className = 'metric-card'
  card.style.setProperty('--accent', metric.color || '#ff4655')

  const top = metric.ranking[0] || {}
  const top2 = metric.ranking[1]
  const top3 = metric.ranking[2]

  let subText = ''
  if (top2) subText += `2. ${top2.name} ${fmt(top2.value)}`
  if (top3) subText += ` · 3. ${top3.name} ${fmt(top3.value)}`

  card.innerHTML = `
    <div class="card-accent"></div>
    <div class="card-icon">${metric.icon || ''}</div>
    <div class="card-label">${metric.label}</div>
    <div class="card-value">${fmt(top.value)}</div>
    <div class="card-champion">
      ${top.name || '—'}<span class="role"> · ${top.champion || ''}</span>
      ${top.title ? `<br><span style="font-size:11px;color:var(--accent)">「${top.title}」</span>` : ''}
    </div>
    <div class="card-sub">${subText}</div>
  `
  return card
}

// ── 渲染网格 ──
function renderGrid(metrics) {
  const grid = document.getElementById('metrics-grid')
  grid.innerHTML = ''
  for (const [key, metric] of Object.entries(metrics)) {
    if (metric.ranking && metric.ranking.length > 0) {
      grid.appendChild(createCard(metric))
    }
  }
}

// ── 找出 MVP ──
function findMVP(metrics) {
  let best = null
  let bestScore = -1
  for (const [key, metric] of Object.entries(metrics)) {
    const top = metric.ranking[0]
    if (!top) continue
    // MVP 积分：第一名 +3, 第二名 +2, 第三名 +1，累计各指标
    let score = 3
    if (!best || score > bestScore) {
      best = top
      bestScore = score
    }
  }
  // 实际 MVP 取在各指标中第一名出现次数最多的选手
  const scores = {}
  for (const [key, metric] of Object.entries(metrics)) {
    for (let i = 0; i < metric.ranking.length; i++) {
      const r = metric.ranking[i]
      if (!r) continue
      scores[r.name] = (scores[r.name] || 0) + (3 - i)
    }
  }
  let mvpName = ''
  let mvpMax = 0
  for (const [name, s] of Object.entries(scores)) {
    if (s > mvpMax) { mvpMax = s; mvpName = name }
  }
  // 找到该选手登顶的指标
  const tops = []
  for (const [key, metric] of Object.entries(metrics)) {
    if (metric.ranking[0]?.name === mvpName) {
      tops.push(`${metric.icon} ${metric.label} ${fmt(metric.ranking[0].value)}`)
    }
  }
  return { name: mvpName, tops: tops.slice(0, 3).join(' · ') }
}

// ── 渲染 MVP ──
function renderMVP(metrics) {
  const mvp = findMVP(metrics)
  document.getElementById('mvp-bar').innerHTML =
    `🏆 本轮 MVP：<strong>${mvp.name}</strong> — ${mvp.tops || '多项数据领先'}`
}

// ── 主流程 ──
async function main() {
  try {
    const data = await loadData()
    renderHeader(data.meta || {})
    renderGrid(data.metrics || {})
    renderMVP(data.metrics || {})
  } catch (err) {
    document.getElementById('metrics-grid').innerHTML =
      `<p style="text-align:center;color:#888;padding:60px">⚠️ ${err.message}</p>`
  }
}

main()
```

- [ ] **Step 2: 浏览器打开验证完整看板**

在终端执行: `start web-dashboard/index.html`
预期: 完整仪表盘 — 标题带霓虹线 + 6 张指标卡片（3×2 网格）+ 底部 MVP 栏

- [ ] **Step 3: 验证响应式**

浏览器缩放窗口宽度到 < 900px → 卡片应变为 2 列
继续缩放到 < 560px → 卡片应变为 1 列

- [ ] **Step 4: Commit**

```bash
git add web-dashboard/app.js
git commit -m "feat(dashboard): add JS rendering logic — cards grid + MVP + responsive"
```

---

### Task 4: 类型契约 — DashboardData 接口

**Files:**
- Modify: `electron-app/src/shared/types/app.ts` — 在文件末尾追加 `DashboardData` 类型

**Interfaces:**
- Produces: `DashboardData` 接口（导出模块和发布模块的契约）

- [ ] **Step 1: 在 `app.ts` 末尾追加类型定义**

在 `electron-app/src/shared/types/app.ts` 的 `export interface GameDataCache { ... }` 之后追加：

```typescript
// ═══════════════════════════════════════════════════════════
// 比赛看板导出数据（web-dashboard 与 Electron 之间的唯一契约）
// ═══════════════════════════════════════════════════════════

export interface DashboardMetricEntry {
  name: string          // 选手名
  champion: string      // 使用英雄
  value: number         // 聚合值（总计或平均）
  title?: string        // 称号（仅第一名，如"死神降临"）
}

export interface DashboardMetric {
  label: string         // 中文标签，如 "击杀王"
  icon: string          // emoji 图标
  color: string         // 霓虹强调色 hex
  ranking: DashboardMetricEntry[]  // Top 3 排名
}

export interface DashboardData {
  meta: {
    round: string       // 轮次名称，如 "第3轮"
    mode: string        // 游戏模式
    playerCount: number // 选手数
    updatedAt: string   // ISO 时间戳
  }
  metrics: Record<string, DashboardMetric>  // key → 指标数据
}
```

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过（新类型暂未被引用，不影响现有代码）

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/shared/types/app.ts
git commit -m "feat(dashboard): add DashboardData + DashboardMetric types to shared types"
```

---

### Task 5: 设置扩展 — dashboard 配置段

**Files:**
- Modify: `electron-app/src/main/utils/settings.ts`

**Interfaces:**
- Produces: `UserSettings.dashboard` 字段（publisher 和 SettingsDialog 消费）

- [ ] **Step 1: 扩展 `UserSettings` 接口**

在 `settings.ts` 第 11-14 行，`UserSettings` 接口中新增 `dashboard` 字段：

```typescript
interface DashboardConfig {
  ghUser: string       // GitHub 用户名
  ghRepo: string       // 仓库名
  ghToken: string      // Personal Access Token (public_repo 权限)
  round: string        // 轮次名称，默认 "第1轮"
}

interface UserSettings {
  autoUpdate: boolean
  deepseekApiKey?: string
  dashboard?: DashboardConfig  // 新增：比赛看板发布配置
}
```

- [ ] **Step 2: 更新默认值**

修改 `getSettings()` 中的默认值逻辑（第 40-43 行）：

```typescript
if (!_cache) {
  _cache = {
    autoUpdate: true,
    dashboard: {
      ghUser: '',
      ghRepo: '',
      ghToken: '',
      round: '第1轮',
    },
  }
  saveSettings()
}
```

- [ ] **Step 3: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过

- [ ] **Step 4: Commit**

```bash
git add electron-app/src/main/utils/settings.ts
git commit -m "feat(dashboard): add DashboardConfig to UserSettings"
```

---

### Task 6: 导出模块 — dashboard-exporter.ts

**Files:**
- Create: `electron-app/src/shared/utils/dashboard-exporter.ts`

**Interfaces:**
- Consumes: `GameRecord[]`（来自 DB 或内存）、`MetricDef[]`（来自 mode-analysis-config）、`DashboardData`（类型契约）
- Produces: `exportDashboardData(games, options) => DashboardData`

- [ ] **Step 1: 创建 `dashboard-exporter.ts`**

```typescript
/**
 * 比赛看板数据导出器
 * 纯函数：GameRecord[] + 指标配置 → DashboardData
 * 不依赖 Electron/Node API，可直接单元测试
 */
import type { GameRecord, DashboardData, DashboardMetric } from '@shared/types'
import type { MetricDef } from '@shared/utils/mode-analysis-config'
import { computeMetricRanking } from '@domain/analysis/aggregation'

/** 默认导出的指标 key 列表 */
const DEFAULT_METRIC_KEYS = [
  'kills', 'deaths', 'assists', 'kda',
  'damage', 'tank', 'heal', 'gold',
  'cs', 'vision', 'ccDealt', 'totalSpellCasts',
]

/** 指标 key → 看板展示元数据（label/icon/color） */
const METRIC_META: Record<string, { label: string; icon: string; color: string }> = {
  kills:  { label: '击杀王', icon: '⚔️', color: '#ff4655' },
  deaths: { label: '无暇赴死', icon: '💀', color: '#888888' },
  assists:{ label: '助攻王', icon: '🤝', color: '#22c55e' },
  kda:    { label: 'KDA 之王', icon: '🎯', color: '#8b5cf6' },
  damage: { label: '伤害王', icon: '🗡️', color: '#ff4655' },
  tank:   { label: '承伤王', icon: '🛡️', color: '#54a0ff' },
  heal:   { label: '治疗王', icon: '💚', color: '#54a0ff' },
  gold:   { label: '打钱王', icon: '💰', color: '#ffd700' },
  cs:     { label: '补刀王', icon: '👨‍🌾', color: '#ffd700' },
  vision: { label: '视野王', icon: '👁️', color: '#54a0ff' },
  ccDealt:{ label: '控制王', icon: '🔗', color: '#fb923c' },
  totalSpellCasts: { label: '技能狂人', icon: '🔮', color: '#8b5cf6' },
  largestCrit: { label: '暴击王', icon: '💥', color: '#ff4655' },
  selfMitigated: { label: '钢铁之躯', icon: '🦾', color: '#fb923c' },
}

export interface ExportOptions {
  round: string              // 轮次名称
  gameMode: string           // 游戏模式
  metricKeys?: string[]      // 要导出的指标 key 列表，默认 DEFAULT_METRIC_KEYS
  metricDefs?: MetricDef[]   // MetricDef 列表（用于 getter 函数）
}

/**
 * 将 GameRecord[] 转换为 DashboardData
 *
 * @param games 选中的对局记录
 * @param allMetricDefs 全部可用指标定义（basic + advanced 合并）
 * @param options 轮次名、模式名、自定义指标 keys
 */
export function exportDashboardData(
  games: GameRecord[],
  allMetricDefs: MetricDef[],
  options: ExportOptions,
): DashboardData {
  const keys = options.metricKeys || DEFAULT_METRIC_KEYS

  // 构建 key → MetricDef 索引
  const defByKey = new Map<string, MetricDef>()
  for (const d of allMetricDefs) {
    defByKey.set(d.key, d)
  }

  // 聚合全部玩家去重计数
  const playerNames = new Set<string>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      playerNames.add(p.summoner_name)
    }
  }

  // 为每个指标计算 Top 3 排名
  const metrics: Record<string, DashboardMetric> = {}
  for (const key of keys) {
    const def = defByKey.get(key)
    if (!def) continue  // 跳过未匹配的 key

    const meta = METRIC_META[key] || { label: def.label, icon: '📊', color: '#888888' }

    // 复用现有聚合管线
    const ranking = computeMetricRanking(games, def.getter)
      .slice(0, 3)
      .map((r, i) => ({
        name: r.playerName,
        champion: '',       // champion 需要从 GameRecord 中按名字查找
        value: r.total,
        title: i === 0 ? getFirstPlaceTitle(key) : undefined,
      }))

    // 补全 champion 信息
    for (const entry of ranking) {
      entry.champion = findChampionForPlayer(games, entry.name)
    }

    metrics[key] = {
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      ranking,
    }
  }

  return {
    meta: {
      round: options.round,
      mode: options.gameMode,
      playerCount: playerNames.size,
      updatedAt: new Date().toISOString(),
    },
    metrics,
  }
}

/** 从 GameRecord[] 中按玩家名查找最近使用的英雄 */
function findChampionForPlayer(games: GameRecord[], playerName: string): string {
  // 倒序遍历，找该玩家最后一次使用的英雄
  for (let i = games.length - 1; i >= 0; i--) {
    for (const p of [...games[i].blue_team.players, ...games[i].red_team.players]) {
      if (p.summoner_name === playerName && p.champion_id) {
        return `英雄#${p.champion_id}`  // 实际渲染时需要 GameDataCache 做 ID→name 映射
      }
    }
  }
  return ''
}

/** 第一名称号映射（与 mode-analysis-config 的 podiumTitles 一致） */
function getFirstPlaceTitle(key: string): string {
  const titles: Record<string, string> = {
    kills: '死神降临',
    deaths: '无暇赴死',
    assists: '我K不到啊',
    damage: '我真尽力了',
    tank: '耐打王',
    largestCrit: '艺术就是核爆',
    heal: '奶一口奶一口奶一口',
    selfMitigated: '不疼',
    gold: '大富翁',
    cs: 'Choooooooooovy!',
    ccDealt: '就是折磨就是胶粘',
    kda: '不死之身',
    totalSpellCasts: '键盘冒烟',
    vision: '全图扫描',
  }
  return titles[key] || ''
}
```

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/shared/utils/dashboard-exporter.ts
git commit -m "feat(dashboard): add dashboard-exporter — GameRecord[] to DashboardData"
```

---

### Task 7: 发布模块 — github-publisher.ts

**Files:**
- Create: `electron-app/src/main/publish/github-publisher.ts`

**Interfaces:**
- Consumes: `DashboardData`（类型契约）、`getSettings()`（读 Token/User/Repo）
- Produces: `publishDashboard(data) => Promise<string>`（返回看板 URL）

- [ ] **Step 1: 创建 `github-publisher.ts`**

```typescript
/**
 * GitHub Pages 一键发布模块
 * 把 data.json + index.html 上传到 GitHub 仓库，触发 Pages 自动部署
 *
 * 依赖: 仅 fetch API（Node 18+ 内置）和 settings
 */
import { getSettings } from '@main/utils/settings'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { DashboardData } from '@shared/types'

const GITHUB_API = 'https://api.github.com'

/** GitHub Contents API 响应 */
interface GhContent {
  sha?: string
  content?: string
}

/**
 * Base64 编码（支持 UTF-8）
 */
function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

/**
 * 发送 GitHub API 请求
 */
async function ghRequest(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  const resp = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return resp
}

/** 获取文件当前 sha（如果存在），不存在返回 null */
async function getFileSha(
  token: string, owner: string, repo: string, filePath: string,
): Promise<string | null> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}/contents/${filePath}`)
  if (resp.status === 404) return null
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`获取文件信息失败 (${resp.status}): ${(err as any).message || resp.statusText}`)
  }
  const data: GhContent = await resp.json()
  return data.sha || null
}

/** 上传/更新单个文件到仓库 */
async function uploadFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  message: string,
): Promise<void> {
  const sha = await getFileSha(token, owner, repo, filePath)
  const body: Record<string, unknown> = {
    message,
    content: toBase64(content),
  }
  if (sha) body.sha = sha

  const resp = await ghRequest(token, 'PUT', `/repos/${owner}/${repo}/contents/${filePath}`, body)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    if (resp.status === 401) throw new Error('Token 无效或已过期，请重新生成')
    if (resp.status === 404) throw new Error(`仓库 "${owner}/${repo}" 不存在，请检查拼写`)
    throw new Error(`上传失败 (${resp.status}): ${(err as any).message || resp.statusText}`)
  }
}

/** 确保仓库存在，不存在则自动创建 */
async function ensureRepo(token: string, owner: string, repo: string): Promise<void> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}`)
  if (resp.ok) return  // 已存在

  if (resp.status !== 404) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`检查仓库失败 (${resp.status}): ${(err as any).message || resp.statusText}`)
  }

  // 创建仓库
  const createResp = await ghRequest(token, 'POST', '/user/repos', {
    name: repo,
    auto_init: true,
    private: false,
  })
  if (!createResp.ok) {
    const err = await createResp.json().catch(() => ({}))
    if (createResp.status === 422) throw new Error(`仓库 "${repo}" 已存在但无法访问，请检查 Token`)
    throw new Error(`创建仓库失败 (${createResp.status}): ${(err as any).message || ''}`)
  }
}

/** 确保 Pages 已启用 */
async function ensurePages(token: string, owner: string, repo: string): Promise<void> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}/pages`)
  if (resp.ok) return  // 已启用

  // 启用 Pages
  const enableResp = await ghRequest(token, 'POST', `/repos/${owner}/${repo}/pages`, {
    source: { branch: 'main', path: '/' },
  })
  if (!enableResp.ok && enableResp.status !== 409) {  // 409 = 已存在（竞态）
    const err = await enableResp.json().catch(() => ({}))
    throw new Error(`启用 Pages 失败 (${enableResp.status}): ${(err as any).message || ''}`)
  }
}

/**
 * 一键发布看板
 *
 * @param data 预聚合的 DashboardData
 * @returns 看板访问 URL
 */
export async function publishDashboard(data: DashboardData): Promise<string> {
  const settings = getSettings()
  const cfg = settings.dashboard
  if (!cfg || !cfg.ghToken || !cfg.ghUser || !cfg.ghRepo) {
    throw new Error('请先在设置中配置 GitHub 用户名、仓库名和 Token')
  }

  const { ghToken, ghUser, ghRepo } = cfg

  // 1. 确保仓库存在 + Pages 启用
  await ensureRepo(ghToken, ghUser, ghRepo)
  await ensurePages(ghToken, ghUser, ghRepo)

  // 2. 序列化数据
  const dataJson = JSON.stringify(data, null, 2)

  // 3. 读取 web-dashboard/index.html 模板
  const htmlPath = join(__dirname, '..', '..', '..', '..', 'web-dashboard', 'index.html')
  let htmlContent: string
  try {
    htmlContent = readFileSync(htmlPath, 'utf-8')
  } catch {
    throw new Error(`找不到看板模板文件: ${htmlPath}`)
  }

  const now = new Date().toLocaleString('zh-CN')
  const commitMsg = `📊 更新比赛数据 — ${data.meta.round} (${now})`

  // 4. 上传（data.json 先上传，确保 index.html 引用时数据已就绪）
  await uploadFile(ghToken, ghUser, ghRepo, 'data.json', dataJson, commitMsg)
  await uploadFile(ghToken, ghUser, ghRepo, 'index.html', htmlContent, commitMsg)

  return `https://${ghUser}.github.io/${ghRepo}`
}
```

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/publish/
git commit -m "feat(dashboard): add github-publisher — upload to GitHub Pages via API"
```

---

### Task 8: IPC 注册 — publish:dashboard 端点

**Files:**
- Modify: `electron-app/src/main/index.ts`

**Interfaces:**
- Produces: IPC handler `publish:dashboard`（渲染进程计算好 DashboardData，主进程只负责上传）

**设计决策**: `exportDashboardData()` 是纯函数，放在 `shared/utils/`，渲染进程直接 import 调用。不需要 `export:dashboard` IPC——渲染进程已有 `GameRecord[]` 和 `MetricDef[]`，在本地算出 `DashboardData` 后直接调 `publish:dashboard` IPC 上传。这样零数据传输开销，逻辑内聚在渲染进程。

- [ ] **Step 1: 在 `index.ts` 注册 publish:dashboard handler**

在 `electron-app/src/main/index.ts` 中，找到现有 IPC handler 注册区域（`ipcMain.handle('settings:set', ...)` 之后），追加：

```typescript
import { publishDashboard } from '@main/publish/github-publisher'
import type { DashboardData } from '@shared/types'

// ═══ 比赛看板发布 ═══

ipcMain.handle('publish:dashboard', async (_event, data: DashboardData) => {
  console.log(`[DASHBOARD] publish:dashboard — round="${data.meta.round}", ${Object.keys(data.metrics).length} metrics`)
  try {
    const url = await publishDashboard(data)
    console.log(`[DASHBOARD] 发布成功: ${url}`)
    return { status: 'success', url }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[DASHBOARD] 发布失败: ${msg}`)
    return { status: 'error', message: msg }
  }
})
```

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/index.ts
git commit -m "feat(dashboard): register publish:dashboard IPC handler"
```

---

### Task 9: UI — 设置页新增「比赛看板」配置区

**Files:**
- Modify: `electron-app/src/renderer/src/components/settings/SettingsDialog.vue`

**Interfaces:**
- Consumes: `window.lcuApi` 中的 settings get/set
- Produces: 四个配置字段 UI（ghUser, ghRepo, ghToken, round）

- [ ] **Step 1: 读取现有 SettingsDialog.vue 完整内容**

用 Read 工具读取 `electron-app/src/renderer/src/components/settings/SettingsDialog.vue` 的 `<script setup>` 部分和 `<template>` 结尾部分。

- [ ] **Step 2: 在 `<script setup>` 中新增 dashboard 配置响应式变量**

在现有 `apiKey` ref 之后追加：

```typescript
// ── 比赛看板配置 ──
const ghUser = ref('')
const ghRepo = ref('')
const ghToken = ref('')
const round = ref('第1轮')
const publishLoading = ref(false)
```

在 `onMounted` 中追加读取逻辑（在现有 `apiKey.value = settings.deepseekApiKey || ''` 之后）：

```typescript
// 读取 dashboard 配置
const dashCfg = (settings as any).dashboard
if (dashCfg) {
  ghUser.value = dashCfg.ghUser || ''
  ghRepo.value = dashCfg.ghRepo || ''
  ghToken.value = dashCfg.ghToken || ''
  round.value = dashCfg.round || '第1轮'
}
```

新增保存函数：

```typescript
async function onGhUserChange(v: string) {
  ghUser.value = v
  await window.lcuApi.setSetting('dashboard', { ...settings.dashboard, ghUser: v })
}
async function onGhRepoChange(v: string) {
  ghRepo.value = v
  await window.lcuApi.setSetting('dashboard', { ...settings.dashboard, ghRepo: v })
}
async function onGhTokenChange(v: string) {
  ghToken.value = v
  await window.lcuApi.setSetting('dashboard', { ...settings.dashboard, ghToken: v })
}
async function onRoundChange(v: string) {
  round.value = v
  await window.lcuApi.setSetting('dashboard', { ...settings.dashboard, round: v })
}
```

- [ ] **Step 3: 在 `<template>` 中新增配置区 UI**

在 SettingsDialog 的 `<template>` 中，最后一个 `</div>` 之前（`</n-modal>` 之前），追加：

```html
<n-divider />

<!-- 比赛看板 -->
<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">📊 比赛看板发布</span>
    <span class="setting-desc">配置 GitHub Pages 一键发布</span>
  </div>
</div>

<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">GitHub 用户名</span>
  </div>
  <n-input
    placeholder="你的 GitHub 用户名"
    :value="ghUser"
    style="width: 200px"
    size="small"
    @update:value="onGhUserChange"
  />
</div>

<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">仓库名</span>
  </div>
  <n-input
    placeholder="如 haidou-s3"
    :value="ghRepo"
    style="width: 200px"
    size="small"
    @update:value="onGhRepoChange"
  />
</div>

<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">Personal Token</span>
    <span class="setting-desc">需勾选 public_repo 权限</span>
  </div>
  <n-input
    type="password"
    placeholder="ghp_..."
    :value="ghToken"
    style="width: 200px"
    size="small"
    @update:value="onGhTokenChange"
  />
</div>

<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">轮次名称</span>
  </div>
  <n-input
    placeholder="第1轮"
    :value="round"
    style="width: 200px"
    size="small"
    @update:value="onRoundChange"
  />
</div>

<div class="setting-row">
  <div class="setting-label">
    <span class="setting-title">看板地址</span>
    <span class="setting-desc" v-if="ghUser && ghRepo">{{ ghUser }}.github.io/{{ ghRepo }}</span>
    <span class="setting-desc" v-else>请先填写用户名和仓库名</span>
  </div>
  <n-button size="small" :disabled="!ghUser || !ghRepo" @click="() => window.lcuApi.openExternal(`https://${ghUser}.github.io/${ghRepo}`)">
    打开看板
  </n-button>
</div>
```

- [ ] **Step 4: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过，或如有 vue-tsc 报错则按实际调整

- [ ] **Step 5: Commit**

```bash
git add electron-app/src/renderer/src/components/settings/SettingsDialog.vue
git commit -m "feat(dashboard): add GitHub Pages config UI to SettingsDialog"
```

---

### Task 10: UI — 分析页新增「📤 导出发布」按钮

**Files:**
- Modify: `electron-app/src/renderer/src/views/AnalysisView.vue`

**Interfaces:**
- Consumes: 当前选中的 `selectedGameIds`、`result` 数据
- Produces: 触发 `export:dashboard` → 调用 `publish:dashboard` → 提示结果

- [ ] **Step 1: 在 `<script setup>` 中新增发布逻辑**

在 AnalysisView.vue 的 `<script setup>` 中，现有 `const message = useMessage()` 之后追加：

```typescript
import { exportDashboardData } from '@shared/utils/dashboard-exporter'
import { getModeAnalysisConfig } from '@shared/utils/mode-analysis-config'

// ── 比赛看板导出 + 发布 ──
const publishLoading = ref(false)

async function handleExportAndPublish() {
  if (!result.value || result.value.gameCount === 0) {
    message.warning('请先勾选至少一场对局')
    return
  }
  publishLoading.value = true
  try {
    // Step 1: 渲染进程本地计算 DashboardData（纯函数，不经过 IPC）
    const allMetrics = [...basicMetrics.value, ...advancedMetrics.value]
    const dashboardData = exportDashboardData(
      analysisGames.value,   // 当前选中的 GameRecord[]，已在内存中
      allMetrics,
      {
        round: '第1轮',      // 后续可从 settings 读取
        gameMode: modeDisplayName.value,
      },
    )

    // Step 2: 通过 IPC 发布到 GitHub Pages（唯一跨进程调用）
    const publishResp = await window.lcuApi.publishDashboard(dashboardData)
    if (publishResp.status === 'success') {
      message.success(`发布成功！看板地址: ${publishResp.url}`)
    } else {
      message.error(`发布失败: ${publishResp.message}`)
    }
  } catch (err: unknown) {
    message.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    publishLoading.value = false
  }
}
```

- [ ] **Step 2: 在 `<template>` 的 AnalysisHeader 区域新增按钮**

在 `<AnalysisHeader ... />` 之后、`<div class="analysis-body">` 之前，追加：

```html
<div v-if="result && result.gameCount > 0" style="text-align:right;margin-bottom:8px">
  <n-button
    type="primary"
    size="small"
    :loading="publishLoading"
    @click="handleExportAndPublish"
  >
    <template #icon><n-icon><cloud-upload-outline /></n-icon></template>
    📤 发布比赛数据
  </n-button>
</div>
```

同时在 import 区追加图标导入：
```typescript
import { AnalyticsOutline, ListOutline, CloudUploadOutline } from '@vicons/ionicons5'
```

- [ ] **Step 3: 补充 preload 类型定义**

在 `electron-app/src/preload/index.ts`（或相应的类型声明文件）中，确保 `window.lcuApi` 暴露了 `exportDashboard` 和 `publishDashboard` 方法。如果现有的 `window.lcuApi` 是动态注册的，则在 `electron-app/src/main/ipc/lcu-handlers.ts` 中追加对应的 IPC 调用转发。

检查 preload 暴露的方法签名——只需 `publishDashboard`：

```typescript
// 在 window.lcuApi 类型中追加
publishDashboard: (data: DashboardData) => Promise<{ status: string; url?: string; message?: string }>
```

- [ ] **Step 4: TypeScript 编译验证**

```bash
cd electron-app && npx tsc --noEmit
```
预期: 编译通过

- [ ] **Step 5: 功能验证**

```bash
cd electron-app && npm run dev
```
预期: 启动 Electron → 进入分析页 → 勾选对局 → 点击「📤 发布比赛数据」按钮 → 测试完整发布流程

- [ ] **Step 6: Commit**

```bash
git add electron-app/src/renderer/src/views/AnalysisView.vue
git add electron-app/src/preload/index.ts  # 如有修改
git commit -m "feat(dashboard): add export + publish button to AnalysisView"
```

---

## 阶段划分

| 阶段 | Task | 内容 | 可独立测试 |
|------|------|------|-----------|
| **Phase 1: Web 看板** | 1-3 | HTML + CSS + JS + 示例数据 | ✅ 浏览器直接打开 `web-dashboard/index.html` |
| **Phase 2: 基础设施** | 4-5 | 类型定义 + 设置扩展 | ✅ `npx tsc --noEmit` |
| **Phase 3: 导出模块** | 6 | dashboard-exporter.ts 纯函数 | ✅ 单元测试（不依赖 Electron） |
| **Phase 4: 发布模块** | 7 | github-publisher.ts | ✅ 手动调用 `publishDashboard(mockData)` |
| **Phase 5: 接入** | 8-10 | IPC + 设置 UI + 分析页按钮 | ✅ `npm run dev` 全链路测试 |
