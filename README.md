<div align="center">
  <h1>LOL Match Data Viewer</h1>
  <p>基于 Electron + Vue 3 的英雄联盟 LCU / SGP API 对战数据分析桌面客户端</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-34-47848f?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5-4fc08d?style=flat-square&logo=vue.js" alt="Vue">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

<p align="center">通过 LCU / SGP 本地 API 拉取对战记录，无需第三方 API Key。<br>内置 SQLite 持久化、AI 分析助手、比赛数据看板一键发布。</p>

---

# 1. 功能

## 1.1 战绩列表

分页拉取对战记录（SGP 渠道最高 500 场），展示 KDA、装备、符文、召唤师技能、段位、游戏模式。左侧面板提供胜率、常用英雄、KDA 趋势和队友/对手统计。支持本地 SQLite 缓存，启动秒显数据。

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
| 技能释放频率 | 总技能施放次数（SGP 渠道专属） |
| 团队护盾 | 团队护盾贡献值（SGP 渠道专属） |
| 敌人消失信号 | 地图信号统计（SGP 渠道专属） |

## 1.3 对局详情

展示两队阵容、装备、符文、召唤师技能，以及击杀参与率、伤害占比、承伤占比、经济占比。斗魂竞技场模式支持子队排名展示。

## 1.4 AI 分析助手（Beta）

基于 DeepSeek chat API 的对局数据分析对话。选中对局后自动注入结构化数据（全部字段 + 高阶聚合指标），支持微信式气泡对话界面。用户可自定义 API Key。

## 1.5 比赛数据看板 🆕

**T1 红黑主题 · 2×3 横向柱状排行榜 · 一键发布到 GitHub Pages**

| 指标 | 说明 |
|------|------|
| 积分 | 胜场数（每赢一场积 1 分） |
| MVP | 占位预留（数据层待定） |
| 击杀 / 死亡 / KDA / 输出 | 玩家排名 + 头像 CDN |

通过设置页配置 GitHub Token → 一键发布 → 生成 `https://{user}.github.io/{repo}` 公开看板。支持管理员密码保护发布权限。

---

# 2. 数据来源

## 2.1 双通道架构

```
启动 → LCU 检测 → 获取 entitlements JWT
  ├─ 成功 → SGP 通道（主要，最高 500 场）
  │         单次请求返回列表 + 详情，减少网络往返
  └─ 失败 → LCU 通道（降级，最高 200 场）
            两阶段拉取：摘要列表 → 详情批量加载
```

## 2.2 SGP（国服专属）

国服内置 SGP 服务器地址（`tencent-servers.json`），自动匹配大区。支持 401 自动续期 Token、DNS 故障降级。

## 2.3 LCU（全服通用）

通过本地 `LeagueClientUx.exe` 命令行参数发现端口和认证 token，HTTPS 自签名证书。

| 端点 | 用途 |
|------|------|
| `/lol-match-history/v1/products/lol/{puuid}/matches` | 对战列表 |
| `/lol-match-history/v1/games/{gameId}` | 对局详情 |
| `/lol-summoner/v1/current-summoner` | 当前召唤师 |
| `/lol-ranked/v1/current-ranked-stats` | 段位信息 |
| `/lol-game-data/assets/v1/*` | 静态数据（英雄/装备/技能/符文/海克斯） |

---

# 3. 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 34 + electron-vite |
| 前端 | Vue 3.5（Composition API） + Pinia 2 + Vue Router 4 |
| UI | Naive UI 2.42（暗色主题 + 亮色主题） |
| 样式 | Less（作用域样式） |
| HTTP | Axios（HTTPS 自签名证书 + Basic Auth） |
| 持久化 | sql.js（本地 SQLite，无需安装） |
| AI | DeepSeek chat API（deepseek-chat） |
| 发布 | GitHub Git Data API（blob → tree → commit → ref，一次发布一个 commit） |
| 构建 | Vite 6 + TypeScript 5.7 |
| 打包 | electron-builder（Windows NSIS，自动更新） |

---

# 4. 项目结构

```
electron-app/
├── src/
│   ├── main/                          # 主进程
│   │   ├── index.ts                   # 入口：窗口管理、lcu-asset:// 协议、IPC
│   │   ├── lcu/
│   │   │   ├── client.ts              # LCU 连接发现 + HTTP 客户端
│   │   │   └── extractor.ts           # 数据提取与转换
│   │   ├── sgp/                        # SGP 数据源
│   │   │   ├── types.ts               # SGP 原始响应类型（13 接口，~110 字段）
│   │   │   ├── config.ts              # 服务器地址解析
│   │   │   ├── client.ts              # HTTP 客户端（Bearer auth，401 自动续期）
│   │   │   ├── extractor.ts           # SGP raw → GameSummary + GameRecord
│   │   │   ├── index.ts               # SgpManager 单例
│   │   │   ├── token.ts               # entitlements JWT 管理
│   │   │   └── tencent-servers.json   # 内置国服地址
│   │   ├── db/                         # SQLite 持久化
│   │   │   ├── database.ts            # sql.js 数据库管理
│   │   │   ├── games.ts               # 对局摘要 + 详情 CRUD
│   │   │   └── notes.ts               # 玩家笔记
│   │   ├── publish/                    # 比赛看板发布
│   │   │   └── github-publisher.ts    # Git Data API 批量上传
│   │   ├── ipc/
│   │   │   └── lcu-handlers.ts        # IPC 端点
│   │   └── utils/
│   │       ├── logger.ts              # 文件日志（按日轮转）
│   │       ├── llm.ts                 # DeepSeek API 客户端
│   │       ├── settings.ts            # 用户设置持久化
│   │       └── updater.ts             # 自动更新（electron-updater）
│   │
│   ├── domain/                         # 领域层（零框架依赖）
│   │   └── analysis/
│   │       ├── types.ts               # 分析领域类型
│   │       ├── aggregation.ts         # 聚合函数
│   │       ├── advanced-metrics.ts    # 高阶指标计算
│   │       └── scoring/               # 评分框架
│   │
│   ├── application/                    # 应用层（端口接口）
│   │
│   ├── shared/                         # 主/渲染进程共享
│   │   ├── types/
│   │   │   ├── lcu-api.ts             # LCU API 原始响应类型
│   │   │   └── app.ts                 # 应用层类型（含 PlayerStats Challenges）
│   │   └── utils/
│   │       ├── analysis.ts            # 分析算法
│   │       ├── format-for-ai.ts       # 对局数据 → AI 可读文本
│   │       ├── dashboard-exporter.ts  # GameRecord[] → DashboardData
│   │       ├── mappings.ts            # 映射表（队列/段位/地图中文本地化）
│   │       └── mode-analysis-config.ts # 模式专属指标定义
│   │
│   ├── preload/
│   │   └── index.ts                   # contextBridge：暴露 window.lcuApi
│   │
│   └── renderer/src/                   # Vue 3 前端
│       ├── views/                     # Panel、MatchList、AnalysisView、GameDetail
│       ├── components/                # 比赛卡片、统计面板、侧边栏、标题栏
│       │   ├── chat/ChatPanel.vue     # AI 对话组件
│       │   └── settings/SettingsDialog.vue # 设置弹窗（含看板配置）
│       ├── stores/                    # Pinia：game-data、admin-mode
│       └── router/                    # Hash 路由

python/                                # Python CLI 配套工具
├── lcu_client.py                      # 独立 LCU 客户端
├── extract_matches.py                 # 批量导出比赛 JSON
└── fetch_game.py                      # 单场比赛查看器

web-dashboard/                         # 比赛看板前端（独立部署）
├── index.html                         # T1 红黑主题入口
├── app.js                             # 2×3 网格 + 横向柱状排行榜
├── data.json                          # 比赛数据（由 electron-app 发布时注入）
├── style.css                          # T1 主题样式
└── T1_esports_logo.svg.png           # T1 Logo
```

---

# 5. 构建与运行

**环境要求：**

- Node.js 20+
- Windows（LCU / SGP API 仅 Windows 可用）
- League of Legends 客户端正在运行

**安装与运行：**

```bash
cd electron-app
npm install
npm run dev        # 开发模式（热重载）
npm run build      # 生产构建
npm run typecheck  # TypeScript 类型检查
npm run package    # 构建 + 打包（electron-builder → NSIS 安装包）
```

**使用步骤：**

1. 登录 League of Legends 客户端（国服自动走 SGP 通道）
2. 启动本应用，自动检测连接并拉取战绩
3. 点击对局查看详情，勾选对局进入数据分析
4. （可选）设置 DeepSeek API Key 使用 AI 分析
5. （可选）配置 GitHub Token 一键发布比赛看板

---

# 6. 比赛看板配置

开源用户可通过设置页配置自己的 GitHub Pages 看板：

| 配置项 | 说明 |
|--------|------|
| GitHub 用户名 | 你的 GitHub 用户名 |
| 仓库名 | 用于托管看板的公开仓库（自动创建） |
| Token | Personal Access Token（需 `public_repo` 权限） |
| 管理员密码 | 发布功能的解锁密码（SHA256 哈希存储） |

配置后，在分析页点击发布按钮即可一键部署到 `https://{user}.github.io/{repo}`。

---

# 7. 发布清单

每次发版：

```bash
# 1. 更新版本号
#    修改 electron-app/package.json 中的 version 字段

# 2. 构建 + 打包
cd electron-app
npm run package

# 3. 提交 + 打 tag
git add -A
git commit -m "vX.Y.Z: <功能简述>"
git tag -a vX.Y.Z -m "vX.Y.Z: <功能简述>"
git push origin master
git push origin vX.Y.Z

# 4. 创建 GitHub Release
gh release create vX.Y.Z \
  --title "vX.Y.Z: <功能简述>" \
  --notes "<更新内容>" \
  "release/LOL-Match-Data-Viewer-Setup-X.Y.Z.exe" \
  "release/LOL-Match-Data-Viewer-Setup-X.Y.Z.exe.blockmap" \
  "release/latest.yml"
```

> **注意**：必须上传 `latest.yml`，否则自动更新会 404 失效。

---

# 8. 说明

- LCU API 使用自签名证书，已在 `LcuHttpClient` 中处理
- SGP 为国服专属通道，国际服自动降级 LCU
- 海克斯数据仅在斗魂竞技场 (CHERRY)、海克斯大乱斗 (KIWI) 模式可用
- 静态游戏数据通过 `lcu-asset://` 协议代理加载
- 日志位置：`%APPDATA%/lol-match-data-viewer/logs/`
- 首次运行若提示 PowerShell 权限，以管理员身份运行一次即可

---

# 9. 参考与致谢

本项目在架构和实现上参考了以下项目：

| 项目 | 说明 |
|------|------|
| [LeagueAkari](https://github.com/LeagueAkari/LeagueAkari) | LCU API 客户端工具集，SGP 数据源集成、模块分层架构、LCU 连接发现和 IPC 通信模式主要参考对象 |
| [Pengu Loader](https://github.com/PenguLoader/PenguLoader) | League of Legends 客户端插件加载器 |
| [lcu-and-riotclient-api](https://github.com/KebsCS/lcu-and-riotclient-api) | LCU 与 Riot Client API 文档 |
| [Seraphine](https://github.com/Zzaphkiel/Seraphine) | LCU API 工具集 |

感谢 [@HUPRO3](https://github.com/HUPRO3) 和 LeagueAkari 项目的贡献。

---

# 10. 免责声明

本软件基于 Riot Games 的 LCU / SGP API 开发，未使用侵入性技术，不直接干预或修改游戏数据。游戏更新或反作弊系统可能导致兼容性变化。

开发者不承担因使用本软件导致的账号封禁、数据丢失等任何后果。使用前请充分了解相关风险。

本应用未获得 Riot Games 的官方支持或认可。League of Legends 相关商标和版权归 Riot Games, Inc. 所有。使用本软件可能违反游戏用户协议。
