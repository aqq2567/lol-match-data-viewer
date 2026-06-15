import { getDbSafe, flushDb } from './database'

export interface Note {
  game_id: number
  puuid: string
  text: string
  tags: string[]
  created_at: number
}

export function saveNote(gameId: number, puuid: string, text: string, tags: string[]): void {
  const db = getDbSafe()
  if (!db) return
  db.run(
    'INSERT OR REPLACE INTO notes (game_id, puuid, text, tags, created_at) VALUES (?, ?, ?, ?, ?)',
    [gameId, puuid, text, tags.join(','), Date.now()],
  )
  flushDb()
}

export function getNote(gameId: number, puuid: string): Note | null {
  const db = getDbSafe()
  if (!db) return null
  const rows = db.exec(
    'SELECT game_id, puuid, text, tags, created_at FROM notes WHERE game_id = ? AND puuid = ?',
    [gameId, puuid],
  )
  if (!rows.length) return null
  const [gid, p, text, tagsStr, ts] = rows[0].values[0] as any[]
  return {
    game_id: Number(gid),
    puuid: String(p),
    text: String(text),
    tags: String(tagsStr).split(',').filter(Boolean),
    created_at: Number(ts),
  }
}

export function getNotesForPlayer(puuid: string): Note[] {
  const db = getDbSafe()
  if (!db) return []
  const rows = db.exec(
    'SELECT game_id, puuid, text, tags, created_at FROM notes WHERE puuid = ? ORDER BY created_at DESC',
    [puuid],
  )
  if (!rows.length) return []
  return rows[0].values.map((r: any) => ({
    game_id: Number(r[0]),
    puuid: String(r[1]),
    text: String(r[2]),
    tags: String(r[3]).split(',').filter(Boolean),
    created_at: Number(r[4]),
  }))
}

export function deleteNote(gameId: number, puuid: string): void {
  const db = getDbSafe()
  if (!db) return
  db.run('DELETE FROM notes WHERE game_id = ? AND puuid = ?', [gameId, puuid])
  flushDb()
}
