# 架构审查报告

> 审查范围：整体架构设计、模块边界、依赖方向、可扩展性与可维护性
> 审查层级：软件架构层面（非代码质量、非具体模块实现）

---

## 1. 当前架构概览

### 1.1 分层结构（现状）

```
┌─────────────────────────────────────────────────────┐
│  表示层 (Vue 3)                                     │
│  包含：视图、组件、Pinia stores、computed 中的分析逻辑 │
├─────────────────────────────────────────────────────┤
│  桥接层 (preload / IPC)                              │
│  16 个透传方法，无业务逻辑                            │
├─────────────────────────────────────────────────────┤
│  基础设施层 (main/lcu)                               │
│  包含：HTTP 客户端、连接发现、数据提取转换、缓存策略    │
│  部分领域逻辑散落于此（CUSTOM_GAME 注入、数据组装）    │
├─────────────────────────────────────────────────────┤
│  共享层 (shared)                                     │
│  包含：类型定义（DTO）、中文本地化映射、纯函数统计工具   │
└─────────────────────────────────────────────────────┘
```

### 1.2 依赖图

```
Vue 组件 ──────→ shared/types     ✓ 类型依赖
     │──→ shared/utils            ✓ 纯函数依赖
     │──→ window.lcuApi           ✗ 直接依赖数据源
     │──→ Pinia stores            ✓ 状态管理
     
shared/utils ──→ shared/types/app ✓ 类型依赖
     │──→ ./mappings              ✓ 同层工具

extractor.ts ──→ ./client         ✓ 同层依赖
     │──→ shared/types/app        ✓ 类型依赖
```

**依赖方向正确**——没有循环依赖，低层不依赖高层。**但依赖对象有问题**——表示层直接知道数据来自 LCU API。

---

## 2. 核心架构缺陷

### 2.1 缺少两层关键抽象：应用层和领域层

标准四层架构 vs 当前架构：

| 层 | 标准职责 | 当前状态 | 当前在哪 |
|----|---------|---------|---------|
| **表示层** | 渲染 UI，响应用户交互 | ✓ 存在 | Vue 组件 |
| **应用层** | 编排用例：取数据→计算→返回 | **✗ 缺失** | 散落在 Vue computed + extractor |
| **领域层** | 分析算法、统计规则、领域类型 | **✗ 缺失** | 散落在 shared/utils + Vue computed |
| **基础设施层** | 与外部系统通信 | ✓ 存在 | main/lcu |

缺失层的影响：

- 领域逻辑放在 Vue computed 中 → 不渲染组件就无法执行分析 → 无法做单元测试、无法导出 CLI、无法复用
- 应用编排放在 Vue 组件生命周期中 → 数据获取和 UI 状态耦合 → 替换数据源需要改组件

### 2.2 贫血领域模型 (Anemic Domain Model)

```
┌─────────────────────────────────────────────┐
│                 现状                         │
│                                             │
│  GameSummary (纯数据)     computeWinRate()   │
│  PlayerStats (纯数据)     computeAvgKda()    │
│  GameRecord (纯数据)      computeFrequent... │
│                                             │
│  数据和行为分离                               │
│  类型在 app.ts，操作在 analysis.ts           │
│  调用方在 Vue computed 中手动编排             │
└─────────────────────────────────────────────┘
```

问题：没有一个聚合点封装"什么是分析"这个概念。新增"MVP 评分"功能需要同时改动 `analysis.ts`、`mode-analysis-config.ts`、`AnalysisView.vue` 的 `<script>` 和 `<template>`——4 个文件，没有一处说"这是分析功能的核心"。

### 2.3 依赖反转缺失 (Missing Dependency Inversion)

当前：表示层 **直接依赖** 基础设施层

```
AnalysisView ──→ window.lcuApi.fetchMatchList()
                   └── 知道 begIndex/endIndex 参数
                   └── 知道 LCU 连接状态
                   └── 知道每页 200 场的上限
```

如果接入 SGP API 或增加缓存层，**所有调用 `window.lcuApi` 的组件都要改**。

应该有：

```
AnalysisView ──→ MatchService.getRecentMatches()
                    └── 不知道数据来自 LCU 还是 SGP 还是本地缓存
```

### 2.4 模块边界缺少"接缝"

好的架构允许在边界处切开替换。当前各项替换的可行性：

| 替换 | 可行性 | 受阻原因 |
|------|--------|---------|
| LCU → SGP 数据源 | ⚠️ 困难 | 组件直接调用 `window.lcuApi.fetchXxx()`，无抽象层 |
| 内存 → SQLite 持久化 | ✗ 极难 | 无 Repository 抽象，数据与组件生命周期绑定 |
| Vue → 其他 UI 框架 | ⚠️ 困难 | 分析逻辑嵌在 Vue computed 中 |
| Mock LCU 做测试 | ⚠️ 可行 | IPC 可 mock，但无法模拟完整分析流程 |
| 独立测试分析逻辑 | ✗ 不行 | 需要 mount Vue 组件才能触发计算 |

唯一真正的"接缝"是 `shared/utils/*.ts` 中的纯函数——可独立测试和复用。但这恰好是整个系统中最薄的一层。

### 2.5 变更放大系数

| 变更类型 | 涉及文件数 | 跨层 |
|---------|-----------|------|
| 新增分析指标 | 4 | `mode-analysis-config.ts` → `AnalysisView.vue`(script) → 同文件(template) → 可能的模板调整 |
| 新增 IPC 数据操作 | 4 | `extractor.ts` → `lcu-handlers.ts` → `preload/index.ts` → `env.d.ts` |
| 新增游戏模式 | 5+ | `mode-analysis-config.ts` → `mappings.ts` → `AnalysisView.vue` → `FriendAnalysis.vue` → 条件分支修正 |
| 新增 CDN 数据类型 | 3 | `lcu-api.ts` → `app.ts` → `game-data.ts` store |

### 2.6 表示层成为事实上的数据编排层

`AnalysisView.vue` 包含 30+ computed 属性，每增加一个分析维度，就在同一个 2372 行文件中追加 `<script>` 逻辑和 `<template>` 标记。这导致：

- 分析能力与 UI 生命周期耦合（不 mount 组件就无法执行分析）
- 无法单独测试分析结果
- 无法在非 UI 上下文中复用分析逻辑

---

## 3. 架构好的一面

以下设计决策是正确的，应保留：

| 方面 | 说明 |
|------|------|
| **依赖方向** | 无循环依赖，shared 层不被任何具体实现污染 |
| **shared/utils 纯函数** | 分析算法无副作用、可独立调用 |
| **类型分层** | `lcu-api.ts`（原始）和 `app.ts`（应用层）的分离是好的意图 |
| **lcu-asset:// 协议** | 自定义协议代理图片是恰当的职责分离 |
| **Pinia 状态管理** | store 职责清晰（game-data / theme / tab），未滥用 |
| **Hash 路由** | 对 Electron 是正确的选择 |
| **构建工具链** | electron-vite + vue-tsc 覆盖了开发体验关键路径 |

---

## 4. 目标架构演进方向

### 4.1 目标分层

```
┌──────────────────────────────────────────────────┐
│  表示层 (src/renderer/src/views, components)      │
│  只做渲染和用户交互，不包含分析逻辑                │
├──────────────────────────────────────────────────┤
│  应用层 (src/app/)          【新增】              │
│  Use Case 编排：取数据 → 调领域服务 → 返回 ViewModel │
│  例：AnalysisService.getChampionStats(matchIds)   │
├──────────────────────────────────────────────────┤
│  领域层 (src/domain/)       【新增】              │
│  分析算法、统计规则、领域实体                      │
│  例：MatchAnalysis.championFrequency()            │
├──────────────────────────────────────────────────┤
│  基础设施层 (src/main/lcu, src/infra/)            │
│  数据源适配、HTTP 客户端、文件 I/O                │
│  例：LcuMatchRepository.fetchByPuuid()            │
└──────────────────────────────────────────────────┘
```

### 4.2 优先级

| 序号 | 动作 | 收益 | 成本 |
|------|------|------|------|
| 1 | 从 Vue computed 提取分析逻辑到独立的 TypeScript 服务类 | 可测试、可复用 | 中 |
| 2 | 引入 Repository 抽象层隔离数据源（LCU / SGP / 缓存） | 可替换数据源 | 中 |
| 3 | 拆分 AnalysisView.vue（2372 行 → 编排层 + 子组件） | 可维护 | 中 |
| 4 | 引入持久化存储（SQLite），领域层对接 Repository | 突破 200 场上限 | 大 |

### 4.3 不变的原则

- shared/types 作为唯一的类型契约层，位置不变
- shared/utils 纯函数保持无副作用，位置不变
- IPC 桥接层继续负责主进程→渲染进程通信，但应用层不应感知其存在

---

## 5. 结论

当前架构是一个 **设计良好的两层数据管道**——LCU JSON 经 extractor 转换，通过 IPC 推送至 Vue，在组件内完成最终计算和展示。对于 v0.x 原型阶段，这种结构是合理的、可工作的。

但从软件架构角度看，**应用层和领域层的缺失**是根本性问题。当所有分析逻辑寄生在 Vue 组件的 computed 中时，每增加一个功能点，复杂度线性累积在同一批文件里。没有接缝可以切开替换、没有独立的应用层可以测试、没有领域模型可以承载业务规则的演进。

要进入可持续迭代阶段，核心是两件事：

1. **从 Vue computed 中提取出一个独立的应用服务层**（纯 TypeScript，不依赖 Vue/Electron）
2. **在 extractor 和应用层之间加一层 Repository 抽象**，隔离数据来源

这两个改动完成后，增量功能变成"在领域层加一个方法，在组件里调一行"，而非在 2372 行文件中翻找正确的位置。
