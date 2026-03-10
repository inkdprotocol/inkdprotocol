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
  updated_at: number
}

export type IndexedVersion = {
  project_id: number
  version_index: number
  arweave_hash: string
  version_tag: string
  changelog: string | null
  pushed_by: string
  agent_address: string | null
  meta_hash: string | null
  pushed_at: number
}


let db: Database.Database | null = null

function requireDb() {
  if (db) return db
  const path = process.env.INKD_INDEXER_DB ?? '../data/indexer.db'
  db = new Database(path, { readonly: true })
  return db
}

export function getProjectById(id: number) {
  const database = requireDb()
  const stmt = database.prepare('SELECT * FROM projects WHERE id = ?')
  return stmt.get(id) as IndexedProject | undefined
}

export function listVersions(projectId: number, limit = 10) {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT * FROM versions WHERE project_id = ? ORDER BY version_index DESC LIMIT ?'
  )
  return stmt.all(projectId, limit) as IndexedVersion[]
}

/** Look up a single version by project + index. */
export function getVersion(projectId: number, versionIndex: number) {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT * FROM versions WHERE project_id = ? AND version_index = ?'
  )
  return stmt.get(projectId, versionIndex) as IndexedVersion | undefined
}

export function listProjectsByOwner(owner: string, limit = 10) {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT * FROM projects WHERE lower(owner) = lower(?) ORDER BY updated_at DESC LIMIT ?'
  )
  return stmt.all(owner, limit) as IndexedProject[]
}
