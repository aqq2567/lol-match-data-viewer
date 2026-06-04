# 共享工具 (`src/shared/utils/`)

纯函数模块，不依赖 DOM / Electron / Vue。主进程和渲染进程均可使用。

## 文件

| 文件 | 职责 | 被引用方 |
|------|------|----------|
| `mappings.ts` | 中文本地化查询表 + 辅助函数（~320 行） | MatchHistoryCard、GameDetail、AnalysisView 等 |
| `analysis.ts` | 统计算法（胜率、KDA、英雄/队友频率、队伍统计） | AnalysisView |
| `friend-analysis.ts` | 好友分析（共玩频率、胜率差、特定装备率） | FriendAnalysis |
| `format-for-ai.ts` | 对局数据 → AI 可读 Markdown 文本 | ChatPanel |
| `mode-analysis-config.ts` | 各游戏模式专属指标定义 | AnalysisView、format-for-ai.ts |

---

## `mappings.ts`

### 数据表

| 导出 | 类型 | 条目数 |
|------|------|--------|
| `GAME_MODE_MAP` | `Record<string, string>` | 55+ |
| `MAP_ID_MAP` | `Record<number, string>` | 18 |
| `TIER_MAP` | `Record<string, string>` | 10 |
| `QUEUE_NAME_OVERRIDES` | `Record<number, string>` | 150+ |
| `ROLE_TAG_MAP` | `Record<string, string>` | 6 |
| `EXCLUDED_ITEM_IDS` | `ReadonlySet<number>` | 4 |

### 函数

| 函数 | 说明 |
|------|------|
| `getGameModeName(mode)` | 模式枚举 → 中文名（含别名解析） |
| `getQueueName(queueId, lcuQueues?)` | 队列 ID → 中文名（覆盖 > LCU > 兜底） |
| `getMapName(mapId)` | 地图 ID → 中文名 |
| `getTierName(tier)` | 段位 → 中文名 |
| `getRoleName(tag)` | 角色标签 → 中文名 |
| `isBuildItem(itemId)` | 排除眼石/饰品 |
| `getPlayerDisplayName(p)` | 玩家信息 → 显示名 |
| `formatTierDivision(tier, division)` | "DIAMOND II" → "钻石Ⅱ" |

---

## `analysis.ts`

纯统计计算，所有函数接收数据 → 返回结果，无副作用。

| 函数 | 说明 |
|------|------|
| `computeWinRate(games)` | 胜率（排除训练模式） |
| `computeAvgKda(games)` | 平均 KDA |
| `computeFrequentChampions(games, topN)` | 最常用英雄 |
| `computeFrequentPlayers(games, selfPuuid, role, ...)` | 最常遇到的队友/对手 |
| `computeTeamStats(participants, selfTeamId, selfStats)` | 队伍内占比（击杀参与率、伤害占比等） |

---

## `mode-analysis-config.ts`

每种游戏模式有独立的指标：

```typescript
interface ModeAnalysisConfig {
  displayName: string
  basicMetrics: MetricDef[]    // KDA, 伤害, 金币, CS...
  advancedMetrics: MetricDef[] // 控制得分, 伤害占比, 英雄池...
}

function getModeAnalysisConfig(mode: string): ModeAnalysisConfig
```

已知模式：`CLASSIC`, `ARAM`, `CHERRY`, `KIWI`。未注册模式回退到 CLASSIC 配置。

---

## 已知问题

- 3 个不同的玩家显示名函数分散在 `app.ts`、`mappings.ts`、`friend-analysis.ts`
- `friend-analysis.ts` 中硬编码了装备 ID 6676（收集者）和 3084（心之钢）
- `mode-analysis-config.ts` 中部分 `advancedMetrics` 的 getter 永远返回 0（由 UI 层计算）
