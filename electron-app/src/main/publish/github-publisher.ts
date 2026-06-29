/**
 * GitHub Pages 一键发布模块
 * 使用 Git Data API 批量上传，一次发布 = 一个 commit
 *
 * 依赖: 仅 fetch API（Node 18+ 内置）和 settings
 */
import { app } from 'electron'
import { getSettings } from '@main/utils/settings'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { DashboardData } from '@shared/types'

const GITHUB_API = 'https://api.github.com'

// ═══════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

async function ghRequest(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  return fetch(`${GITHUB_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
}

async function ghGet<T = Record<string, unknown>>(token: string, path: string): Promise<T> {
  const resp = await ghRequest(token, 'GET', path)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`GitHub API 请求失败 ${path} (${resp.status}): ${(err as any).message || resp.statusText}`)
  }
  return resp.json()
}

async function ghPost<T = Record<string, unknown>>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await ghRequest(token, 'POST', path, body)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    if (resp.status === 401) throw new Error('Token 无效或已过期，请重新生成')
    if (resp.status === 404) throw new Error(`资源不存在 (${path})，请检查仓库名`)
    throw new Error(`GitHub API 请求失败 (${resp.status}): ${(err as any).message || resp.statusText}`)
  }
  return resp.json()
}

// ═══════════════════════════════════════════════════════════
// 仓库 & Pages
// ═══════════════════════════════════════════════════════════

async function ensureRepo(token: string, owner: string, repo: string): Promise<void> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}`)
  if (resp.ok) return
  if (resp.status !== 404) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`检查仓库失败 (${resp.status}): ${(err as any).message || resp.statusText}`)
  }
  const createResp = await ghRequest(token, 'POST', '/user/repos', {
    name: repo, auto_init: true, private: false,
  })
  if (!createResp.ok) {
    const err = await createResp.json().catch(() => ({}))
    if (createResp.status === 422) throw new Error(`仓库 "${repo}" 已存在但无法访问，请检查 Token`)
    throw new Error(`创建仓库失败 (${createResp.status}): ${(err as any).message || ''}`)
  }
}

async function getDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}`)
  if (!resp.ok) return 'main'
  const info = await resp.json().catch(() => ({}))
  return (info as any).default_branch || 'main'
}

async function ensurePages(token: string, owner: string, repo: string): Promise<void> {
  const resp = await ghRequest(token, 'GET', `/repos/${owner}/${repo}/pages`)
  if (resp.ok) return
  const branch = await getDefaultBranch(token, owner, repo)
  const enableResp = await ghRequest(token, 'POST', `/repos/${owner}/${repo}/pages`, {
    source: { branch, path: '/' },
  })
  if (!enableResp.ok && enableResp.status !== 409) {
    const err = await enableResp.json().catch(() => ({}))
    throw new Error(`启用 Pages 失败 (${enableResp.status}): ${(err as any).message || ''}`)
  }
}

// ═══════════════════════════════════════════════════════════
// Git Data API — 批量上传（一次 commit）
// ═══════════════════════════════════════════════════════════

interface GhRef {
  ref: string
  object: { sha: string; type: string }
}

interface GhCommit {
  sha: string
  tree: { sha: string }
  parents: Array<{ sha: string }>
}

interface GhBlob {
  sha: string
}

interface GhTree {
  sha: string
}

/**
 * 使用 Git Data API 批量上传多个文件，生成唯一一个 commit
 */
async function batchUpload(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string,
): Promise<void> {
  // 1. 获取当前 ref 指向的 commit
  let baseTreeSha: string
  let parentSha: string | null = null

  try {
    const ref: GhRef = await ghGet(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    parentSha = ref.object.sha
    const commit: GhCommit = await ghGet(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`)
    baseTreeSha = commit.tree.sha
  } catch {
    // 空仓库（auto_init=true 时 GitHub 已创建初始 commit）
    const ref: GhRef = await ghGet(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    parentSha = ref.object.sha
    const commit: GhCommit = await ghGet(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`)
    baseTreeSha = commit.tree.sha
  }

  // 2. 为每个文件创建 blob
  const treeEntries: Array<{
    path: string
    mode: string
    type: 'blob'
    sha: string
  }> = []

  for (const file of files) {
    const blob: GhBlob = await ghPost(token, `/repos/${owner}/${repo}/git/blobs`, {
      content: file.content,
      encoding: 'utf-8',
    })
    treeEntries.push({
      path: file.path,
      mode: '100644',  // 普通文件
      type: 'blob',
      sha: blob.sha,
    })
  }

  // 3. 创建新 tree（基于原 tree 叠加修改）
  const newTree: GhTree = await ghPost(token, `/repos/${owner}/${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeEntries,
  })

  // 4. 创建新 commit
  const commitBody: Record<string, unknown> = {
    message,
    tree: newTree.sha,
    parents: parentSha ? [parentSha] : [],
  }
  const newCommit: GhCommit = await ghPost(token, `/repos/${owner}/${repo}/git/commits`, commitBody)

  // 5. 更新分支 ref
  await ghRequest(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    sha: newCommit.sha,
    force: false,
  })
}

// ═══════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════

export async function publishDashboard(data: DashboardData): Promise<string> {
  const settings = getSettings()
  const cfg = settings.dashboard
  if (!cfg || !cfg.ghToken || !cfg.ghUser || !cfg.ghRepo) {
    throw new Error('请先在设置中配置 GitHub 用户名、仓库名和 Token')
  }

  const { ghToken, ghUser, ghRepo } = cfg

  await ensureRepo(ghToken, ghUser, ghRepo)
  await ensurePages(ghToken, ghUser, ghRepo)

  const branch = await getDefaultBranch(ghToken, ghUser, ghRepo)

  // 读取 web-dashboard/ 全部静态文件
  const dashboardDir = join(app.getAppPath(), '..', 'web-dashboard')
  function readDashboardFile(filename: string): string {
    try {
      return readFileSync(join(dashboardDir, filename), 'utf-8')
    } catch {
      throw new Error(`找不到看板文件: ${join(dashboardDir, filename)}`)
    }
  }

  const now = new Date().toLocaleString('zh-CN')
  const commitMsg = `📊 更新比赛数据 — ${data.meta.round} (${now})`

  // 一次 commit 上传全部文件
  await batchUpload(ghToken, ghUser, ghRepo, branch, [
    { path: 'data.json',  content: JSON.stringify(data, null, 2) },
    { path: 'index.html', content: readDashboardFile('index.html') },
    { path: 'app.js',     content: readDashboardFile('app.js') },
    { path: 'style.css',  content: readDashboardFile('style.css') },
  ], commitMsg)

  return `https://${ghUser}.github.io/${ghRepo}`
}
