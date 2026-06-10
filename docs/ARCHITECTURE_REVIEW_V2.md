# 架构审查报告 V2

> 对比基准：`ARCHITECTURE_REVIEW.md`（V1，领域层迁移前）
> 审查日期：2026-06-06

---

## 1. 已解决的问题

### 1.1 领域层 — ✗ 缺失 → ✓ 已完整建立

| | V1 | V2 |
|----|----|-----|
| 领域计算位置 | 散落在 Vue computed + shared/utils | `src/domain/analysis/` 6 文件 / 40 导出 |
| 框架依赖 | 寄生在 Vue 组件生命周期中 | **零** — 纯 TypeScript，无 Vue/Electron/Pinia |
| 可测试性 | 必须 mount Vue 组件 | 任意测试框架可直接 `import` 并断言 |
| 可复用性 | 无法在 CLI/其他 UI 中复用 | 同一份代码可用于任何 TypeScript 运行时 |

| 文件 | 导出数 | 职责 |
|------|--------|------|
| `types.ts` | 11 | 分析领域全部类型定义 |
| `aggregation.ts` | 7 | 玩家聚合、指标排名、领奖台、最佳查找、PlayerAnalysis 构建 |
| `frequency.ts` | 10 | 英雄/装备/增幅全局频次、个人偏好、关联用户查询 |
| `advanced-metrics.ts` | 1 | 角色率/伤害比排名（11 个高阶指标） |
| `friends.ts` | 4 | 好友指标定义、排序、领奖台、称号 |
| `match-stats.ts` | 7 | 常用英雄、队友/对手频次、KDA、胜负统计、场次显示 |

**V1 核心问题**："没有一个聚合点封装'什么是分析'这个概念" — **已解决。** `src/domain/analysis/` 就是这个聚合点。

### 1.2 应用层 — ✗ 缺失 → ✓ 已建立

| | V1 | V2 |
|----|----|-----|
| 用例编排位置 | 散落在 Vue 生命周期 + extractor | `src/application/` 5 文件 / 4 个 service 函数 |
| I/O 依赖方式 | `window.lcuApi.fetchXxx()` 直接调用 | 通过 `LcuApiPort` 接口注入 |
| 数据源耦合 | 组件知道 LCU API 参数格式 | 组件只知道 service 函数签名 |

| Service | 对应用例 |
|---------|---------|
| `analyzeSelectedGames(api, gameIds)` | 选中对局 → 分析结果 |
| `loadFriendAnalysis(api)` | 加载好友分析数据 |
| `loadGameDetail(api, gameId)` | 加载单局详情 |
| `refreshPlayerGames(api, ...)` | 刷新玩家对局列表 |

**V1 核心问题**："表示层直接知道数据来自 LCU API" — **已解决。** Vue 组件通过应用层 service 获取数据，组件不调 `fetchGameDetails` / `fetchMatchList` 等 I/O 方法。

### 1.3 领域数据和行为分离 — ✓ 已解决

V1 诊断的"贫血领域模型"：`GameSummary` 是纯数据，`computeWinRate()` 是游离函数，调用方手动编排。

V2：领域函数按分析主题组织在独立模块中，每个函数有明确的输入/输出契约。调用方（应用层）只需调用函数并传递数据，不关心内部计算细节。

### 1.4 变更放大系数 — 显著改善

| 变更类型 | V1 涉及文件 | V2 涉及文件 | 改善 |
|---------|-----------|-----------|------|
| 新增基础分析指标 | 4 | **2**（领域函数 + mode-analysis-config） | 不需要改 Vue |
| 新增高阶指标 | 4 | **1**（advanced-metrics.ts 加一个 case） | -3 文件 |
| 新增好友指标 | 3 | **1**（friends.ts FRIEND_METRICS 数组加一项） | -2 文件 |
| 替换图标 URL 方案 | 7 文件各改一遍 | **1**（lcu-images.ts 改一处） | 已统一 |

### 1.5 其他已解决项

| V1 问题 | V2 状态 |
|---------|---------|
| `shared/utils/analysis.ts` 死代码（6 个函数零引用） | **已删除** |
| `PlayerFreq` 接口重复定义 | **已统一**（仅 `domain/analysis/match-stats.ts`） |
| `computeFrequentChampions` 函数重复 | **已统一**（仅 domain 层） |
| 图标 URL 在 7 个组件中内联重复 | **已统一**（`lcu-images.ts` 为唯一来源） |
| AnalysisView 30+ computed 属性 | **降至 13**（-57%） |
| AnalysisView 文件大小 2372 行 | **降至 1832 行**（-540 行，-23%） |
| `profileIconUrl()` 在两个组件重复 | **已统一**为 `profileIcon()` import |

---

## 2. 当前架构全貌

```
┌──────────────────────────────────────────────────────┐
│  表示层 (Vue 3)                    src/renderer/src/  │
│  - 模板渲染、事件绑定、UI 状态（ref/loading/error）    │
│  - 通过应用层 service 获取数据                         │
│  - 不直接调用领域函数、不直接调 window.lcuApi 数据方法  │
├──────────────────────────────────────────────────────┤
│  应用层 (application)     【V2 新增】 src/application/ │
│  - 4 个 service 函数，对应 4 个用例                    │
│  - 通过 LcuApiPort 接口接收 I/O 能力（依赖注入）       │
│  - 调用领域函数 → 装配结果 → 返回                      │
├──────────────────────────────────────────────────────┤
│  领域层 (domain/analysis)  【V2 新增】 src/domain/     │
│  - 40 个纯函数 / 11 个类型，零框架依赖                 │
│  - 参数进 → 结果出，可直接单元测试                     │
├──────────────────────────────────────────────────────┤
│  基础设施层 (main/lcu)              src/main/lcu/     │
│  - LCU 连接发现、HTTP 客户端、数据提取                 │
│  - 自定义 lcu-asset:// 协议代理                       │
├──────────────────────────────────────────────────────┤
│  共享层 (shared)                    src/shared/       │
│  - 类型定义（DTO）、中文本地化映射                      │
│  - IPC 桥接（preload）                                │
└──────────────────────────────────────────────────────┘
```

### 依赖方向

```
表示层 ──→ 应用层 (service) ──→ 领域层 (纯函数)
    │           │
    │           └──→ 基础设施层 (window.lcuApi，通过端口注入)
    │
    └──→ shared/types (类型依赖，只读)
```

- 无循环依赖 ✓
- 高层不依赖低层实现细节 ✓
- 领域层零外部依赖 ✓

---

## 3. 尚未解决的问题

### 3.1 优先级 P1（建议下一轮处理）

#### 3.1.1 Repository 抽象层缺失

**V1 原始问题**："如果接入 SGP API 或增加缓存层，所有调用 `window.lcuApi` 的组件都要改"

**V2 当前状态**：应用层通过 `LcuApiPort` 接口接收 I/O，已经改善了直接耦合。但：

- `LcuApiPort` 接口**等同于** `window.lcuApi` 的方法签名（fetchGameDetails、fetchMatchList 等）
- 接口暴露的是 LCU 语义，不是业务语义
- 替换数据源仍需改 service 内部（虽然改动集缩在应用层内）

**理想状态**：
```typescript
// 当前 (V2)
interface LcuApiPort {
  fetchGameDetails(gameIds: number[]): Promise<GameRecord[]>  // LCU 语义
}

// 目标
interface MatchRepository {
  findByIds(ids: number[]): Promise<GameRecord[]>     // 业务语义
  findByPuuid(puuid: string, page: number): Promise<...>
}
```

这样替换数据源（LCU → SGP → 本地缓存）时，service 函数完全不变，只换 Repository 实现。

**影响范围**：`ports.ts` 重命名 + `LcuApiPort` → `MatchRepository`

#### 3.1.2 好友分析的计算逻辑仍在 shared/utils

`src/shared/utils/friend-analysis.ts` 中的 `analyzeFriends()` 和 `computeFriendSummary()` 是纯计算函数，但位置在 shared 层而非领域层。领域层 `friends.ts` 反而 import 了它的类型。

**应迁移到**：`src/domain/analysis/friend-analysis.ts`（或并入现有 `friends.ts`）

#### 3.1.3 MatchList.vue 未迁移

`MatchList.vue` 仍直接调用 `window.lcuApi.checkConnection()` 和 `window.lcuApi.getCurrentSummoner()`。

**应提取到**：`src/application/` 新增 `connection-service.ts`

### 3.2 优先级 P2（结构优化）

#### 3.2.1 3 个显示格式化函数仍在组件内

| 函数 | 位置 | 本质 |
|------|------|------|
| `daysAgo(ts)` | FriendAnalysis.vue | 时间→相对文字 |
| `rateDisplay(rate)` | FriendAnalysis.vue | 小数→百分比字符串 |
| `formatBestValue(key, v)` | GameDetail.vue | stat key→格式化值 |

这些不是领域逻辑（不分析数据），是显示格式化。应迁移到 `@/utils/format`。

#### 3.2.2 AnalysisView 文件仍大（1832 行）

虽然比 V1 的 2372 行减少了 23%，但一个文件承担多个职责：
- 数据加载编排（`loadAnalysis`、`onActivated`）
- 指标选择 UI 逻辑
- 多个排名表渲染
- 领奖台渲染
- 热门英雄/装备/增幅展示
- AI 对话面板

**建议**：拆分为子组件（MetricSidebar、PodiumDisplay、HotPicksPanel、ChatSection），主视图只做布局编排。

#### 3.2.3 模板中仍有 3 个薄包装函数

`getChampionUsers`、`getItemUsers`、`getAugmentUsers` 在 AnalysisView.vue 中作为模板兼容层。它们只是 `analysisGames.value` 空检查 + 调领域函数。

**建议**：可考虑改为 computed 内联，消除包装层。

### 3.3 优先级 P3（长期演进）

#### 3.3.1 持久化存储

突破 LCU 200 场上限，需 SQLite + SGP 双数据源。这需要：
1. Repository 抽象（见 P1-1）
2. 本地数据库层
3. 数据同步策略（LCU 最新 + SGP 全量 + 本地缓存）

#### 3.3.2 主进程 extractor 仍有领域逻辑

`extractor.ts` (~938 行) 中的 `CUSTOM_GAME` 注入、数据组装逻辑尚未提取到领域层。

---

## 4. 对比总结

| 维度 | V1 | V2 | 改善幅度 |
|------|----|----|---------|
| 架构层数 | 2 层（展示 + 基础设施） | **4 层**（展示 + 应用 + 领域 + 基础设施） | +100% |
| 领域层导出数 | 0（散落各处） | **40** | 从零建立 |
| 应用层导出数 | 0（嵌在 Vue 生命周期） | **4 个 service** | 从零建立 |
| 纯计算可测试性 | ✗ 不可测试 | ✓ 全部可独立测试 | 根本性改善 |
| 数据源耦合 | 组件直接调 window.lcuApi | 通过应用层 + 端口注入 | 解耦一级 |
| Vue → domain 耦合 | 内联 computed 包含领域算法 | 零领域算法在 Vue 中 | 完全消除 |
| 图标 URL 重复 | 7 文件各行其是 | 1 个源文件 | 完全消除 |
| 死代码 | 190 行 analysis.ts + 其他 | 已清理 | 完全消除 |
| AnalysisView 规模 | 2372 行 / 30+ computed | 1832 行 / 13 computed | -23% / -57% |
| 新增指标变更集 | 4 文件 | 1-2 文件 | -50~75% |
| Repository 抽象 | ✗ 无 | ⚠️ 有端口但语义偏 LCU | 部分改善 |
| 好友分析归属 | ✗ shared/utils | ⚠️ 类型在 shared，行为在 domain | 部分改善 |

---

## 5. 建议的下一步

| 序号 | 动作 | 收益 | 预计工作量 |
|------|------|------|-----------|
| 1 | LcuApiPort → MatchRepository 重命名 + 语义升级 | 数据源可替换 | 小 |
| 2 | friend-analysis.ts 纯计算迁移到 domain | 领域层完整性 | 小 |
| 3 | MatchList 连接逻辑提取到 connection-service | 应用层覆盖完整 | 小 |
| 4 | 3 个格式化函数迁移到 @/utils/format | 消除残留 | 极小 |
| 5 | 拆分 AnalysisView.vue 为子组件 | 可维护性 | 中 |
| 6 | Repository 实现层（LCU / 缓存 / SGP） | 突破 200 场上限 | 大 |
