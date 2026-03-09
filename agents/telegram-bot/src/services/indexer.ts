import Database from 'better-sqlite3'

export type IndexedProject = {
  id: number
  name: string
  owner: string
  description: string
  license: string
  readme_hash: string
  version_count: number
  created_at: number
}

let db: Database.Database | null = null

function requireDb() {
  if (db) return db
  const path = process.env.INKD_INDEXER_DB ?? '../data/indexer.db'
  db = new Database(path, { readonly: true })
  return db
}

export function listProjectsByOwner(owner: string, limit = 10) {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT * FROM projects WHERE lower(owner) = lower(?) ORDER BY updated_at DESC LIMIT ?'
  )
  return stmt.all(owner, limit) as IndexedProject[]
}
