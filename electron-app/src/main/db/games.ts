import { getDbSafe, flushDb } from './database'
import type { GameSummary, GameRecord } from '@shared/types'

export function saveGameSummaries(puuid: string, summaries: GameSummary[]): void {
  const db = getDbSafe()
  if (!db) return

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO games
      (game_id, puuid, game_mode, queue_id, champion_id, win, kills, deaths, assists, game_creation, game_duration, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const g of summaries) {
    stmt.run([
      g.gameId,
      puuid,
      g.gameMode,
      g.queueId,
      g.championId,
      g.win ? 1 : 0,
      g.kills,
      g.deaths,
      g.assists,
      g.gameCreation,
      g.gameDuration,
      JSON.stringify(g),
    ])
  }
  stmt.free()

  db.run('INSERT OR REPLACE INTO summoners (puuid, last_updated) VALUES (?, ?)', [
    puuid, Date.now(),
  ])

  flushDb()
}

export function getRecentGameSummaries(puuid: string, limit: number): GameSummary[] {
  const db = getDbSafe()
  if (!db) return []

  const rows = db.exec(
    `SELECT summary_json FROM games WHERE puuid = ? ORDER BY game_creation DESC LIMIT ?`,
    [puuid, limit],
  )
  if (!rows.length) return []

  return rows[0].values.map(([json]: any) => JSON.parse(json as string) as GameSummary)
}

export function getGameSummaryCount(puuid: string): number {
  const db = getDbSafe()
  if (!db) return 0
  const rows = db.exec('SELECT COUNT(*) FROM games WHERE puuid = ?', [puuid])
  if (!rows.length) return 0
  return Number(rows[0].values[0][0])
}

export function saveGameDetail(gameId: number, detail: GameRecord): void {
  const db = getDbSafe()
  if (!db) return
  db.run('INSERT OR REPLACE INTO game_details (game_id, detail_json) VALUES (?, ?)', [
    gameId,
    JSON.stringify(detail),
  ])
  flushDb()
}

export function getGameDetail(gameId: number): GameRecord | null {
  const db = getDbSafe()
  if (!db) return null
  const rows = db.exec('SELECT detail_json FROM game_details WHERE game_id = ?', [gameId])
  if (!rows.length) return null
  const json = rows[0].values[0][0] as string
  return JSON.parse(json) as GameRecord
}

export function hasGameDetail(gameId: number): boolean {
  const db = getDbSafe()
  if (!db) return false
  const rows = db.exec('SELECT 1 FROM game_details WHERE game_id = ?', [gameId])
  return rows.length > 0
}
