import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { logger } from '../utils/logger'

let _db: Database | null = null
let _error: string | null = null
let SQL: SqlJsStatic | null = null

function dbPath(): string {
  return path.join(app.getPath('userData'), 'data.db')
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS summoners (
    puuid TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    icon_id INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS games (
    game_id INTEGER NOT NULL,
    puuid TEXT NOT NULL,
    game_mode TEXT NOT NULL DEFAULT '',
    queue_id INTEGER NOT NULL DEFAULT 0,
    champion_id INTEGER NOT NULL DEFAULT 0,
    win INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    game_creation INTEGER NOT NULL DEFAULT 0,
    game_duration INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (game_id, puuid)
  );

  CREATE INDEX IF NOT EXISTS idx_games_puuid_time ON games(puuid, game_creation DESC);

  CREATE TABLE IF NOT EXISTS game_details (
    game_id INTEGER PRIMARY KEY,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS notes (
    game_id INTEGER NOT NULL,
    puuid TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, puuid)
  );
`

export async function initDb(): Promise<void> {
  if (_db) return
  try {
    SQL = await initSqlJs()
    const p = dbPath()
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      _db = new SQL.Database(buf)
    } else {
      _db = new SQL.Database()
    }
    _db.run(SCHEMA)
    saveToDisk()
    logger.info('DB', `已打开 ${p}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    _error = msg
    logger.warn('DB', `打开失败 (降级运行): ${msg}`)
    // 不抛——DB 初始化失败不阻止应用启动，降级为纯内存模式
  }
}

export function getDb(): Database {
  if (_db) return _db
  throw new Error('DB 未初始化，请先调用 initDb()')
}

export function getDbSafe(): Database | null {
  try {
    return getDb()
  } catch {
    return null
  }
}

export function getDbError(): string | null {
  return _error
}

function saveToDisk(): void {
  if (!_db) return
  try {
    const data = _db.export()
    const p = dbPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, Buffer.from(data))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    _error = msg
    logger.warn('DB', `写入失败 (C盘满/权限不足): ${msg}`)
    // 不抛——本次会话数据在内存中，只是没落盘
  }
}

/** 每次写操作后调用 */
export function flushDb(): void {
  saveToDisk()
}

export function closeDb(): void {
  if (_db) {
    try {
      saveToDisk()
      _db.close()
      logger.info('DB', '已关闭')
    } catch (e: unknown) {
      logger.warn('DB', `关闭异常: ${String(e)}`)
    }
    _db = null
    SQL = null
  }
}
