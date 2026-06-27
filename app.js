/**
 * 海斗比赛看板 — 渲染逻辑
 * 读取 data.json → 渲染 Header + 指标卡片网格 + MVP 栏
 * 零框架，纯 DOM 操作 · 兼容 file:// 本地打开 + HTTP(S) 托管
 */

// ── HTML 转义（防 XSS） ──
var ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENTITIES[c] })
}

// ── 数字格式化 ──
function fmt(v) {
  var n = Number(v)
  if (!isFinite(n)) return '0'
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

// ── 渲染 Header ──
function renderHeader(meta) {
  document.getElementById('round-name').textContent = meta.round || '海斗比赛'
  document.getElementById('round-detail').textContent =
    (meta.mode || '') + ' · ' + (meta.playerCount || 0) + '名选手'
  document.getElementById('meta-line').textContent =
    '更新于 ' + new Date(meta.updatedAt).toLocaleString('zh-CN')
}

// ── 渲染单张指标卡片 ──
function createCard(metric) {
  var card = document.createElement('div')
  card.className = 'metric-card'
  card.style.setProperty('--accent', metric.color || '#ff4655')

  var top = metric.ranking[0] || {}
  var top2 = metric.ranking[1]
  var top3 = metric.ranking[2]

  // 冠军行
  var champHTML = esc(top.name || '—') + '<span class="role"> · ' + esc(top.champion || '') + '</span>'
  if (top.title) {
    champHTML += '<br><span style="font-size:11px;color:var(--accent)">「' + esc(top.title) + '」</span>'
  }

  // 子排名行
  var subParts = []
  if (top2) subParts.push('2. ' + esc(top2.name) + ' ' + fmt(top2.value))
  if (top3) subParts.push('3. ' + esc(top3.name) + ' ' + fmt(top3.value))

  card.innerHTML =
    '<div class="card-accent"></div>' +
    '<div class="card-icon">' + esc(metric.icon || '') + '</div>' +
    '<div class="card-label">' + esc(metric.label) + '</div>' +
    '<div class="card-value">' + fmt(top.value) + '</div>' +
    '<div class="card-champion">' + champHTML + '</div>' +
    '<div class="card-sub">' + subParts.join(' · ') + '</div>'

  return card
}

// ── 渲染网格 ──
function renderGrid(metrics) {
  var grid = document.getElementById('metrics-grid')
  grid.innerHTML = ''
  var keys = Object.keys(metrics)
  for (var i = 0; i < keys.length; i++) {
    var metric = metrics[keys[i]]
    if (metric.ranking && metric.ranking.length > 0) {
      grid.appendChild(createCard(metric))
    }
  }
}

// ── 找出 MVP（3-2-1 积分制） ──
function findMVP(metrics) {
  var scores = {}
  var keys = Object.keys(metrics)
  for (var i = 0; i < keys.length; i++) {
    var metric = metrics[keys[i]]
    for (var j = 0; j < metric.ranking.length; j++) {
      var r = metric.ranking[j]
      if (!r) continue
      scores[r.name] = (scores[r.name] || 0) + (3 - j)
    }
  }
  var mvpName = ''
  var mvpMax = 0
  var scoreKeys = Object.keys(scores)
  for (var s = 0; s < scoreKeys.length; s++) {
    if (scores[scoreKeys[s]] > mvpMax) {
      mvpMax = scores[scoreKeys[s]]
      mvpName = scoreKeys[s]
    }
  }
  // 找到该选手登顶的指标
  var tops = []
  for (var k = 0; k < keys.length; k++) {
    var m = metrics[keys[k]]
    if (m.ranking[0] && m.ranking[0].name === mvpName) {
      tops.push((m.icon || '') + ' ' + m.label + ' ' + fmt(m.ranking[0].value))
    }
  }
  return { name: mvpName, tops: tops.slice(0, 3).join(' · ') }
}

// ── 渲染 MVP ──
function renderMVP(metrics) {
  var mvp = findMVP(metrics)
  document.getElementById('mvp-bar').innerHTML =
    '🏆 本轮 MVP：<strong>' + esc(mvp.name) + '</strong> — ' + esc(mvp.tops || '多项数据领先')
}

// ── 用数据渲染全部 ──
function renderAll(data) {
  renderHeader(data.meta || {})
  renderGrid(data.metrics || {})
  renderMVP(data.metrics || {})
}

// ── 主流程 ──
// 优先 fetch data.json（HTTP 环境），失败则用内嵌示例数据（file:// 兼容）
fetch('data.json')
  .then(function (resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    return resp.json()
  })
  .then(function (data) {
    renderAll(data)
  })
  .catch(function () {
    // file:// 协议下 fetch 不可用 —— 使用内嵌示例数据
    renderAll({
      meta: {
        round: '示例轮次',
        mode: '召唤师峡谷',
        playerCount: 8,
        updatedAt: new Date().toISOString()
      },
      metrics: {
        kills: {
          label: '击杀王', icon: '⚔️', color: '#ff4655',
          ranking: [
            { name: '选手A', champion: '亚索', value: 18, title: '死神降临' },
            { name: '选手B', champion: '盲僧', value: 15 },
            { name: '选手C', champion: '发条', value: 12 }
          ]
        },
        deaths: {
          label: '无暇赴死', icon: '💀', color: '#888888',
          ranking: [
            { name: '选手F', champion: '剑姬', value: 11, title: '无暇赴死' },
            { name: '选手G', champion: '蜘蛛', value: 9 },
            { name: '选手H', champion: '维克托', value: 8 }
          ]
        },
        damage: {
          label: '伤害王', icon: '🗡️', color: '#ff4655',
          ranking: [
            { name: '选手A', champion: '亚索', value: 38500, title: '我真尽力了' },
            { name: '选手C', champion: '发条', value: 31200 },
            { name: '选手D', champion: '金克斯', value: 28400 }
          ]
        },
        tank: {
          label: '承伤王', icon: '🛡️', color: '#54a0ff',
          ranking: [
            { name: '选手E', champion: '蕾欧娜', value: 42000, title: '耐打王' },
            { name: '选手F', champion: '剑姬', value: 35000 },
            { name: '选手B', champion: '盲僧', value: 29000 }
          ]
        },
        kda: {
          label: 'KDA', icon: '🎯', color: '#8b5cf6',
          ranking: [
            { name: '选手A', champion: '亚索', value: 6.3 },
            { name: '选手D', champion: '金克斯', value: 4.8 },
            { name: '选手C', champion: '发条', value: 3.2 }
          ]
        },
        gold: {
          label: '打钱王', icon: '💰', color: '#ffd700',
          ranking: [
            { name: '选手A', champion: '亚索', value: 18500, title: '大富翁' },
            { name: '选手D', champion: '金克斯', value: 16200 },
            { name: '选手C', champion: '发条', value: 15800 }
          ]
        }
      }
    })
  })
