import Database from 'better-sqlite3'
import type { StorageAdapter } from 'grammy'

export class SqliteStorage<T> implements StorageAdapter<T> {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`)
  }

  read(key: string) {
    const row = this.db.prepare('SELECT value FROM sessions WHERE key = ?').get(key) as { value: string } | undefined
    return row ? (JSON.parse(row.value) as T) : undefined
  }

  write(key: string, value: T) {
    this.db.prepare('REPLACE INTO sessions (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
  }

  delete(key: string) {
    this.db.prepare('DELETE FROM sessions WHERE key = ?').run(key)
  }

  readAllKeys() {
    const rows = this.db.prepare('SELECT key FROM sessions').all() as { key: string }[]
    return rows.map(r => r.key)
  }

  /** Return all sessions with their chat IDs for background monitoring */
  getAllSessions(): { chatId: string; session: T }[] {
    const rows = this.db.prepare('SELECT key, value FROM sessions').all() as { key: string; value: string }[]
    return rows
      .map(r => {
        try { return { chatId: r.key, session: JSON.parse(r.value) as T } }
        catch { return null }
      })
      .filter(Boolean) as { chatId: string; session: T }[]
  }
}
