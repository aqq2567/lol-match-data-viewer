# Analysis Page UI Redesign — OP.GG 风格升级

**日期**: 2026-06-04  
**目标**: 将分析页面视觉升级至 OP.GG 级别的高级感，全局 CSS token 同时升级使其他页面受益  
**策略**: 方案 B —— 分析页重点重构 + 全局 Token 升级  
**参考**: OP.GG 桌面端暗色主题

---

## 一、设计原则

- 毛玻璃分层：背景 < 卡片 < 悬浮元素，通过 `rgba` 透明度建立三层景深
- 数字即主角：大号粗体数字是视觉焦点，标签文字退后
- 微交互反馈：每个可交互元素 hover 时有响应，但不喧宾夺主
- 游戏资产利用：LCU 原版英雄/装备图标本身就很有质感，放大使用

---

## 二、全局 CSS Token 升级

**文件**: `src/renderer/src/assets/css/styles.less`

### 2.1 新增 Token

```less
[data-theme='dark'] {
  // 毛玻璃分层
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.06);
  --card-elevated: rgba(255, 255, 255, 0.06);

  // 氛围光（用于卡片边缘发光）
  --glow-gold: rgba(232, 168, 64, 0.15);
  --glow-red: rgba(232, 64, 87, 0.12);
  --glow-blue: rgba(60, 140, 208, 0.12);

  // 强调色
  --accent-gold: #e8a840;
  --accent-red: #e84057;
  --accent-green: #2ea86c;

  // 圆角
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  // 阴影
  --card-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  --card-shadow-hover: 0 4px 20px rgba(0, 0, 0, 0.4);
}
```

亮色主题提供对应值。

### 2.2 字体系统

```less
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

// 字体 Token
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
--font-number: 'Inter', 'SF Pro Display', -apple-system, sans-serif;

// 字体大小层级
--text-xs: 11px;
--text-sm: 12px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 20px;
--text-2xl: 28px;
--text-3xl: 36px;
```

### 2.3 数字字体规则

- 数值列/货币/百分比 → `font-family: var(--font-number)` + `font-feature-settings: 'tnum' 1`（等宽数字对齐）
- 大数值 → `font-weight: 800` + `letter-spacing: -0.02em`
- 不再使用系统默认 monospace 作为数字字体

---

## 三、分析页逐区改造

**文件**: `src/renderer/src/views/AnalysisView.vue`

### 3.1 Header 概览栏

- 左侧：当前模式名（大字 + 模式对应色）
- 右侧：3 个 stat card（分析局数 / W-L / 胜率）
- 每个 card：毛玻璃小卡片，数值大且粗，标签在下方小字
- 胜率 card 根据值变色：≥50% 绿色、<50% 红色
- 背景：毛玻璃 + 底部分割线

### 3.2 指标侧边栏

- 宽度从 160px 扩至 200px
- 保留折叠/展开功能（用户明确要求）
- 指标项：颜色圆点 + 标签文字，去掉数值预览
- 选中态：左侧亮色边框 + 背景高亮 + 微量内发光
- 分类标题用半透明分割线隔开

### 3.3 领奖台

- 第 1 名顶部加金色称号徽章（渐变 pill）+ 皇冠图标
- 头像边框：金（1st）/ 银（2nd）/ 铜（3rd）
- 头像加对应色 glow（box-shadow）
- 底座改为金属渐变 + 内阴影
- 整体卡片：毛玻璃背景 + card-shadow
- 入场动画：3 个台座依次弹性弹入（cubic-bezier 弹性曲线）

### 3.4 排名表

- 用自定义 HTML 表格替换 NDataTable
- 每行：头像 + 玩家名 | 统计值 | 场均 | 场次 | 胜率（带进度条）
- 第 1 名行左 border 金色、最后 1 名红色（高阶指标）
- 胜率列：文字颜色 + 细进度条背景
- 行 hover：微上浮 + 背景提亮
- 表头 sticky
- 交替行透明度差极微妙（0.02 级别）

### 3.5 首末名卡片（高阶指标）

- 左右各一 card，中间分割线
- 左侧（最佳）：金色氛围光 + 金色标签
- 右侧（最末）：红色氛围光 + 红色标签
- 大号数值 + 玩家头像 + 称号徽章

### 3.6 装备/海克斯/英雄池

保持现有布局，仅 CSS 微调：
- 卡片加毛玻璃背景 + 圆角
- hover 时边框变亮 + 微上浮
- 图标尺寸不变、布局不变

---

## 四、微交互与动效

**文件**: `src/renderer/src/assets/css/transition.less`

| 场景 | 实现 | 时长 |
|------|------|------|
| 侧边栏选中 | 高亮条 transition | 0.15s ease |
| 卡片 hover | transform + box-shadow | 0.2s ease-out |
| 排名表行 hover | background-color | 0.15s |
| 领奖台入场 | @keyframes podium-enter（弹性） | 0.4s |
| 数值变化 | color transition | 0.2s |

- 不引入动画库，纯 CSS
- 弹性曲线：`cubic-bezier(0.34, 1.56, 0.64, 1)`

---

## 五、实施清单

### Phase 1: 全局基础
1. `styles.less` — 新增 CSS token + 字体系统
2. `transition.less` — 新增动效 utility

### Phase 2: 分析页组件
3. `AnalysisView.vue` — Header 改造
4. `AnalysisView.vue` — 侧边栏改造
5. `AnalysisView.vue` — 领奖台改造
6. `AnalysisView.vue` — 排名表（NDataTable → 自定义）
7. `AnalysisView.vue` — 首末名卡片改造
8. `AnalysisView.vue` — 装备/海克斯/英雄池 CSS 微调

### Phase 3: 收尾
9. 暗/亮双主题验证
10. 提交 commit

---

## 六、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `styles.less` | 修改 | 新增 CSS token + 字体系统 |
| `transition.less` | 修改 | 新增动效 keyframes |
| `AnalysisView.vue` | 大量修改 | 模板重写 + 样式重写 |

不新增文件，不新增依赖。
