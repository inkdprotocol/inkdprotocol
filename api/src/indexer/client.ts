// Optional dependency — not available on Vercel/serverless environments
// eslint-disable-next-line @typescript-eslint/no-require-imports
let Database: typeof import('better-sqlite3') | null = null
try { Database = require('better-sqlite3') } catch { /* not available */ }
import fs from 'node:fs'
import path from 'node:path'

export interface IndexerProject {
  id:            number
  name:          string
  description:   string
  license:       string
  readme_hash:   string
  owner:         string
  is_public:     number
  is_agent:      number
  agent_endpoint: string
  metadata_uri:  string
  fork_of:       number
  access_manifest: string
  tags_hash:     string
  version_count: number
  created_at:    number
  updated_at:    number
}

export interface IndexerVersion {
  project_id:   number
  version_index: number
  arweave_hash: string
  version_tag:  string
  changelog:    string
  pushed_by:    string
  agent_address: string | null
  meta_hash:    string
  pushed_at:    number
}

export interface IndexerHealth {
  lastRun:        number | null
  projectsCursor: string | null
  versionsAt:     number | null
}

export class IndexerClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any

  constructor(dbPath: string) {
    const resolved = path.resolve(dbPath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Indexer DB not found at ${resolved}`)
    }
    if (!Database) throw new Error('better-sqlite3 not available in this environment')
    this.db = new (Database as any)(resolved, { readonly: true, fileMustExist: true })
  }

  listProjects(offset: number, limit: number): IndexerProject[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY id LIMIT ? OFFSET ?').all(limit, offset) as IndexerProject[]
  }

  countProjects(): number {
    const row = this.db.prepare('SELECT COUNT(*) as total FROM projects').get() as { total?: number } | undefined
    return row?.total ?? 0
  }

  getProject(id: number): IndexerProject | null {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as IndexerProject ?? null
  }

  listVersions(projectId: number, offset: number, limit: number): IndexerVersion[] {
    return this.db.prepare(`
      SELECT * FROM versions
      WHERE project_id = ?
      ORDER BY version_index DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as IndexerVersion[]
  }

  countVersions(projectId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) as total FROM versions WHERE project_id = ?').get(projectId) as { total?: number } | undefined
    return row?.total ?? 0
  }

  health(): IndexerHealth {
    const lastRun = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('indexer:lastRun') as { cursor: string } | undefined
    const proj    = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('projects:lastId') as { cursor: string } | undefined
    const ver     = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('versions:lastSyncedAt') as { cursor: string } | undefined
    return {
      lastRun:        lastRun ? Number(lastRun.cursor) : null,
      projectsCursor: proj?.cursor ?? null,
      versionsAt:     ver ? Number(ver.cursor) : null,
    }
  }

  close() {
    this.db.close()
  }
}

export function buildIndexerClient(dbPath?: string): IndexerClient | null {
  try {
    if (!dbPath) return null
    return new IndexerClient(dbPath)
  } catch (err) {
    console.warn('IndexerClient disabled:', (err as Error).message)
    return null
  }
}
