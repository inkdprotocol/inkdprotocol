import Database from 'better-sqlite3'
import type { StorageAdapter } from 'grammy'

// ─── Hidden projects (per user) ──────────────────────────────────────────────
let _db: Database.Database | null = null

function getDb(dbPath: string): Database.Database {
  if (!_db) {
    _db = new Database(dbPath)
    _db.exec('CREATE TABLE IF NOT EXISTS hidden_projects (user_id TEXT NOT NULL, project_id TEXT NOT NULL, PRIMARY KEY (user_id, project_id))')
  }
  return _db
}

// ─── Agent Monitor State ─────────────────────────────────────────────────────
export function initAgentMonitor(dbPath: string) {
  const db = getDb(dbPath)
  db.exec(`CREATE TABLE IF NOT EXISTS agent_monitor (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS seen_versions (
    version_id TEXT PRIMARY KEY,
    seen_at INTEGER NOT NULL
  )`)
}

export function getLastCheckedAt(dbPath: string): number {
  const db = getDb(dbPath)
  const row = db.prepare("SELECT value FROM agent_monitor WHERE key = 'lastCheckedAt'").get() as { value: string } | undefined
  return row ? parseInt(row.value, 10) : Math.floor(Date.now() / 1000) // default: now (no backfill on first start)
}

export function setLastCheckedAt(dbPath: string, timestamp: number) {
  const db = getDb(dbPath)
  db.prepare("REPLACE INTO agent_monitor (key, value) VALUES ('lastCheckedAt', ?)").run(String(timestamp))
}

export function hasSeenVersion(dbPath: string, versionId: string): boolean {
  const db = getDb(dbPath)
  const row = db.prepare('SELECT 1 FROM seen_versions WHERE version_id = ?').get(versionId)
  return !!row
}

export function markVersionSeen(dbPath: string, versionId: string) {
  const db = getDb(dbPath)
  db.prepare('INSERT OR IGNORE INTO seen_versions (version_id, seen_at) VALUES (?, ?)').run(versionId, Math.floor(Date.now() / 1000))
}

export function cleanupOldVersions(dbPath: string, olderThanDays = 30) {
  const db = getDb(dbPath)
  const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60)
  db.prepare('DELETE FROM seen_versions WHERE seen_at < ?').run(cutoff)
}

export function hideProject(dbPath: string, userId: string, projectId: string) {
  getDb(dbPath).prepare('INSERT OR IGNORE INTO hidden_projects (user_id, project_id) VALUES (?, ?)').run(userId, projectId)
}

export function unhideProject(dbPath: string, userId: string, projectId: string) {
  getDb(dbPath).prepare('DELETE FROM hidden_projects WHERE user_id = ? AND project_id = ?').run(userId, projectId)
}

export function getHiddenProjects(dbPath: string, userId: string): Set<string> {
  const rows = getDb(dbPath).prepare('SELECT project_id FROM hidden_projects WHERE user_id = ?').all(userId) as { project_id: string }[]
  return new Set(rows.map(r => r.project_id))
}

// ─── Session storage ──────────────────────────────────────────────────────────
export class SqliteStorage<T> implements StorageAdapter<T> {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`)
    // Ensure hidden_projects table exists in same db
    this.db.exec('CREATE TABLE IF NOT EXISTS hidden_projects (user_id TEXT NOT NULL, project_id TEXT NOT NULL, PRIMARY KEY (user_id, project_id))')
    _db = this.db
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
