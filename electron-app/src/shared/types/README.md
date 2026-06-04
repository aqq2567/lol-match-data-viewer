# 共享类型 (`src/shared/types/`)

主进程和渲染进程之间的类型契约。通过 barrel 文件 `index.ts` 统一导出。

## 文件

| 文件 | 职责 |
|------|------|
| `lcu-api.ts` | LCU API 原始响应 JSON 的类型镜像（~300 行） |
| `app.ts` | 应用层转换后类型（~400 行） |
| `index.ts` | Barrel：`export type *` 从两个文件重新导出 |

---

## 类型分层

```
LCU 原始 JSON           extractor.ts           应用层类型
─────────────           ────────────           ──────────
MatchHistory            buildMatchListData     MatchListData
Games                   buildGameSummary       GameSummary
Game                    extractStatsFull       PlayerStats
Participant             extractTeamData        TeamData
Stats                   extractRankedData      RankedData
LcuChampionSummary                               → ChampionSimple
LcuItem                                          → ItemData
...（7 对 CDN 类型）                              ...
```

## CDN 类型重复

`lcu-api.ts` 和 `app.ts` 中有 **7 对结构完全相同的 CDN 数据类型**：

| lcu-api.ts | app.ts | 差异 |
|------------|--------|------|
| `LcuChampionSummary` | `ChampionSimple` | 无 |
| `LcuItem` | `ItemData` | 无 |
| `LcuSummonerSpell` | `SummonerSpellData` | 无 |
| `LcuPerk` | `PerkData` | 无 |
| `LcuPerkStyle` | `PerkStyleData` | 无 |
| `LcuPerkstyles` | `PerkstylesData` | **styles: Array vs Record** |
| `LcuQueue` | `QueueData` | 无 |

仅 `PerkstylesData` 形状不同（extractor 将数组转为 dict 以支持 O(1) 查找）。其余 6 对是逐行复制。

## 已知问题

- `LcuSummoner` 定义在 `app.ts` 而非 `lcu-api.ts`（命名约定不一致）
- `Team.firstDargon` 是 LCU API 原文拼写错误，`extractTeamData` 中映射为 `first_dragon`
- 新增数据维度需同时更新两处类型文件
