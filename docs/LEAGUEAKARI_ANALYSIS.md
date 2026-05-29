# LeagueAkari 战绩获取机制分析

## 核心发现

LeagueAkari 使用了 **双数据源架构**，这才是它能突破 LCU 缓存限制的关键：

| | LCU API（本地） | SGP API（远程 Riot 服务） |
|---|---|---|
| **端点** | `127.0.0.1:{port}` | Riot 远程服务器 |
| **路径** | `/lol-match-history/v1/products/lol/{puuid}/matches` | `/match-history-query/v1/products/lol/player/{puuid}/SUMMARY` |
| **参数** | `begIndex`, `endIndex` | `startIndex`, `count`, `tag` |
| **上限** | 200 场（服务端硬限制） | 单次 200 场，但支持分页遍历全部 |
| **数据质量** | 摘要（需二次请求详情） | 完整对局数据（一次请求即可） |
| **跨区查询** | 仅当前登录大区 | 支持所有已配置的 SGP 服务器 |
| **队列过滤** | 不支持 | 支持 `tag` 参数按队列筛选 |
| **认证** | LCU 本地 Basic Auth | `entitlementsToken` JWT（Bearer） |

## 1. LCU API 路径

文件：`src/shared/http-api-axios-helper/league-client/match-history.ts`

```typescript
getMatchHistory(puuid: string, begIndex: number = 0, endIndex: number = 19) {
  return this._http.get<MatchHistory>(
    `/lol-match-history/v1/products/lol/${puuid}/matches`,
    { params: { begIndex, endIndex } }
  )
}
```

- 单次请求上限 ~200 场（我们的实验已证实：endIndex=99→100, endIndex=499→200, endIndex=1999→200）
- 仅返回摘要，需要额外调用 `GET /lol-match-history/v1/games/{gameId}` 获取详情
- LeagueAkari 在 LCU 路径下的 pageSize 选项最大也是 200

## 2. SGP API 路径（关键）

文件：`src/shared/data-sources/sgp/index.ts`

```typescript
async getMatchHistory(
  sgpServerId: string,
  playerPuuid: string,
  start: number,
  count: number,
  tag?: string
) {
  return this._http.get<SgpMatchHistoryLol>(
    `/match-history-query/v1/products/lol/player/${playerPuuid}/SUMMARY`,
    {
      baseURL: sgpServer.matchHistory,  // 远程 Riot 服务器地址
      headers: { Authorization: `Bearer ${this._entitlementToken}` },
      params: { startIndex: start, count, tag }
    }
  )
}
```

- **直接连接 Riot 后端服务**，不经过 LCU 代理
- 认证使用 `entitlementsToken`（JWT），从 LCU 的 `/entitlements/v1/token` 获取
- `startIndex` + `count` 分页，每页最大 200，但可以不断翻页遍历全部历史
- `tag` 参数支持队列过滤（如 `q_420` = 排位单双）
- 返回已包含完整对局数据，无需二次请求

### SGP 单场详情

```typescript
// 单场摘要
GET /match-history-query/v1/products/lol/{rsoPlatformId}_{gameId}/SUMMARY

// 单场时间线
GET /match-history-query/v1/products/lol/{rsoPlatformId}_{gameId}/DETAILS
```

## 3. 认证令牌获取

### entitlementsToken（SGP API 使用）

```
GET /entitlements/v1/token  →  { accessToken: "eyJ...", token: "eyJ..." }
```

- 通过 LCU WebSocket 事件 `/entitlements/v1/token` 持续同步
- LeagueAkari 在 `src/main/shards/sgp/index.ts:384-405` 用 MobX reaction 维护
- `accessToken` 字段作为 SGP API 的 Bearer token

### leagueSessionToken（排行榜/召唤师查询使用）

```
GET /lol-league-session/v1/league-session-token  →  纯文本 JWT
```

## 4. SGP 服务器配置

文件：`src/shared/data-sources/sgp/index.ts` 中 `SgpServersConfig` 接口

```typescript
interface SgpServersConfig {
  version: number
  lastUpdate: number
  servers: {
    [region: string]: {
      matchHistory: string | null   // 战绩查询服务器
      common: string | null         // 通用查询服务器
    }
  }
  // 腾讯系跨区互操作组
  tencentServerMatchHistoryInteroperability: string[]
  tencentServerSpectatorInteroperability: string[]
  tencentServerSummonerInteroperability: string[]
}
```

服务器 ID 构建（`src/shared/data-sources/sgp/utils.ts`）：

```typescript
function getSgpServerId(region: string, rsoPlatformId?: string) {
  if (region === 'TENCENT') {
    return `TENCENT_${rsoPlatformId}`
  }
  return region
}
```

配置文件存储在 `<userData>/league-servers.json`，LeagueAkari 内置了一份默认配置，并可从远端更新。

## 5. 主窗口战绩查询逻辑

文件：`src/renderer/src-main-window/views/match-history/MatchHistoryTab.vue:1061-1171`

```
loadMatchHistory(page, pageSize, tag):
  1. 优先使用 SGP API（如果 settings.matchHistoryUseSgpApi && 服务器支持）
     → sgp.getMatchHistoryLcuFormat(puuid, (page-1)*pageSize, pageSize, tag)
  2. 否则使用 LCU API（仅限当前登录大区）
     → lc.api.matchHistory.getMatchHistory(puuid, (page-1)*pageSize, page*pageSize-1)
     → 然后逐场 getGame(gameId) 补载详情
```

分页大小选项：10 / 20 / 30 / 40 / 50 / 100 / 200，最大值 200。

**LeagueAkari 没有通过 LCU API 单次获取超过 200 场的机制**。它的 200 上限和我们实验结论完全一致。用户看到的 "500 场" 很可能就是 SGP API 跨页累积的结果，或者是多赛季数据。

## 6. 数据映射：SGP → LCU 格式

文件：`src/main/shards/sgp/data-mapper.ts`

`mapSgpGameSummaryToLcu0Format()` 将 SGP 的 `SgpGameSummaryLol` 转换为 LCU 的 `Game` 格式（含 participants、participantIdentities、teams），使得前端可以统一处理两种数据源。

## 7. 本地持久化

LeagueAkari 使用 SQLite（TypeORM）存储：

| 实体 | 用途 |
|------|------|
| `EncounteredGame` | 记录在游戏结束阶段遇到的玩家（gameId, puuid, queueType） |
| `SavedPlayer` | 保存标记过的玩家（puuid, tag, lastMetAt） |
| `Settings` | 应用设置 |
| `Metadata` | 元数据 |

注意：`EncounteredGame` 仅记录"遇到过谁"，**不是战绩数据库**。LeagueAkari 不持久化对局详情，每次都重新从 API 拉取。

## 8. 对我们项目的启示

### 立即可做：SGP API 集成

1. 从 LCU 获取 `entitlementsToken`：`GET /entitlements/v1/token`
2. 构建 SGP server ID：`TENCENT_{rsoPlatformId}`
3. 配置 SGP 服务器地址（需要找到国服的 match-history 服务器 URL）
4. 发送认证请求：
   ```
   GET {sgpServer}/match-history-query/v1/products/lol/player/{puuid}/SUMMARY
     ?startIndex=0&count=200
   Authorization: Bearer {entitlementsToken}
   ```
5. 循环分页：`startIndex=200, 400, 600...` 直到返回空

### 挑战

- 需要知道国服 TENCENT 的 SGP match-history 服务器地址（LeagueAkari 的 `league-servers.json` 中应该有）
- 该服务器可能需要特定的网络环境（可能国内直连、可能需代理）

### 建议

先尝试用 LCU 获取 entitlementsToken，然后找到 SGP 服务器地址，验证能否连通。如果 SGP API 可用，200 场上限就彻底不存在了。
