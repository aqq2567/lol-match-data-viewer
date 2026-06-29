/**
 * 冬天杯4.0 — 数据看板
 * 2×3 横向柱状排行榜 · T1 红黑主题
 * 兼容 file:// 与 GitHub Pages
 */
;(function () {
  'use strict'

  /* ── CDN 策略 ──
     游戏头像 → CommunityDragon（Data Dragon 头像接口国内 403）
     英雄头像 → Data Dragon（兜底，Data Dragon 英雄接口正常）
  ── */
  var DD_VER = '14.10.1'
  var DD_BASE = 'https://ddragon.leagueoflegends.com/cdn/' + DD_VER + '/img/'
  var CD_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/'

  function profileIconUrl(id) {
    return id ? CD_BASE + id + '.jpg' : ''
  }

  // 兜底：如果 profileIconId 缺失，尝试用 champion 名映射到英雄头像
  var CHAMP_KEY = {
    '亚索':'Yasuo','盲僧':'LeeSin','发条':'Orianna','金克斯':'Jinx',
    '蕾欧娜':'Leona','剑姬':'Fiora','蜘蛛':'Elise','维克托':'Viktor',
    '劫':'Zed','阿卡丽':'Akali','EZ':'Ezreal','卡莎':'Kaisa',
    '塞纳':'Senna','锤石':'Thresh','酒桶':'Gragas','男枪':'Graves',
    '女枪':'MissFortune','琴女':'Sona','宝石':'Taric','龙龟':'Rammus',
    '艾希':'Ashe','盖伦':'Garen','瑞兹':'Ryze','提莫':'Teemo',
    '安妮':'Annie','拉克丝':'Lux','易':'MasterYi','贾克斯':'Jax',
    '卡特琳娜':'Katarina','凯隐':'Kayn','艾克':'Ekko','瑟提':'Sett',
    '永恩':'Yone','佛耶戈':'Viego','塞拉斯':'Sylas','阿狸':'Ahri',
    '李青':'LeeSin','伊泽瑞尔':'Ezreal','薇恩':'Vayne',
    '德莱文':'Draven','卢锡安':'Lucian','霞':'Xayah','洛':'Rakan',
    '岩雀':'Taliyah','佐伊':'Zoe','阿克尚':'Akshan','薇古丝':'Vex',
    '格温':'Gwen','纳尔':'Gnar','凯南':'Kennen','慎':'Shen',
    '泰隆':'Talon','卡兹克':'Khazix',
    '雷恩加尔':'Rengar','狮子狗':'Rengar','螳螂':'Khazix',
    '诺手':'Darius','德莱厄斯':'Darius','剑圣':'MasterYi',
    '石头人':'Malphite','熔岩':'Malphite','雪人':'Nunu',
    '机器人':'Blitzcrank','蒸汽':'Blitzcrank','日女':'Leona',
  }

  function championIconUrl(name) {
    var key = CHAMP_KEY[name] || name
    return DD_BASE + 'champion/' + key + '.png'
  }

  /* ── 数字格式化 ── */
  function fmtVal(v) {
    var n = Number(v)
    if (!isFinite(n)) return '0'
    if (n >= 10000) return (n / 1000).toFixed(1) + 'K'
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(1)
  }

  /* ── 排名行 class ── */
  function rankClass(r) {
    if (r === 1) return ' g'
    if (r === 2) return ' s'
    if (r === 3) return ' b'
    return ''
  }
  function topClass(r) {
    if (r === 1) return ' t1'
    if (r === 2) return ' t2'
    if (r === 3) return ' t3'
    return ''
  }

  /* ── 指标展示顺序 ── */
  var METRIC_ORDER = ['score','mvp','kills','deaths','kda','damage']

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */

  function renderAll(data) {
    var meta = data.meta || {}
    var metrics = data.metrics || {}

    // Update time
    var ts = meta.updatedAt
      ? new Date(meta.updatedAt).toLocaleString('zh-CN', { hour12: false })
      : '—'
    document.getElementById('update-time').textContent = '更新于 ' + ts

    // Title
    var round = meta.round || '冬天杯4.0'
    document.title = round + ' — 数据看板'
    var h1 = document.querySelector('.top-bar .brand h1')
    if (h1) h1.textContent = round

    // Build grid
    var grid = document.getElementById('grid')
    grid.innerHTML = ''

    for (var i = 0; i < METRIC_ORDER.length; i++) {
      var key = METRIC_ORDER[i]
      var metric = metrics[key]
      if (!metric || !metric.ranking || !metric.ranking.length) continue

      var ranking = metric.ranking
      // 按 value 降序排序
      ranking.sort(function (a, b) { return b.value - a.value })
      var maxVal = ranking[0].value || 1

      // Card wrapper
      var card = document.createElement('div')
      card.className = 'card'

      // Header
      var hd = document.createElement('div')
      hd.className = 'card-hd'
      hd.innerHTML = '<span class="icon">' + esc(metric.icon || '') + '</span><span class="label">' + esc(metric.label || key) + '</span>'
      card.appendChild(hd)

      // Scrollable body
      var body = document.createElement('div')
      body.className = 'card-body'

      for (var j = 0; j < ranking.length; j++) {
        var entry = ranking[j]
        var rank = j + 1
        var pct = maxVal > 0 ? (entry.value / maxVal * 100).toFixed(1) + '%' : '0%'
        // 优先使用游戏头像（profileIconId），缺失时回退到英雄头像
        var iconUrl = entry.profileIconId
          ? profileIconUrl(entry.profileIconId)
          : (entry.champion ? championIconUrl(entry.champion) : '')

        var row = document.createElement('div')
        row.className = 'rr' + topClass(rank)
        row.innerHTML =
          '<span class="rk' + rankClass(rank) + '">' + rank + '</span>' +
          (iconUrl
            ? '<img class="av" src="' + esc(iconUrl) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="av" style="visibility:hidden"></span>'
          ) +
          '<span class="nm">' + esc(entry.name || '—') + '</span>' +
          '<span class="bar-wrap"><span class="bar" style="width:' + pct + '"></span></span>' +
          '<span class="val">' + fmtVal(entry.value) + '</span>'
        body.appendChild(row)
      }

      card.appendChild(body)
      grid.appendChild(card)
    }
  }

  /* ── HTML 转义 ── */
  var ENT = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENT[c] }) }

  /* ═══════════════════════════════════════════
     Bootstrap
     ═══════════════════════════════════════════ */

  // 带时间戳防缓存（GitHub Pages CDN 可能缓存数分钟）
  fetch('data.json?v=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)) })
    .then(renderAll)
    .catch(function (err) {
      // 显示错误信息（帮助诊断空白页面问题）
      var grid = document.getElementById('grid')
      if (grid) {
        grid.innerHTML = '<div style="color:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;height:100%;font-size:0.75rem">数据加载失败: ' + esc(err.message) + '<br>将使用示例数据展示</div>'
      }
      // 离线 / file:// 回退：内联示例数据
      renderAll({
        meta: {
          round: '冬天杯4.0',
          mode: '召唤师峡谷',
          playerCount: 20,
          updatedAt: new Date().toISOString()
        },
        metrics: {
          score:  { label:'积分',icon:'🏆',color:'#ffd700', ranking: [
            {name:'选手A',champion:'亚索',profileIconId:1,value:8},{name:'选手B',champion:'盲僧',profileIconId:2,value:7},
            {name:'选手C',champion:'发条',profileIconId:3,value:6},{name:'选手D',champion:'金克斯',profileIconId:4,value:5},
            {name:'选手E',champion:'蕾欧娜',profileIconId:5,value:5},{name:'选手F',champion:'剑姬',profileIconId:6,value:4},
            {name:'选手G',champion:'蜘蛛',profileIconId:7,value:4},{name:'选手H',champion:'维克托',profileIconId:8,value:3},
            {name:'选手I',champion:'劫',profileIconId:9,value:3},{name:'选手J',champion:'阿卡丽',profileIconId:10,value:2},
            {name:'选手K',champion:'EZ',profileIconId:11,value:2},{name:'选手L',champion:'卡莎',profileIconId:12,value:1}
          ]},
          mvp:    { label:'MVP',icon:'⭐',color:'#ffd700', ranking: [
            {name:'选手A',champion:'亚索',profileIconId:1,value:0},{name:'选手B',champion:'盲僧',profileIconId:2,value:0},
            {name:'选手C',champion:'发条',profileIconId:3,value:0},{name:'选手D',champion:'金克斯',profileIconId:4,value:0},
            {name:'选手E',champion:'蕾欧娜',profileIconId:5,value:0},{name:'选手F',champion:'剑姬',profileIconId:6,value:0},
            {name:'选手G',champion:'蜘蛛',profileIconId:7,value:0},{name:'选手H',champion:'维克托',profileIconId:8,value:0},
            {name:'选手I',champion:'劫',profileIconId:9,value:0},{name:'选手J',champion:'阿卡丽',profileIconId:10,value:0},
            {name:'选手K',champion:'EZ',profileIconId:11,value:0},{name:'选手L',champion:'卡莎',profileIconId:12,value:0}
          ]},
          kills:  { label:'击杀',icon:'⚔️',color:'#ff4655', ranking: [
            {name:'选手A',champion:'亚索',profileIconId:1,value:32},{name:'选手B',champion:'盲僧',profileIconId:2,value:28},
            {name:'选手D',champion:'金克斯',profileIconId:4,value:25},{name:'选手C',champion:'发条',profileIconId:3,value:22},
            {name:'选手F',champion:'剑姬',profileIconId:6,value:20},{name:'选手E',champion:'蕾欧娜',profileIconId:5,value:18},
            {name:'选手G',champion:'蜘蛛',profileIconId:7,value:16},{name:'选手H',champion:'维克托',profileIconId:8,value:14},
            {name:'选手I',champion:'劫',profileIconId:9,value:12},{name:'选手J',champion:'阿卡丽',profileIconId:10,value:10},
            {name:'选手K',champion:'EZ',profileIconId:11,value:8},{name:'选手L',champion:'卡莎',profileIconId:12,value:6}
          ]},
          deaths: { label:'死亡',icon:'💀',color:'#888888', ranking: [
            {name:'选手L',champion:'卡莎',profileIconId:12,value:18},{name:'选手K',champion:'EZ',profileIconId:11,value:16},
            {name:'选手J',champion:'阿卡丽',profileIconId:10,value:15},{name:'选手I',champion:'劫',profileIconId:9,value:14},
            {name:'选手H',champion:'维克托',profileIconId:8,value:12},{name:'选手G',champion:'蜘蛛',profileIconId:7,value:11},
            {name:'选手F',champion:'剑姬',profileIconId:6,value:10},{name:'选手E',champion:'蕾欧娜',profileIconId:5,value:9},
            {name:'选手D',champion:'金克斯',profileIconId:4,value:8},{name:'选手C',champion:'发条',profileIconId:3,value:7},
            {name:'选手B',champion:'盲僧',profileIconId:2,value:6},{name:'选手A',champion:'亚索',profileIconId:1,value:4}
          ]},
          kda:    { label:'KDA',icon:'🎯',color:'#8b5cf6', ranking: [
            {name:'选手A',champion:'亚索',profileIconId:1,value:9.2},{name:'选手C',champion:'发条',profileIconId:3,value:6.8},
            {name:'选手B',champion:'盲僧',profileIconId:2,value:5.5},{name:'选手D',champion:'金克斯',profileIconId:4,value:4.7},
            {name:'选手F',champion:'剑姬',profileIconId:6,value:3.9},{name:'选手E',champion:'蕾欧娜',profileIconId:5,value:3.2},
            {name:'选手G',champion:'蜘蛛',profileIconId:7,value:2.8},{name:'选手H',champion:'维克托',profileIconId:8,value:2.4},
            {name:'选手I',champion:'劫',profileIconId:9,value:2.1},{name:'选手J',champion:'阿卡丽',profileIconId:10,value:1.8},
            {name:'选手K',champion:'EZ',profileIconId:11,value:1.3},{name:'选手L',champion:'卡莎',profileIconId:12,value:0.7}
          ]},
          damage: { label:'输出',icon:'🗡️',color:'#ff4655', ranking: [
            {name:'选手A',champion:'亚索',profileIconId:1,value:52000},{name:'选手D',champion:'金克斯',profileIconId:4,value:48500},
            {name:'选手C',champion:'发条',profileIconId:3,value:42100},{name:'选手B',champion:'盲僧',profileIconId:2,value:38000},
            {name:'选手F',champion:'剑姬',profileIconId:6,value:34000},{name:'选手H',champion:'维克托',profileIconId:8,value:31000},
            {name:'选手E',champion:'蕾欧娜',profileIconId:5,value:28000},{name:'选手G',champion:'蜘蛛',profileIconId:7,value:25000},
            {name:'选手I',champion:'劫',profileIconId:9,value:22000},{name:'选手J',champion:'阿卡丽',profileIconId:10,value:18000},
            {name:'选手K',champion:'EZ',profileIconId:11,value:15000},{name:'选手L',champion:'卡莎',profileIconId:12,value:12000}
          ]}
        }
      })
    })
})()
