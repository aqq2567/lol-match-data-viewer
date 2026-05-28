<div align="center">
  <h1>LOL Match Data Viewer</h1>
  <p>基于 Electron + Vue 3 的英雄联盟 LCU API 对战数据分析桌面客户端</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-34-47848f?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5-4fc08d?style=flat-square&logo=vue.js" alt="Vue">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

<p align="center">通过 LCU API 拉取对战记录，无需第三方 API Key。</p>

# 1. 功能

## 1.1 战绩列表

分页拉取 LCU 对战记录，展示 KDA、装备、符文、召唤师技能、段位、游戏模式。左侧面板提供胜率、常用英雄、KDA 趋势和队友/对手统计。

## 1.2 数据分析

从勾选的多场对局中按指标聚合排名，各指标展示前三名和完整排名表。

**基础数据（34 项）：**

| 类别 | 指标 |
|------|------|
| 战斗 | 击杀、死亡、助攻、KDA、最大连杀、连杀次数、最大多杀 |
| 伤害 | 总伤害、承伤、最大暴击 |
| 经济 | 打钱、花钱、补刀、野怪击杀 |
| 生存 | 治疗、自我减伤、最长存活 |
| 视野 | 视野得分、插眼、排眼 |
| 控制 | 控制敌人时间、受控时间 |
| 目标 | 推塔、对塔伤害、破水晶 |
| 首杀/首塔 | 一血、一塔 |
| 多杀 | 双杀、三杀、四杀、五杀 |
| 评分 | 战斗评分 |
| 装备 | 各场对局出装汇总，按出现频次排名 |
| 海克斯 | 斗魂竞技场/海克斯大乱斗增幅统计 |

**高阶数据：**

| 指标 | 计算方式 |
|------|----------|
| 伤害/经济 | 总伤害 / 总经济 |

### 1.3 对局详情

展示两队阵容、装备、符文、召唤师技能，以及击杀参与率、伤害占比、承伤占比、经济占比。

# 2. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 34 + electron-vite |
| 前端 | Vue 3 (Composition API) + Pinia + Vue Router |
| UI | Naive UI |
| 样式 | Less |
| HTTP | Axios（HTTPS 自签名证书） |
| 构建 | Vite + TypeScript |

# 3. 项目结构

```
src/
├── main/                          # 主进程
│   ├── index.ts                   # 入口 + 生命周期
│   ├── lcu/
│   │   ├── client.ts              # LCU 连接发现 + HTTP 封装
│   │   └── extractor.ts           # 原始数据转换
│   ├── ipc/
│   │   └── lcu-handlers.ts        # IPC handler
│   └── utils/
│       ├── logger.ts              # 文件日志（按日轮转）
│       └── asset-proxy.ts         # lcu-asset:// 协议代理
│
├── preload/
│   └── index.ts                   # contextBridge
│
├── shared/                        # 主/渲染进程共享
│   ├── types/
│   │   ├── lcu-api.ts             # LCU API 原始类型
│   │   └── app.ts                 # App 层类型
│   └── utils/
│       ├── analysis.ts            # 分析算法
│       └── mappings.ts            # 常量映射
│
└── renderer/                      # 渲染进程
    └── src/
        ├── views/                 # 页面
        │   ├── MatchList.vue
        │   ├── AnalysisView.vue
        │   ├── GameDetail.vue
        │   └── Panel.vue
        ├── components/            # 组件
        │   ├── match-history/
        │   ├── widgets/
        │   ├── sidebar/
        │   └── title-bar/
        ├── stores/                # Pinia
        ├── router/
        └── utils/
```

# 4. 数据来源

通过 LCU (League Client Update) 本地 API 获取，无需第三方 Key：

| 端点 | 用途 |
|------|------|
| `/lol-match-history/v1/products/lol/{puuid}/matches` | 对战列表 |
| `/lol-match-history/v1/games/{gameId}` | 对局详情 |
| `/lol-summoner/v1/current-summoner` | 当前召唤师 |
| `/lol-ranked/v1/current-ranked-stats` | 段位信息 |
| `/lol-game-data/assets/v1/*` | 静态数据（英雄/装备/技能/符文/海克斯） |
| `/lol-collections/v1/inventories/{id}/champion-mastery` | 英雄熟练度 |

字段清单见 [`LCU_DATA_FIELDS.json`](./electron-app/LCU_DATA_FIELDS.json)。

# 5. 构建与运行

**环境要求：**

- Node.js 20+
- Windows（LCU API 仅 Windows 可用）
- League of Legends 客户端正在运行
- Python 3 + Pillow（仅打包时）

**安装与运行：**

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建
npm run package  # 打包
```

**使用步骤：**

1. 登录 League of Legends 客户端
2. 启动本应用，自动检测 LCU 连接并拉取战绩
3. 勾选要分析的对局，进入数据分析页

# 6. 说明

- LCU API 使用自签名证书，已在 `LcuHttpClient` 中处理
- 海克斯数据仅在斗魂竞技场 (CHERRY)、海克斯大乱斗 (KIWI) 模式可用
- 首次运行若提示 PowerShell 权限，以管理员身份运行

# 7. 参考与致谢

本项目在架构和实现上参考了以下项目：

| 项目 | 说明 |
|------|------|
| [LeagueAkari](https://github.com/LeagueAkari/LeagueAkari) | LCU API 客户端工具集，模块分层架构（main/shared/renderer）、LCU 连接发现和 IPC 通信模式主要参考对象 |
| [Pengu Loader](https://github.com/PenguLoader/PenguLoader) | League of Legends 客户端插件加载器 |
| [lcu-and-riotclient-api](https://github.com/KebsCS/lcu-and-riotclient-api) | LCU 与 Riot Client API 文档 |
| [Seraphine](https://github.com/Zzaphkiel/Seraphine) | LCU API 工具集 |

感谢 [@HUPRO3](https://github.com/HUPRO3) 和 LeagueAkari 项目的贡献。

# 8. 免责声明

本软件基于 Riot Games 的 LCU API 开发，未使用侵入性技术，不直接干预或修改游戏数据。游戏更新或反作弊系统可能导致兼容性变化。

开发者不承担因使用本软件导致的账号封禁、数据丢失等任何后果。使用前请充分了解相关风险。

本应用未获得 Riot Games 的官方支持或认可。League of Legends 相关商标和版权归 Riot Games, Inc. 所有。使用本软件可能违反游戏用户协议。
