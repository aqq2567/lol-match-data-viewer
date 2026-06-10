# 渲染进程 (`src/renderer/src/`)

基于 Vue 3 Composition API 的 UI 层。Hash 路由 + Pinia 状态管理 + Naive UI 组件库。

## 目录

```
src/
├── main.ts                        # 入口：createApp, Pinia, Router, NaiveUIProviderApp
├── App.vue                        # 根组件：标题栏 + <RouterView>
├── NaiveUIProviderApp.vue         # Naive UI 全局配置包装器
├── env.d.ts                       # 类型声明（window.lcuApi, .vue 模块）
├── assets/css/
│   ├── styles.less                # 全局 CSS 变量（暗/亮主题各 ~50 个 token）
│   └── transition.less            # 动画（淡入淡出、领奖台弹性动画）
├── views/
│   ├── Panel.vue                  # 布局壳：侧边栏 + <RouterView>
│   ├── MatchList.vue              # 对局列表：标签栏 + 每个标签的 PlayerGamesList
│   ├── PlayerGamesList.vue        # 单玩家对局列表：分页、模式筛选、框选、跳转分析
│   ├── GameDetail.vue             # 单场详情：两队、最佳数据、英雄熟练度
│   ├── AnalysisView.vue           # 多场分析：指标侧边栏、排名表、AI 对话（~2380 行）
│   └── FriendAnalysis.vue         # 好友分析：共玩频率、胜率差
├── components/
│   ├── chat/ChatPanel.vue         # AI 对话（微信气泡风格）
│   ├── match-history/
│   │   ├── MatchHistoryCard.vue   # 单场对局卡片
│   │   └── MatchStatsPanel.vue    # 对局统计侧边栏
│   ├── metrics/                   # (计划新建) 可复用指标组件
│   ├── common/                    # (计划新建) 通用状态组件
│   ├── settings/SettingsDialog.vue
│   ├── sidebar/{Sidebar,SidebarMenu,SidebarFixed,TabBar}.vue
│   ├── title-bar/MainWindowTitleBar.vue
│   ├── widgets/{LcuImage,ChampionIcon,ItemDisplay,...}.vue
│   └── PlayerCard.vue             # 详情页玩家卡片
├── stores/
│   ├── game-data.ts               # 静态游戏数据缓存（英雄/装备/技能/符文/队列/增幅）
│   ├── tab.ts                     # 多玩家标签页管理
│   └── theme.ts                   # 暗/亮主题切换（localStorage 持久化）
├── routes/index.ts                # Hash 路由配置
└── utils/
    ├── format.ts                  # 时间/数字格式化
    ├── lcu-images.ts              # lcu-asset:// URL 构建器
    └── display.ts                 # (计划新建) 显示工具
```

## 数据流

```
window.lcuApi.fetchPlayerMatchList()     ← 渲染进程调用
    ↓ (IPC)
主进程 extractor.fetchMatchListForPlayer()
    ↓
返回 MatchListData → 存入组件 ref (listData)
    ↓
computed 派生: currentPageGames, filteredGames, modeOptions...
    ↓
模板渲染 MatchHistoryCard × N

用户选中对局 → bridge.request(gameIds) → Pinia store
    ↓
router.push('analysis') → AnalysisView.onActivated()
    ↓
window.lcuApi.fetchGameDetails(gameIds) → GameRecord[]
    ↓
computed 派生: per-player aggregates, rankings → 模板渲染
```

## KeepAlive 策略

- `Panel.vue` 的子路由用 `<KeepAlive>` 包裹，切换页面时保留组件状态
- `MatchList.vue` 的 `PlayerGamesList` 实例用 `<KeepAlive :max="10">`
- `ChatPanel.vue` 的消息用**模块级 `ref`** 跨指标切换保留（不在组件内）

## 主题系统

CSS 变量分层在 `[data-theme='dark']` / `[data-theme='light']` 选择器下。

- 亮色主题基色：Pantone 11-4201 Cloud Dancer (`#F0EEE9`)
- 主题切换由 `useThemeStore` 管理，写 `localStorage` + 设置 `document.documentElement` 的 `data-theme` 属性
- 对话组件有独立的 `--chat-*` 变量（亮/暗各 15 个）

## 已知重复

- `shortName()` 在 3 个文件中有独立实现（PlayerCard、AnalysisView、FriendAnalysis）
- `gameModeLabel()` 在 MatchHistoryCard 和 PlayerGamesList 中重复
- 指标侧边栏 HTML 在 AnalysisView 和 FriendAnalysis 中结构相同（~400 行）
- 图标 URL 构建在 AnalysisView 和 FriendAnalysis 中内联，未使用 `lcu-images.ts`

## 待改进

- 无 composables 目录，逻辑全部内联在组件中
- 每个 view 有自己的空/加载/错误状态标记，可提取为通用组件
- `connStatus` / `connRegion` 通过 props 链传递 3 层（App → Panel → Sidebar）
